<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\TransactionAccount
 */
final class TransactionAccountResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'account_id' => $this->account_id,
            'amount' => (string) $this->amount,
            'account' => $this->when(
                $this->relationLoaded('account'),
                fn () => new AccountResource($this->account),
            ),
        ];
    }
}
