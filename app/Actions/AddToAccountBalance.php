<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Account;

final readonly class AddToAccountBalance
{
    public function handle(int $accountId, string $signedAmount): void
    {
        $account = Account::query()->lockForUpdate()->findOrFail($accountId);
        $current = (string) $account->balance;
        $signed = $signedAmount;
        assert(is_numeric($current) && is_numeric($signed));
        $newBalance = bcadd($current, $signed, 2);
        $account->update(['balance' => $newBalance]);
    }
}
