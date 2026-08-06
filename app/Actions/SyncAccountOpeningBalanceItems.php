<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Account;
use Illuminate\Support\Facades\DB;

final readonly class SyncAccountOpeningBalanceItems
{
    /**
     * @param  list<array{description: string, amount: string}>  $items
     */
    public function handle(Account $account, array $items): void
    {
        DB::transaction(function () use ($account, $items): void {
            $account->openingBalanceItems()->delete();
            $account->openingBalanceItems()->createMany($items);
        });
    }
}
