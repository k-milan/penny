<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\ForCurrentUser;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property-read int $id
 * @property-read int $user_id
 * @property-read int $allocation_id
 * @property-read CarbonInterface $period
 * @property-read CarbonInterface $due_date
 * @property-read string|null $due_amount
 * @property-read CarbonInterface|null $confirmed_at
 * @property-read Allocation $allocation
 */
final class BillPeriod extends Model
{
    /** @use HasFactory<\Database\Factories\BillPeriodFactory> */
    use ForCurrentUser, HasFactory;

    /**
     * @return array<string, string>
     */
    public function casts(): array
    {
        return [
            'id' => 'integer',
            'user_id' => 'integer',
            'allocation_id' => 'integer',
            'period' => 'date',
            'due_date' => 'date',
            'due_amount' => 'decimal:2',
            'confirmed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Allocation, $this>
     */
    public function allocation(): BelongsTo
    {
        return $this->belongsTo(Allocation::class);
    }
}
