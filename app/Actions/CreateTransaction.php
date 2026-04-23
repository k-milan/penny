<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Transaction;
use App\Models\User;
use Illuminate\Support\Facades\DB;

final readonly class CreateTransaction
{
    public function __construct(
        private AddToAccountBalance $addToAccountBalance,
        private AddToAllocationBalance $addToAllocationBalance,
    ) {
        //
    }

    /**
     * @param  array{
     *     date: \Carbon\CarbonInterface|string,
     *     description: string,
     *     note: string|null,
     *     accounts: array<int, array{account_id: int, amount: string|float|int}>,
     *     allocations: array<int, array{allocation_id: int, amount: string|float|int}>,
     * }  $data
     */
    public function handle(User $user, array $data): Transaction
    {
        return DB::transaction(function () use ($user, $data): Transaction {
            $transaction = Transaction::query()->create([
                'user_id' => $user->id,
                'date' => $data['date'],
                'description' => $data['description'],
                'note' => $data['note'] ?? null,
            ]);

            foreach ($data['accounts'] as $row) {
                $amount = (string) $row['amount'];
                $transaction->transactionAccounts()->create([
                    'account_id' => $row['account_id'],
                    'amount' => $amount,
                ]);
                $this->addToAccountBalance->handle($row['account_id'], $amount);
            }

            foreach ($data['allocations'] as $row) {
                $amount = (string) $row['amount'];
                $transaction->transactionAllocations()->create([
                    'allocation_id' => $row['allocation_id'],
                    'amount' => $amount,
                ]);
                $this->addToAllocationBalance->handle($row['allocation_id'], $amount);
            }

            return $transaction->load(['transactionAccounts.account', 'transactionAllocations.allocation']);
        });
    }
}
