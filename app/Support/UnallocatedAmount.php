<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\Allocation;

/**
 * The default "Unallocated" system allocation; balance is the pool moved by
 * transaction line nets, not a separate computed figure.
 */
final class UnallocatedAmount
{
    public static function forUserId(int $userId): string
    {
        $value = Allocation::query()
            ->where('user_id', $userId)
            ->where('is_unallocated', true)
            ->value('balance');

        if ($value === null) {
            return '0.00';
        }

        return bcadd('0.00', (string) $value, 2);
    }
}
