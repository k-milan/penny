<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Transaction;
use Illuminate\Support\Facades\DB;

final readonly class DeleteTransaction
{
    public function __construct(
        private AddToAccountBalance $addToAccountBalance,
        private AddToAllocationBalance $addToAllocationBalance,
    ) {
        //
    }

    public function handle(Transaction $transaction): void
    {
        DB::transaction(function () use ($transaction): void {
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

            $transaction->delete();
        });
    }
}
