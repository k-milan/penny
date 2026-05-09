<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\CreateTransaction;
use App\Actions\DeleteTransaction;
use App\Actions\UpdateTransaction;
use App\Http\Requests\StoreTransactionRequest;
use App\Http\Requests\UpdateTransactionRequest;
use App\Http\Resources\AccountResource;
use App\Http\Resources\AllocationResource;
use App\Http\Resources\TransactionResource;
use App\Models\Account;
use App\Models\Allocation;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final readonly class TransactionController
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        assert($user instanceof User);

        $accounts = Account::query()
            ->where('user_id', $user->id)
            ->orderBy('name', 'asc')
            ->get();

        $allocations = Allocation::query()
            ->where('user_id', $user->id)
            ->where('is_unallocated', false)
            ->orderBy('name', 'asc')
            ->get();

        $unallocatedAllocationId = Allocation::query()
            ->where('user_id', $user->id)
            ->where('is_unallocated', true)
            ->value('id');

        return Inertia::render('transactions/index', [
            'accounts' => AccountResource::collection($accounts)->resolve(),
            'allocations' => AllocationResource::collection($allocations)->resolve(),
            'unallocated_allocation_id' => $unallocatedAllocationId !== null
                ? (int) $unallocatedAllocationId
                : null,
            'transactions' => Inertia::scroll(
                static function () use ($user) {
                    $paginator = Transaction::query()
                        ->where('user_id', $user->id)
                        ->with([
                            'transactionAccounts.account',
                            'transactionAllocations.allocation',
                        ])
                        ->orderByDesc('date')
                        ->orderByDesc('created_at')
                        ->orderByDesc('id')
                        ->paginate(20, ['*'], 'transactions');

                    return $paginator->through(
                        static fn (Transaction $transaction): array => (new TransactionResource($transaction))->resolve(request())
                    );
                }
            ),
        ]);
    }

    public function store(StoreTransactionRequest $request, CreateTransaction $action): RedirectResponse
    {
        $user = $request->user();
        assert($user instanceof User);

        /** @var array{date: string, description: string, note?: string|null, accounts: array<int, array{account_id: int, amount: int|float|string}>, allocations: array<int, array{allocation_id: int, amount: int|float|string}>} $v */
        $v = $request->validated();
        $note = $v['note'] ?? null;
        $action->handle($user, [
            'date' => $v['date'],
            'description' => $v['description'],
            'note' => is_string($note) && $note !== '' ? $note : null,
            'accounts' => $v['accounts'],
            'allocations' => $v['allocations'],
        ]);

        return redirect()
            ->back(302, [], route('dashboard'))
            ->with('success', 'Transaction recorded.');
    }

    public function update(UpdateTransactionRequest $request, Transaction $transaction, UpdateTransaction $action): RedirectResponse
    {
        /** @var array{date: string, description: string, note?: string|null, accounts: array<int, array{account_id: int, amount: int|float|string}>, allocations: array<int, array{allocation_id: int, amount: int|float|string}>} $v */
        $v = $request->validated();
        $note = $v['note'] ?? null;
        $action->handle($transaction, [
            'date' => $v['date'],
            'description' => $v['description'],
            'note' => is_string($note) && $note !== '' ? $note : null,
            'accounts' => $v['accounts'],
            'allocations' => $v['allocations'],
        ]);

        return redirect()
            ->back(302, [], route('dashboard'))
            ->with('success', 'Transaction updated.');
    }

    public function destroy(Transaction $transaction, DeleteTransaction $action): RedirectResponse
    {
        $action->handle($transaction);

        return redirect()
            ->back(302, [], route('dashboard'))
            ->with('success', 'Transaction deleted.');
    }
}
