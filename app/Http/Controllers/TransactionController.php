<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\CreateTransaction;
use App\Actions\DeleteTransaction;
use App\Actions\UpdateTransaction;
use App\Http\Requests\StoreTransactionRequest;
use App\Http\Requests\UpdateTransactionRequest;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Http\RedirectResponse;

final readonly class TransactionController
{
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
            ->route('dashboard')
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
            ->route('dashboard')
            ->with('success', 'Transaction updated.');
    }

    public function destroy(Transaction $transaction, DeleteTransaction $action): RedirectResponse
    {
        $action->handle($transaction);

        return redirect()
            ->route('dashboard')
            ->with('success', 'Transaction deleted.');
    }
}
