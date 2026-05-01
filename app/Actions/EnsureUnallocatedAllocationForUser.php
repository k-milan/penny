<?php

declare(strict_types=1);

namespace App\Actions;

use App\Enums\AllocationType;
use App\Models\Allocation;
use App\Models\User;

/**
 * Every user has exactly one "Unallocated" system allocation; balance tracks
 * the default pool and is updated by transaction line nets.
 */
final readonly class EnsureUnallocatedAllocationForUser
{
    public function handle(User $user): Allocation
    {
        $existing = Allocation::query()
            ->where('user_id', $user->id)
            ->where('is_unallocated', true)
            ->first();

        if ($existing !== null) {
            return $existing;
        }

        return Allocation::query()->create([
            'user_id' => $user->id,
            'name' => 'Unallocated',
            'type' => AllocationType::Unallocated,
            'due_date' => null,
            'goal_amount' => null,
            'balance' => '0.00',
            'is_unallocated' => true,
        ]);
    }
}
