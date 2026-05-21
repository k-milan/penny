<?php

declare(strict_types=1);

namespace App\Actions;

use App\Enums\AccountType;
use App\Models\Account;
use DomainException;
use Illuminate\Support\Str;

final readonly class GenerateAccountShareTokenAction
{
    public function handle(Account $account): Account
    {
        if ($account->type !== AccountType::Person) {
            throw new DomainException('Share links are only available for person accounts.');
        }

        if ($account->share_token !== null) {
            return $account;
        }

        do {
            $token = Str::random(32);
        } while (Account::query()->where('share_token', $token)->exists());

        $account->update(['share_token' => $token]);

        return $account->fresh();
    }
}
