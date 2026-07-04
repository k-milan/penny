<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\Allocation
 */
final class AllocationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'type' => $this->type,
            'due_date' => $this->due_date?->format('Y-m-d'),
            'goal_amount' => $this->goal_amount === null ? null : (string) $this->goal_amount,
            'balance' => (string) $this->balance,
            'is_unallocated' => $this->is_unallocated,
            'is_pinned' => (bool) $this->is_pinned,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
