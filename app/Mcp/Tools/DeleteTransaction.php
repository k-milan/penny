<?php

declare(strict_types=1);

namespace App\Mcp\Tools;

use App\Actions\DeleteTransaction as DeleteTransactionAction;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;

#[Name('delete_transaction')]
#[Description('Permanently delete your transaction and reverse its account and allocation balance changes.')]
#[IsDestructive]
final class DeleteTransaction extends PennyTool
{
    public function handle(Request $request, DeleteTransactionAction $action): Response
    {
        $transaction = $this->transaction($request);
        $id = $transaction->id;
        $action->handle($transaction);

        return $this->jsonResponse(['deleted_transaction_id' => $id]);
    }

    public function schema(JsonSchema $schema): array
    {
        return ['transaction_id' => $schema->integer()->required()];
    }
}
