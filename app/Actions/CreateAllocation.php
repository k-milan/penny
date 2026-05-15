<?php

declare(strict_types=1);

namespace App\Actions;

use App\Enums\AllocationType;
use App\Models\Allocation;
use App\Models\User;
use Illuminate\Support\Facades\DB;

final readonly class CreateAllocation
{
    public function __construct(
        private AddToAllocationBalance $addToAllocationBalance,
        private EnsureUnallocatedAllocationForUser $ensureUnallocated,
    ) {
        //
    }

    /**
     * @param  array{
     *     name: string,
     *     type?: AllocationType|null,
     *     due_date?: \Carbon\CarbonInterface|string|null,
     *     goal_amount?: string|null,
     *     initial_balance?: string|null,
     * }  $attributes
     */
    public function handle(User $user, array $attributes): Allocation
    {
        return DB::transaction(function () use ($user, $attributes): Allocation {
            $initial = $attributes['initial_balance'] ?? null;
            $balance = ($initial !== null && $initial !== '' && is_numeric($initial))
                ? bcadd('0.00', (string) $initial, 2)
                : '0.00';

            $allocation = Allocation::query()->create([
                'user_id' => $user->id,
                'name' => $attributes['name'],
                'type' => $attributes['type'] ?? AllocationType::Normal,
                'due_date' => $attributes['due_date'] ?? null,
                'goal_amount' => $attributes['goal_amount'] ?? null,
                'balance' => $balance,
                'is_unallocated' => false,
            ]);

            if (bccomp($balance, '0.00', 2) !== 0) {
                $unallocated = $this->ensureUnallocated->handle($user);
                $this->addToAllocationBalance->handle(
                    (int) $unallocated->id,
                    bcsub('0.00', $balance, 2)
                );
            }

            return $allocation;
        });
    }
}
