<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\Allocation;
use App\Models\IncomeTemplate;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final readonly class IncomeFromTemplateController
{
    public function create(Request $request): Response
    {
        $user = $request->user();
        assert($user instanceof User);

        $incomeTemplates = IncomeTemplate::query()
            ->where('user_id', $user->id)
            ->with(['accounts', 'allocations'])
            ->orderBy('name')
            ->orderBy('version')
            ->get()
            ->map(static function (IncomeTemplate $t): array {
                return [
                    'id' => $t->id,
                    'name' => $t->name,
                    'version' => $t->version,
                    'description' => $t->description,
                    'company_name' => $t->company_name,
                    'payout_frequency' => $t->payout_frequency->value,
                    'payout_frequency_label' => $t->payout_frequency->label(),
                    'expected_income' => (string) $t->expected_income,
                    'accounts' => $t->accounts->map(static fn (Account $a): array => [
                        'account_id' => $a->id,
                        'amount' => (string) $a->pivot->amount,
                    ])->values()->all(),
                    'allocations' => $t->allocations->map(static fn (Allocation $a): array => [
                        'allocation_id' => $a->id,
                        'amount' => (string) $a->pivot->amount,
                        'is_unallocated' => $a->is_unallocated,
                    ])->values()->all(),
                ];
            })
            ->values()
            ->all();

        $accounts = Account::query()
            ->where('user_id', $user->id)
            ->orderByDesc('is_pinned')
            ->orderBy('name', 'asc')
            ->get(['id', 'name', 'type', 'balance', 'is_pinned'])
            ->map(static fn (Account $a): array => [
                'id' => $a->id,
                'name' => $a->name,
                'type' => $a->type->value,
                'balance' => (string) $a->balance,
                'is_pinned' => (bool) $a->is_pinned,
            ])
            ->values()
            ->all();

        $allocations = Allocation::query()
            ->where('user_id', $user->id)
            ->where('is_unallocated', false)
            ->orderByDesc('is_pinned')
            ->orderBy('name', 'asc')
            ->get(['id', 'name', 'type', 'balance', 'is_pinned'])
            ->map(static fn (Allocation $a): array => [
                'id' => $a->id,
                'name' => $a->name,
                'type' => $a->type->value,
                'balance' => (string) $a->balance,
                'is_pinned' => (bool) $a->is_pinned,
            ])
            ->values()
            ->all();

        $unallocatedAllocationId = Allocation::query()
            ->where('user_id', $user->id)
            ->where('is_unallocated', true)
            ->value('id');

        return Inertia::render('transactions/income-from-template', [
            'incomeTemplates' => $incomeTemplates,
            'accounts' => $accounts,
            'allocations' => $allocations,
            'unallocated_allocation_id' => $unallocatedAllocationId !== null
                ? (int) $unallocatedAllocationId
                : null,
        ]);
    }
}
