<?php

declare(strict_types=1);

namespace App\Actions;

use App\Enums\AccountType;
use App\Models\Account;
use App\Models\User;

final readonly class CreateAccount
{
    /**
     * @param  array{name: string, type: AccountType}  $attributes
     */
    public function handle(User $user, array $attributes): Account
    {
        return Account::query()->create([
            'user_id' => $user->id,
            'name' => $attributes['name'],
            'type' => $attributes['type'],
        ]);
    }
}
