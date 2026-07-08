<?php

declare(strict_types=1);

namespace App\Actions;

use App\Enums\AllocationType;
use App\Models\Allocation;
use App\Models\User;
use Carbon\CarbonImmutable;
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
     *     type?: AllocationType|string|null,
     *     due_date?: \Carbon\CarbonInterface|string|null,
     *     due_day?: int|null,
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

            $type = self::typeFromAttributes($attributes);

            $allocation = Allocation::query()->create([
                'user_id' => $user->id,
                'name' => $attributes['name'],
                'type' => $type,
                'due_date' => $attributes['due_date'] ?? null,
                'due_day' => self::dueDayFromAttributes($attributes, $type),
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

    /**
     * @param  array{type?: AllocationType|string|null, due_date?: \Carbon\CarbonInterface|string|null, due_day?: int|null}  $attributes
     */
    private static function dueDayFromAttributes(array $attributes, AllocationType $type): ?int
    {
        if ($type !== AllocationType::Bill) {
            return null;
        }

        if (isset($attributes['due_day']) && is_int($attributes['due_day'])) {
            return $attributes['due_day'];
        }

        $dueDate = $attributes['due_date'] ?? null;
        if ($dueDate === null || $dueDate === '') {
            return null;
        }

        return CarbonImmutable::parse((string) $dueDate)->day;
    }

    /**
     * @param  array{type?: AllocationType|string|null}  $attributes
     */
    private static function typeFromAttributes(array $attributes): AllocationType
    {
        $type = $attributes['type'] ?? AllocationType::Normal;

        return $type instanceof AllocationType
            ? $type
            : (AllocationType::tryFrom((string) $type) ?? AllocationType::Normal);
    }
}
