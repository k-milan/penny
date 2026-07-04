<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class BillSplit extends Model
{
    protected $guarded = [];

    public function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'service_charge' => 'decimal:2',
            'discount' => 'decimal:2',
            'total' => 'decimal:2',
        ];
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(BillSplitItem::class)->orderBy('position');
    }

    public function participants(): HasMany
    {
        return $this->hasMany(BillSplitParticipant::class);
    }
}
