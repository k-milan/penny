<?php

declare(strict_types=1);

namespace App\Mcp\Servers;

use App\Mcp\Tools;
use Laravel\Mcp\Server;
use Laravel\Mcp\Server\Attributes\Instructions;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Version;

#[Name('Penny')]
#[Version('1.0.0')]
#[Instructions('Manage the authenticated user\'s Penny finances. First get accounts and allocations to resolve IDs and balances. Monetary amounts are decimal strings, in the same currency as Penny. Negative transaction lines spend funds; positive lines add funds. Normal transaction account and allocation totals must match. Use split_bill for itemized shared receipts. Dates are calendar dates in YYYY-MM-DD format. Only perform financial writes requested by the user.')]
final class PennyServer extends Server
{
    protected array $tools = [
        Tools\CreateTransaction::class,
        Tools\SplitBill::class,
        Tools\EditTransaction::class,
        Tools\DeleteTransaction::class,
        Tools\GetTransactions::class,
        Tools\GetAccounts::class,
        Tools\GetAllocations::class,
    ];
}
