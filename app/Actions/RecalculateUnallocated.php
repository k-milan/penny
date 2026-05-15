<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Allocation;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Resets the unallocated balance to the canonical value:
 * sum(account balances) − sum(non-unallocated allocation balances).
 */
final readonly class RecalculateUnallocated
{
    public function handle(User $user): void
    {
        DB::transaction(function () use ($user): void {
            $unallocated = Allocation::query()
                ->where('user_id', $user->id)
                ->where('is_unallocated', true)
                ->lockForUpdate()
                ->firstOrFail();

            $accountTotal = (string) ($user->accounts()->sum('balance') ?? '0');
            $allocationTotal = (string) (Allocation::query()
                ->where('user_id', $user->id)
                ->where('is_unallocated', false)
                ->sum('balance') ?? '0');

            $correct = bcsub(
                bcadd('0.00', $accountTotal, 2),
                bcadd('0.00', $allocationTotal, 2),
                2,
            );

            $unallocated->update(['balance' => $correct]);
        });
    }
}
