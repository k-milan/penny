<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\IncomePayoutFrequency;
use App\Models\Concerns\ForCurrentUser;
use Carbon\CarbonInterface;
use Database\Factories\IncomeTemplateFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * @property int $id
 * @property int $user_id
 * @property int $series_id
 * @property int $version
 * @property string $name
 * @property string|null $description
 * @property string|null $company_name
 * @property IncomePayoutFrequency $payout_frequency
 * @property string $expected_income
 * @property CarbonInterface $created_at
 * @property CarbonInterface $updated_at
 * @property-read User $user
 * @property-read IncomeTemplateSeries $series
 * @property-read \Illuminate\Database\Eloquent\Collection<int, Account> $accounts
 * @property-read \Illuminate\Database\Eloquent\Collection<int, Allocation> $allocations
 */
final class IncomeTemplate extends Model
{
    /** @use HasFactory<IncomeTemplateFactory> */
    use ForCurrentUser, HasFactory;

    /**
     * @return array<string, string>
     */
    public function casts(): array
    {
        return [
            'id' => 'integer',
            'user_id' => 'integer',
            'series_id' => 'integer',
            'version' => 'integer',
            'name' => 'string',
            'description' => 'string',
            'company_name' => 'string',
            'payout_frequency' => IncomePayoutFrequency::class,
            'expected_income' => 'decimal:2',
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
     * @return BelongsTo<IncomeTemplateSeries, $this>
     */
    public function series(): BelongsTo
    {
        return $this->belongsTo(IncomeTemplateSeries::class, 'series_id');
    }

    /**
     * @return BelongsToMany<Account, $this>
     */
    public function accounts(): BelongsToMany
    {
        return $this->belongsToMany(Account::class)
            ->withPivot('amount')
            ->withTimestamps();
    }

    /**
     * @return BelongsToMany<Allocation, $this>
     */
    public function allocations(): BelongsToMany
    {
        return $this->belongsToMany(Allocation::class)
            ->withPivot('amount')
            ->withTimestamps();
    }
}
