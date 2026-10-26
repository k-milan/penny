<?php

declare(strict_types=1);

namespace App\Mcp\Tools;

use App\Actions\CreateTransaction as CreateTransactionAction;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;

#[Name('create_transaction')]
#[Description('Create a normal transaction using signed account and allocation lines. Account and allocation totals must match. At least one line is required. Use get_accounts and get_allocations to find IDs.')]
#[IsDestructive(false)]
final class CreateTransaction extends PennyTool
{
    public function handle(Request $request, CreateTransactionAction $action): Response
    {
        $user = $this->user($request);
        $data = $this->validatedTransaction($request->all());

        return $this->result($action->handle($user, $data));
    }

    public function schema(JsonSchema $schema): array
    {
        return $this->transactionSchema($schema);
    }
}
