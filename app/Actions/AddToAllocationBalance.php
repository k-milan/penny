<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Allocation;

final readonly class AddToAllocationBalance
{
    public function handle(int $allocationId, string $signedAmount): void
    {
        $allocation = Allocation::query()->lockForUpdate()->findOrFail($allocationId);
        $current = (string) $allocation->balance;
        $signed = $signedAmount;
        assert(is_numeric($current) && is_numeric($signed));
        $newBalance = bcadd($current, $signed, 2);
        $allocation->update(['balance' => $newBalance]);
    }
}
