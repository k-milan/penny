<?php

declare(strict_types=1);

namespace App\Mcp\Tools;

use App\Http\Resources\TransactionResource;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('get_transactions')]
#[Description('Get your transactions, newest first. Filter by exact date or inclusive date_from/date_to, account_ids and allocation_ids. IDs within each list match ANY; account and allocation filters combine with AND. Returns paginated results including signed lines. Dates use YYYY-MM-DD.')]
#[IsReadOnly]
final class GetTransactions extends PennyTool
{
    public function handle(Request $request): Response
    {
        $user = $this->user($request);
        /** @var array{date?: string, date_from?: string, date_to?: string, account_ids?: list<int>, allocation_ids?: list<int>, page?: int, per_page?: int} $data */
        $data = $request->validate([
            'date' => ['sometimes', 'date_format:Y-m-d'],
            'date_from' => ['sometimes', 'date_format:Y-m-d'],
            'date_to' => ['sometimes', 'date_format:Y-m-d', ...($request->has('date_from') ? ['after_or_equal:date_from'] : [])],
            'account_ids' => ['sometimes', 'array', 'min:1'],
            'account_ids.*' => ['integer', Rule::exists('accounts', 'id')->where('user_id', $user->id)],
            'allocation_ids' => ['sometimes', 'array', 'min:1'],
            'allocation_ids.*' => ['integer', Rule::exists('allocations', 'id')->where('user_id', $user->id)],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);
        $query = $user->transactions()->with('transactionAccounts.account', 'transactionAllocations.allocation');
        if (isset($data['date'])) {
            $query->whereDate('date', $data['date']);
        }
        if (isset($data['date_from'])) {
            $query->whereDate('date', '>=', $data['date_from']);
        }
        if (isset($data['date_to'])) {
            $query->whereDate('date', '<=', $data['date_to']);
        }
        if (isset($data['account_ids'])) {
            $query->whereHas('transactionAccounts', fn ($lines) => $lines->whereIn('account_id', $data['account_ids']));
        }
        if (isset($data['allocation_ids'])) {
            $query->whereHas('transactionAllocations', fn ($lines) => $lines->whereIn('allocation_id', $data['allocation_ids']));
        }
        $page = $query->latest('date')->latest('id')->paginate($data['per_page'] ?? 25, ['*'], 'page', $data['page'] ?? 1);

        return $this->jsonResponse([
            'transactions' => TransactionResource::collection($page->getCollection())->resolve(),
            'pagination' => [
                'page' => $page->currentPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'last_page' => $page->lastPage(),
            ],
        ]);
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'date' => $schema->string()->description('Exact date, YYYY-MM-DD.'),
            'date_from' => $schema->string()->description('Inclusive start date, YYYY-MM-DD.'),
            'date_to' => $schema->string()->description('Inclusive end date, YYYY-MM-DD.'),
            'account_ids' => $schema->array()->items($schema->integer())->min(1),
            'allocation_ids' => $schema->array()->items($schema->integer())->min(1),
            'page' => $schema->integer()->min(1),
            'per_page' => $schema->integer()->min(1)->max(100),
        ];
    }
}
