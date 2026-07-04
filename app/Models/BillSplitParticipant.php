<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

final class BillSplitParticipant extends Model
{
    protected $guarded = [];

    public function casts(): array
    {
        return [
            'item_subtotal' => 'decimal:2',
            'service_charge' => 'decimal:2',
            'discount' => 'decimal:2',
            'total' => 'decimal:2',
        ];
    }

    public function billSplit(): BelongsTo
    {
        return $this->belongsTo(BillSplit::class);
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function allocation(): BelongsTo
    {
        return $this->belongsTo(Allocation::class);
    }

    public function items(): BelongsToMany
    {
        return $this->belongsToMany(
            BillSplitItem::class,
            'bill_split_item_participant'
        )
            ->withPivot('shares', 'amount')
            ->withTimestamps();
    }
}
