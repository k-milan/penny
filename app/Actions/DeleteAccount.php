<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Account;
use DomainException;

final readonly class DeleteAccount
{
    public function handle(Account $account): void
    {
        if ($account->transactionAccounts()->exists()) {
            throw new DomainException('An account with linked transaction lines cannot be deleted.');
        }

        $account->delete();
    }
}
