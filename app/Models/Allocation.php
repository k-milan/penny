<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\AllocationType;
use App\Models\Concerns\ForCurrentUser;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property-read int $id
 * @property-read int $user_id
 * @property-read string $name
 * @property-read AllocationType $type
 * @property-read CarbonInterface|null $due_date
 * @property-read string|null $goal_amount
 * @property-read string $balance
 * @property-read CarbonInterface $created_at
 * @property-read CarbonInterface $updated_at
 * @property-read User $user
 * @property-read \Illuminate\Database\Eloquent\Collection<int, TransactionAllocation> $transactionAllocations
 */
final class Allocation extends Model
{
    use ForCurrentUser;

    /**
     * @return array<string, string>
     */
    public function casts(): array
    {
        return [
            'id' => 'integer',
            'user_id' => 'integer',
            'name' => 'string',
            'type' => AllocationType::class,
            'due_date' => 'date',
            'goal_amount' => 'decimal:2',
            'balance' => 'decimal:2',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return HasMany<TransactionAllocation, $this>
     */
    public function transactionAllocations(): HasMany
    {
        return $this->hasMany(TransactionAllocation::class);
    }
}
