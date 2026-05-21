<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\CreateAccount;
use App\Actions\DeleteAccount;
use App\Actions\GenerateAccountShareTokenAction;
use App\Actions\UpdateAccount;
use App\Enums\AccountType;
use App\Http\Requests\StoreAccountRequest;
use App\Http\Requests\UpdateAccountRequest;
use App\Http\Resources\AccountResource;
use App\Http\Resources\AllocationResource;
use App\Http\Resources\TransactionResource;
use App\Models\Account;
use App\Models\Allocation;
use App\Models\Transaction;
use App\Models\User;
use DomainException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final readonly class AccountController
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        assert($user instanceof User);

        $accounts = Account::query()
            ->where('user_id', $user->id)
            ->orderBy('name')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('accounts/index', [
            'accounts' => $accounts,
        ]);
    }

    public function show(Request $request, Account $account, GenerateAccountShareTokenAction $generateShareToken): Response
    {
        $user = $request->user();
        assert($user instanceof User);

        if ($account->type === AccountType::Person) {
            $account = $generateShareToken->handle($account);
        }

        $accounts = Account::query()
            ->where('user_id', $user->id)
            ->orderBy('name')
            ->get();

        $allAllocations = Allocation::query()
            ->where('user_id', $user->id)
            ->orderBy('name')
            ->get();

        $unallocatedAllocationId = Allocation::query()
            ->where('user_id', $user->id)
            ->where('is_unallocated', true)
            ->value('id');

        return Inertia::render('accounts/show', [
            'account' => [
                'id' => $account->id,
                'name' => $account->name,
                'type' => $account->type->value,
                'balance' => (string) $account->balance,
                'share_token' => $account->type === AccountType::Person ? $account->share_token : null,
            ],
            'accounts' => AccountResource::collection($accounts)->resolve(),
            'allocations' => AllocationResource::collection($allAllocations)->resolve(),
            'unallocated_allocation_id' => $unallocatedAllocationId !== null
                ? (int) $unallocatedAllocationId
                : null,
            'transactions' => Inertia::scroll(
                static function () use ($account): mixed {
                    $paginator = Transaction::query()
                        ->whereHas(
                            'transactionAccounts',
                            static fn ($q) => $q->where('account_id', $account->id)
                        )
                        ->with([
                            'transactionAccounts.account',
                            'transactionAllocations.allocation',
                        ])
                        ->orderByDesc('date')
                        ->orderByDesc('created_at')
                        ->orderByDesc('id')
                        ->paginate(20, ['*'], 'transactions');

                    return $paginator->through(
                        static fn (Transaction $t): array => (new TransactionResource($t))->resolve(request())
                    );
                }
            ),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('accounts/create', [
            'types' => self::accountTypeOptions(),
        ]);
    }

    public function store(StoreAccountRequest $request, CreateAccount $action): RedirectResponse
    {
        $user = $request->user();
        assert($user instanceof User);

        /** @var array{name: string, type: AccountType, initial_balance?: float|int|string|null} $data */
        $data = $request->validated();
        $initial = $data['initial_balance'] ?? null;
        $action->handle($user, [
            'name' => $data['name'],
            'type' => $data['type'],
            'initial_balance' => is_numeric($initial) ? (string) $initial : null,
        ]);

        return redirect()->route('accounts.index')
            ->with('success', 'Account created.');
    }

    public function edit(Account $account): Response
    {
        return Inertia::render('accounts/edit', [
            'account' => [
                'id' => $account->id,
                'name' => $account->name,
                'type' => $account->type->value,
                'balance' => (string) $account->balance,
            ],
            'types' => self::accountTypeOptions(),
        ]);
    }

    public function update(UpdateAccountRequest $request, Account $account, UpdateAccount $action): RedirectResponse
    {
        $action->handle($account, $request->validated());

        return redirect()->route('accounts.index')
            ->with('success', 'Account updated.');
    }

    public function destroy(Account $account, DeleteAccount $action): RedirectResponse
    {
        try {
            $action->handle($account);
        } catch (DomainException $e) {
            return redirect()
                ->route('accounts.index')
                ->with('error', $e->getMessage());
        }

        return redirect()
            ->route('accounts.index')
            ->with('success', 'Account deleted.');
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    private static function accountTypeOptions(): array
    {
        return array_map(
            static fn (AccountType $t): array => [
                'value' => $t->value,
                'label' => match ($t) {
                    AccountType::Cash => 'Cash',
                    AccountType::Bank => 'Bank',
                    AccountType::CreditCard => 'Credit card',
                    AccountType::Person => 'Person',
                },
            ],
            AccountType::cases(),
        );
    }
}
