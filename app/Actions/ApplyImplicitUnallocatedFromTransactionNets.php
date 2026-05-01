<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Allocation;
use App\Support\TransactionLineAmounts;

/**
 * Per transaction, the default Unallocated allocation changes by
 * (sum of account line amounts) minus (sum of other allocation line amounts)
 * in that transaction's payload.
 */
final readonly class ApplyImplicitUnallocatedFromTransactionNets
{
    public function __construct(
        private AddToAllocationBalance $addToAllocationBalance,
    ) {
        //
    }

    /**
     * @param  array<int, array{amount: int|float|string}>  $accountLines
     * @param  array<int, array{amount: int|float|string}>  $allocationLines
     */
    public function applyForUser(int $userId, array $accountLines, array $allocationLines): void
    {
        $signedNet = TransactionLineAmounts::implicitUnallocatedNet(
            $accountLines,
            $allocationLines
        );

        if (bccomp($signedNet, '0.00', 2) === 0) {
            return;
        }

        $allocation = Allocation::query()
            ->where('user_id', $userId)
            ->where('is_unallocated', true)
            ->lockForUpdate()
            ->firstOrFail();

        $this->addToAllocationBalance->handle((int) $allocation->id, $signedNet);
    }

    public function applySignedNetForUser(int $userId, string $signedNet): void
    {
        if (bccomp($signedNet, '0.00', 2) === 0) {
            return;
        }

        $allocation = Allocation::query()
            ->where('user_id', $userId)
            ->where('is_unallocated', true)
            ->lockForUpdate()
            ->firstOrFail();

        $this->addToAllocationBalance->handle((int) $allocation->id, $signedNet);
    }
}
