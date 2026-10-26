<?php

declare(strict_types=1);

namespace App\Mcp\Tools;

use App\Http\Requests\StoreBillSplitRequest;
use App\Http\Requests\StoreTransactionRequest;
use App\Http\Resources\TransactionResource;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Tool;

abstract class PennyTool extends Tool
{
    protected function user(Request $request): User
    {
        $user = $request->user();
        if (! $user instanceof User) {
            throw ValidationException::withMessages(['authentication' => 'Authentication is required.']);
        }

        return $user;
    }

    protected function transaction(Request $request): Transaction
    {
        $user = $this->user($request);
        /** @var array{transaction_id: int} $data */
        $data = $request->validate(['transaction_id' => ['required', 'integer', 'min:1']]);
        $transaction = $user->transactions()->with('transactionAccounts.account', 'transactionAllocations.allocation')->find($data['transaction_id']);
        if ($transaction === null) {
            throw ValidationException::withMessages(['transaction_id' => 'Transaction not found.']);
        }

        return $transaction;
    }

    /**
     * @param  class-string<FormRequest>  $requestClass
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function validated(string $requestClass, array $data): array
    {
        if ($requestClass === StoreTransactionRequest::class) {
            Validator::make($data, [
                'accounts' => ['sometimes', 'array'],
                'accounts.*' => ['array'],
                'accounts.*.amount' => ['required', 'regex:/^-?[0-9]{1,13}(\.[0-9]{1,2})?$/D'],
                'allocations' => ['sometimes', 'array'],
                'allocations.*' => ['array'],
                'allocations.*.amount' => ['required', 'regex:/^-?[0-9]{1,13}(\.[0-9]{1,2})?$/D'],
            ])->validate();
        }
        if ($requestClass === StoreBillSplitRequest::class) {
            Validator::make($data, [
                'total' => ['required', 'regex:/^[0-9]{1,13}(\.[0-9]{1,2})?$/D'],
                'service_charge' => ['sometimes', 'nullable', 'regex:/^[0-9]{1,13}(\.[0-9]{1,2})?$/D'],
                'items.*.unit_price' => ['required', 'regex:/^[0-9]{1,13}(\.[0-9]{1,2})?$/D'],
            ])->validate();
        }
        $form = $requestClass::create('/', 'POST', $data);
        $form->setContainer(app())->setRedirector(app('redirect'));
        $form->setUserResolver(fn () => auth()->user());
        $form->validateResolved();

        return $form->validated();
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{date: string, description: string, note: string|null, bill_allocation_id?: int|null, bill_period_id?: int|null, accounts: array<int, array{account_id: int, amount: int|float|string}>, allocations: array<int, array{allocation_id: int, amount: int|float|string}>}
     */
    protected function validatedTransaction(array $data): array
    {
        /** @var array{date: string, description: string, note: string|null, bill_allocation_id?: int|null, bill_period_id?: int|null, accounts: array<int, array{account_id: int, amount: int|float|string}>, allocations: array<int, array{allocation_id: int, amount: int|float|string}>} $validated */
        $validated = $this->validated(StoreTransactionRequest::class, array_replace(['note' => null], $data));

        return $validated;
    }

    /** @param array<string, mixed> $data */
    protected function jsonResponse(array $data): Response
    {
        return Response::text(json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    }

    protected function result(Transaction $transaction): Response
    {
        return $this->jsonResponse(['transaction' => (new TransactionResource($transaction))->resolve()]);
    }

    /** @return array<string, mixed> */
    protected function transactionSchema(JsonSchema $schema, bool $required = true): array
    {
        $fields = [
            'date' => $schema->string()->description('Transaction date, YYYY-MM-DD.'),
            'description' => $schema->string()->max(255),
            'note' => $schema->string()->nullable(),
            'accounts' => $schema->array()->items($schema->object([
                'account_id' => $schema->integer()->required(),
                'amount' => $schema->string()->description('Signed decimal with at most 13 integer digits and 2 decimal places: negative spends, positive receives.')->required(),
            ])),
            'allocations' => $schema->array()->items($schema->object([
                'allocation_id' => $schema->integer()->required(),
                'amount' => $schema->string()->description('Signed decimal with at most 13 integer digits and 2 decimal places: negative spends, positive adds funds.')->required(),
            ])),
        ];
        if ($required) {
            $fields['date']->required();
            $fields['description']->required();
        }

        return $fields;
    }
}
