<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Account;
use DomainException;
use Illuminate\Support\Facades\DB;

final readonly class DeleteAccount
{
    public function __construct(
        private AddToAllocationBalance $addToAllocationBalance,
        private EnsureUnallocatedAllocationForUser $ensureUnallocated,
    ) {
        //
    }

    public function handle(Account $account): void
    {
        if ($account->transactionAccounts()->exists()) {
            throw new DomainException('An account with linked transaction lines cannot be deleted.');
        }

        DB::transaction(function () use ($account): void {
            $balance = (string) $account->balance;

            if (bccomp($balance, '0.00', 2) !== 0) {
                $unallocated = $this->ensureUnallocated->handle($account->user);
                $this->addToAllocationBalance->handle((int) $unallocated->id, bcsub('0.00', $balance, 2));
            }

            $account->delete();
        });
    }
}
