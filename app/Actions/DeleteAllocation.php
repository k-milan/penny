<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Allocation;
use DomainException;

final readonly class DeleteAllocation
{
    public function handle(Allocation $allocation): void
    {
        if ($allocation->is_unallocated) {
            throw new DomainException('The default Unallocated allocation cannot be deleted.');
        }

        if ($allocation->transactionAllocations()->exists()) {
            throw new DomainException('An allocation with linked transaction lines cannot be deleted.');
        }

        $allocation->delete();
    }
}
