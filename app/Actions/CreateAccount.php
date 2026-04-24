<?php

declare(strict_types=1);

namespace App\Actions;

use App\Enums\AccountType;
use App\Models\Account;
use App\Models\User;
use Illuminate\Support\Facades\DB;

final readonly class CreateAccount
{
    public function __construct(
        private AddToAllocationBalance $addToAllocationBalance,
        private EnsureUnallocatedAllocationForUser $ensureUnallocated,
    ) {
        //
    }

    /**
     * @param  array{name: string, type: AccountType, initial_balance?: string|null}  $attributes
     */
    public function handle(User $user, array $attributes): Account
    {
        return DB::transaction(function () use ($user, $attributes): Account {
            $initial = $attributes['initial_balance'] ?? null;
            $balance = ($initial !== null && $initial !== '' && is_numeric($initial))
                ? bcadd('0.00', (string) $initial, 2)
                : '0.00';

            $account = Account::query()->create([
                'user_id' => $user->id,
                'name' => $attributes['name'],
                'type' => $attributes['type'],
                'balance' => $balance,
            ]);

            if (bccomp($balance, '0.00', 2) > 0) {
                $unallocated = $this->ensureUnallocated->handle($user);
                $this->addToAllocationBalance->handle((int) $unallocated->id, $balance);
            }

            return $account;
        });
    }
}
