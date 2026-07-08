<?php

declare(strict_types=1);

namespace App\Actions;

use App\Enums\AllocationType;
use App\Models\Allocation;
use Carbon\CarbonImmutable;

final readonly class UpdateAllocation
{
    /**
     * @param  array<string, mixed>  $attributes
     */
    public function handle(Allocation $allocation, array $attributes): void
    {
        $type = $attributes['type'] ?? $allocation->type;
        if (is_string($type)) {
            $type = AllocationType::tryFrom($type) ?? $allocation->type;
        }

        if ($type !== AllocationType::Bill) {
            $attributes['due_day'] = null;
        } elseif (array_key_exists('due_date', $attributes)) {
            $dueDate = $attributes['due_date'];
            $attributes['due_day'] = $dueDate === null || $dueDate === ''
                ? null
                : CarbonImmutable::parse((string) $dueDate)->day;
        }

        $allocation->update($attributes);
    }
}
