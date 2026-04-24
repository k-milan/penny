<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Transaction;
use App\Support\TransactionLineAmounts;
use Illuminate\Support\Facades\DB;

final readonly class DeleteTransaction
{
    public function __construct(
        private AddToAccountBalance $addToAccountBalance,
        private AddToAllocationBalance $addToAllocationBalance,
        private ApplyImplicitUnallocatedFromTransactionNets $applyImplicitUnallocated,
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

            $oldAccountLines = [];
            foreach ($transaction->transactionAccounts as $line) {
                $oldAccountLines[] = ['amount' => (string) $line->amount];
            }
            $oldAllocationLines = [];
            foreach ($transaction->transactionAllocations as $line) {
                $oldAllocationLines[] = ['amount' => (string) $line->amount];
            }
            $net = TransactionLineAmounts::implicitUnallocatedNet(
                $oldAccountLines,
                $oldAllocationLines
            );
            $this->applyImplicitUnallocated->applySignedNetForUser(
                (int) $transaction->user_id,
                bcsub('0.00', $net, 2)
            );

            $transaction->delete();
        });
    }
}
