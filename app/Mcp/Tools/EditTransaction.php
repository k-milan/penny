<?php

declare(strict_types=1);

namespace App\Mcp\Tools;

use App\Actions\UpdateTransaction;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;

#[Name('edit_transaction')]
#[Description('Edit your transaction. Omitted fields are preserved; supplied account or allocation arrays replace all lines of that kind. Totals must match. Bill split transactions must be deleted and recreated to preserve their itemized split.')]
#[IsDestructive]
final class EditTransaction extends PennyTool
{
    public function handle(Request $request, UpdateTransaction $action): Response
    {
        $transaction = $this->transaction($request);
        if ($transaction->billSplit()->exists()) {
            throw ValidationException::withMessages(['transaction_id' => 'Delete and recreate bill split transactions to change them.']);
        }
        $existing = [
            'date' => $transaction->date->format('Y-m-d'),
            'description' => $transaction->description,
            'note' => $transaction->note,
            'bill_allocation_id' => $transaction->bill_allocation_id,
            'bill_period_id' => $transaction->bill_period_id,
            'accounts' => $transaction->transactionAccounts->map->only(['account_id', 'amount'])->all(),
            'allocations' => $transaction->transactionAllocations->map->only(['allocation_id', 'amount'])->all(),
        ];
        /** @var array<string, mixed> $changes */
        $changes = $request->only(['date', 'description', 'note', 'accounts', 'allocations']);
        $data = $this->validatedTransaction(array_replace($existing, $changes));

        return $this->result($action->handle($transaction, $data));
    }

    public function schema(JsonSchema $schema): array
    {
        return ['transaction_id' => $schema->integer()->required(), ...$this->transactionSchema($schema, false)];
    }
}
