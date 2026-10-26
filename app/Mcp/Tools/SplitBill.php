<?php

declare(strict_types=1);

namespace App\Mcp\Tools;

use App\Actions\CreateBillSplit;
use App\Http\Requests\StoreBillSplitRequest;
use App\Http\Resources\TransactionResource;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;

#[Name('split_bill')]
#[Description('Split an itemized bill paid from a non-person account. Assign each item to your allocations, existing person accounts, or new people. Shares default to 1 and support weighted splits. Total must equal quantity times unit_price for all items plus service_charge. Service charge is distributed proportionally; Penny handles rounding and records the transaction.')]
#[IsDestructive(false)]
final class SplitBill extends PennyTool
{
    public function handle(Request $request, CreateBillSplit $action): Response
    {
        $user = $this->user($request);
        $data = $this->validated(StoreBillSplitRequest::class, $request->all());
        $transaction = $action->handle($user, $data);

        return $this->jsonResponse([
            'transaction' => (new TransactionResource($transaction))->resolve(),
            'bill_split' => $transaction->billSplit,
        ]);
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'date' => $schema->string()->description('YYYY-MM-DD.')->required(),
            'description' => $schema->string()->max(255)->required(),
            'note' => $schema->string()->nullable(),
            'payment_account_id' => $schema->integer()->required(),
            'total' => $schema->string()->description('Positive decimal receipt total, including service charge.')->required(),
            'service_charge' => $schema->string()->description('Nonnegative decimal, defaults to 0.'),
            'items' => $schema->array()->min(1)->items($schema->object([
                'description' => $schema->string()->max(255)->required(),
                'quantity' => $schema->integer()->min(1)->required(),
                'unit_price' => $schema->string()->description('Positive decimal price per unit.')->required(),
                'assignees' => $schema->array()->min(1)->items($schema->object([
                    'type' => $schema->string()->enum(['account', 'allocation', 'new_person'])->required(),
                    'id' => $schema->integer()->description('Existing person account or allocation ID.'),
                    'name' => $schema->string()->description('Required for new_person.'),
                    'shares' => $schema->integer()->min(1)->max(100),
                ]))->required(),
            ]))->required(),
        ];
    }
}
