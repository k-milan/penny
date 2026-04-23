<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\CreateAccount;
use App\Actions\DeleteAccount;
use App\Actions\UpdateAccount;
use App\Enums\AccountType;
use App\Http\Requests\StoreAccountRequest;
use App\Http\Requests\UpdateAccountRequest;
use App\Models\Account;
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

        /** @var array{name: string, type: AccountType} $data */
        $data = $request->validated();
        $action->handle($user, $data);

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
