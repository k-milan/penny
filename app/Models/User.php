<?php

declare(strict_types=1);

namespace App\Models;

use App\Actions\EnsureUnallocatedAllocationForUser;
use Carbon\CarbonInterface;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Fortify\TwoFactorAuthenticatable;

/**
 * @property-read int $id
 * @property-read string $name
 * @property-read string $email
 * @property-read CarbonInterface|null $email_verified_at
 * @property-read string $password
 * @property-read string|null $remember_token
 * @property-read string|null $two_factor_secret
 * @property-read string|null $two_factor_recovery_codes
 * @property-read CarbonInterface|null $two_factor_confirmed_at
 * @property-read CarbonInterface $created_at
 * @property-read CarbonInterface $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, Account> $accounts
 * @property-read \Illuminate\Database\Eloquent\Collection<int, Allocation> $allocations
 * @property-read \Illuminate\Database\Eloquent\Collection<int, Transaction> $transactions
 * @property-read \Illuminate\Database\Eloquent\Collection<int, IncomeTemplate> $incomeTemplates
 * @property-read \Illuminate\Database\Eloquent\Collection<int, IncomeTemplateSeries> $incomeTemplateSeries
 */
final class User extends Authenticatable implements MustVerifyEmail
{
    /**
     * @use HasFactory<UserFactory>
     */
    use HasFactory, Notifiable, TwoFactorAuthenticatable;

    /**
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_secret',
        'two_factor_recovery_codes',
    ];

    /**
     * @return array<string, string>
     */
    public function casts(): array
    {
        return [
            'id' => 'integer',
            'name' => 'string',
            'email' => 'string',
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'remember_token' => 'string',
            'two_factor_secret' => 'string',
            'two_factor_recovery_codes' => 'string',
            'two_factor_confirmed_at' => 'datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    /**
     * @return HasMany<Account, $this>
     */
    public function accounts(): HasMany
    {
        return $this->hasMany(Account::class);
    }

    /**
     * @return HasMany<Allocation, $this>
     */
    public function allocations(): HasMany
    {
        return $this->hasMany(Allocation::class);
    }

    /**
     * @return HasMany<Transaction, $this>
     */
    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    /**
     * @return HasMany<IncomeTemplate, $this>
     */
    public function incomeTemplates(): HasMany
    {
        return $this->hasMany(IncomeTemplate::class);
    }

    /**
     * @return HasMany<IncomeTemplateSeries, $this>
     */
    public function incomeTemplateSeries(): HasMany
    {
        return $this->hasMany(IncomeTemplateSeries::class);
    }

    protected static function booted(): void
    {
        self::created(function (User $user): void {
            app(EnsureUnallocatedAllocationForUser::class)->handle($user);
        });
    }
}
