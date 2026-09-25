<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\AccountType;
use App\Models\Concerns\ForCurrentUser;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property-read int $id
 * @property-read int $user_id
 * @property-read string $name
 * @property-read AccountType $type
 * @property-read string $balance
 * @property-read CarbonInterface|null $due_date
 * @property-read int|null $due_day
 * @property-read bool $is_pinned
 * @property-read string|null $share_token
 * @property-read CarbonInterface $created_at
 * @property-read CarbonInterface $updated_at
 * @property-read User $user
 * @property-read \Illuminate\Database\Eloquent\Collection<int, TransactionAccount> $transactionAccounts
 * @property-read \Illuminate\Database\Eloquent\Collection<int, AccountOpeningBalanceItem> $openingBalanceItems
 */
final class Account extends Model
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
            'type' => AccountType::class,
            'balance' => 'decimal:2',
            'due_date' => 'date',
            'due_day' => 'integer',
            'is_pinned' => 'boolean',
            'share_token' => 'string',
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
     * @return HasMany<BillSplitParticipant, $this>
     */
    public function billSplitParticipants(): HasMany
    {
        return $this->hasMany(BillSplitParticipant::class);
    }

    /**
     * @return HasMany<AccountOpeningBalanceItem, $this>
     */
    public function openingBalanceItems(): HasMany
    {
        return $this->hasMany(AccountOpeningBalanceItem::class);
    }
}
