<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Transaction;
use Illuminate\Support\Facades\DB;

final readonly class UpdateTransaction
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
    public function handle(Transaction $transaction, array $data): Transaction
    {
        return DB::transaction(function () use ($transaction, $data): Transaction {
            $transaction = $transaction
                ->newQuery()
                ->lockForUpdate()
                ->whereKey($transaction->id)
                ->with(['transactionAccounts', 'transactionAllocations'])
                ->firstOrFail();

            foreach ($transaction->transactionAccounts as $line) {
                $lineAmount = (string) $line->amount;
                assert(is_numeric($lineAmount));
                $neg = bcsub('0.00', $lineAmount, 2);
                $this->addToAccountBalance->handle($line->account_id, $neg);
            }
            foreach ($transaction->transactionAllocations as $line) {
                $lineAmount = (string) $line->amount;
                assert(is_numeric($lineAmount));
                $neg = bcsub('0.00', $lineAmount, 2);
                $this->addToAllocationBalance->handle($line->allocation_id, $neg);
            }

            $transaction->transactionAccounts()->delete();
            $transaction->transactionAllocations()->delete();

            $transaction->update([
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

            $transaction->refresh();

            return $transaction->load(['transactionAccounts.account', 'transactionAllocations.allocation']);
        });
    }
}
