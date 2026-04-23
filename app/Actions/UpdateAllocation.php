<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Allocation;

final readonly class UpdateAllocation
{
    /**
     * @param  array<string, mixed>  $attributes
     */
    public function handle(Allocation $allocation, array $attributes): void
    {
        $allocation->update($attributes);
    }
}
