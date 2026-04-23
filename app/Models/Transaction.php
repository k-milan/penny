<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\ForCurrentUser;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property-read int $id
 * @property-read int $user_id
 * @property-read CarbonInterface $date
 * @property-read string $description
 * @property-read string|null $note
 * @property-read CarbonInterface $created_at
 * @property-read CarbonInterface $updated_at
 * @property-read User $user
 * @property-read \Illuminate\Database\Eloquent\Collection<int, TransactionAccount> $transactionAccounts
 * @property-read \Illuminate\Database\Eloquent\Collection<int, TransactionAllocation> $transactionAllocations
 */
final class Transaction extends Model
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
            'date' => 'date',
            'description' => 'string',
            'note' => 'string',
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
     * @return HasMany<TransactionAccount, $this>
     */
    public function transactionAccounts(): HasMany
    {
        return $this->hasMany(TransactionAccount::class);
    }

    /**
     * @return HasMany<TransactionAllocation, $this>
     */
    public function transactionAllocations(): HasMany
    {
        return $this->hasMany(TransactionAllocation::class);
    }
}
