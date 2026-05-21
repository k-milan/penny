<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\GenerateAccountShareTokenAction;
use App\Models\Account;
use Illuminate\Http\JsonResponse;

final readonly class AccountShareTokenController
{
    public function __invoke(Account $account, GenerateAccountShareTokenAction $action): JsonResponse
    {
        $account = $action->handle($account);

        return response()->json(['share_token' => $account->share_token]);
    }
}
