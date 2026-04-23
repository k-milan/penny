<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\TransactionAllocation
 */
final class TransactionAllocationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'allocation_id' => $this->allocation_id,
            'amount' => (string) $this->amount,
            'allocation' => $this->when(
                $this->relationLoaded('allocation'),
                fn () => new AllocationResource($this->allocation),
            ),
        ];
    }
}
