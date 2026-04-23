<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Actions\CreateTransaction;
use App\Actions\DeleteTransaction;
use App\Actions\UpdateTransaction;
use App\Http\Requests\StoreTransactionRequest;
use App\Http\Requests\UpdateTransactionRequest;
use App\Http\Resources\TransactionResource;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Pagination\LengthAwarePaginator;

final readonly class TransactionController
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        assert($user instanceof User);

        /** @var LengthAwarePaginator<int, Transaction> $transactions */
        $transactions = Transaction::query()
            ->where('user_id', $user->id)
            ->with([
                'transactionAccounts.account',
                'transactionAllocations.allocation',
            ])
            ->latest('date')
            ->latest('id')
            ->paginate($request->integer('per_page', 15));

        return TransactionResource::collection($transactions)->response();
    }

    public function store(StoreTransactionRequest $request, CreateTransaction $action): JsonResponse
    {
        $user = $request->user();
        assert($user instanceof User);

        /** @var array{date: string, description: string, note?: string|null, accounts: array<int, array{account_id: int, amount: int|float|string}>, allocations: array<int, array{allocation_id: int, amount: int|float|string}>} $v */
        $v = $request->validated();
        $note = $v['note'] ?? null;
        $transaction = $action->handle($user, [
            'date' => $v['date'],
            'description' => $v['description'],
            'note' => is_string($note) && $note !== '' ? $note : null,
            'accounts' => $v['accounts'],
            'allocations' => $v['allocations'],
        ]);

        return (new TransactionResource($transaction))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(Transaction $transaction): JsonResponse
    {
        $transaction->load([
            'transactionAccounts.account',
            'transactionAllocations.allocation',
        ]);

        return (new TransactionResource($transaction))->response();
    }

    public function update(UpdateTransactionRequest $request, Transaction $transaction, UpdateTransaction $action): JsonResponse
    {
        /** @var array{date: string, description: string, note?: string|null, accounts: array<int, array{account_id: int, amount: int|float|string}>, allocations: array<int, array{allocation_id: int, amount: int|float|string}>} $v */
        $v = $request->validated();
        $note = $v['note'] ?? null;
        $transaction = $action->handle($transaction, [
            'date' => $v['date'],
            'description' => $v['description'],
            'note' => is_string($note) && $note !== '' ? $note : null,
            'accounts' => $v['accounts'],
            'allocations' => $v['allocations'],
        ]);

        return (new TransactionResource($transaction))->response();
    }

    public function destroy(Transaction $transaction, DeleteTransaction $action): Response
    {
        $action->handle($transaction);

        return response()->noContent();
    }
}
