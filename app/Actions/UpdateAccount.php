<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Account;

final readonly class UpdateAccount
{
    /**
     * @param  array<string, mixed>  $attributes
     */
    public function handle(Account $account, array $attributes): void
    {
        $account->update($attributes);
    }
}
