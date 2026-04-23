<?php

declare(strict_types=1);

namespace App\Actions;

use App\Enums\AllocationType;
use App\Models\Allocation;
use App\Models\User;

final readonly class CreateAllocation
{
    /**
     * @param  array{
     *     name: string,
     *     type?: AllocationType|null,
     *     due_date?: \Carbon\CarbonInterface|string|null,
     *     goal_amount?: string|null,
     * }  $attributes
     */
    public function handle(User $user, array $attributes): Allocation
    {
        return Allocation::query()->create([
            'user_id' => $user->id,
            'name' => $attributes['name'],
            'type' => $attributes['type'] ?? AllocationType::Normal,
            'due_date' => $attributes['due_date'] ?? null,
            'goal_amount' => $attributes['goal_amount'] ?? null,
        ]);
    }
}
