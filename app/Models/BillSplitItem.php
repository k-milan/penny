<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

final class BillSplitItem extends Model
{
    protected $guarded = [];

    public function casts(): array
    {
        return [
            'quantity' => 'integer',
            'unit_price' => 'decimal:2',
            'amount' => 'decimal:2',
            'position' => 'integer',
        ];
    }

    public function billSplit(): BelongsTo
    {
        return $this->belongsTo(BillSplit::class);
    }

    public function participants(): BelongsToMany
    {
        return $this->belongsToMany(
            BillSplitParticipant::class,
            'bill_split_item_participant'
        )
            ->withPivot('amount')
            ->withTimestamps();
    }
}
