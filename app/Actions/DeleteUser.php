<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Account;
use App\Models\Allocation;
use App\Models\User;
use Illuminate\Support\Facades\DB;

final readonly class DeleteUser
{
    public function __construct(
        private DeleteTransaction $deleteTransaction,
    ) {
        //
    }

    public function handle(User $user): void
    {
        DB::transaction(function () use ($user): void {
            foreach ($user->transactions()->orderBy('id')->cursor() as $transaction) {
                $this->deleteTransaction->handle($transaction);
            }

            Account::query()->where('user_id', $user->id)->delete();
            Allocation::query()->where('user_id', $user->id)->delete();

            $user->delete();
        });
    }
}
