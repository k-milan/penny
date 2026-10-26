<?php

declare(strict_types=1);

namespace App\Mcp\Tools;

use App\Http\Resources\AccountResource;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('get_accounts')]
#[Description('Get your accounts, including IDs, names, types and current decimal balances.')]
#[IsReadOnly]
final class GetAccounts extends PennyTool
{
    public function handle(Request $request): Response
    {
        $records = $this->user($request)->accounts()->orderBy('name')->get();

        return $this->jsonResponse(['accounts' => AccountResource::collection($records)->resolve()]);
    }
}
