<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\CreateIncomeTemplate;
use App\Actions\DeleteIncomeTemplate;
use App\Actions\UpdateIncomeTemplate;
use App\Enums\IncomePayoutFrequency;
use App\Http\Requests\StoreIncomeTemplateRequest;
use App\Http\Requests\UpdateIncomeTemplateRequest;
use App\Models\Account;
use App\Models\Allocation;
use App\Models\IncomeTemplate;
use App\Models\IncomeTemplateSeries;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final readonly class IncomeTemplateController
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        assert($user instanceof User);

        $seriesRows = IncomeTemplateSeries::query()
            ->where('user_id', $user->id)
            ->with([
                'incomeTemplates' => static function ($q): void {
                    $q->orderBy('version')
                        ->withCount(['accounts', 'allocations']);
                },
            ])
            ->orderBy('id')
            ->get();

        $incomeTemplateSeries = $seriesRows->map(
            static function (IncomeTemplateSeries $series): array {
                return [
                    'id' => $series->id,
                    'versions' => $series->incomeTemplates->map(
                        static function (IncomeTemplate $t): array {
                            return [
                                'id' => $t->id,
                                'version' => $t->version,
                                'name' => $t->name,
                                'company_name' => $t->company_name,
                                'description' => $t->description,
                                'payout_frequency' => $t->payout_frequency->value,
                                'payout_frequency_label' => $t->payout_frequency->label(),
                                'expected_income' => (string) $t->expected_income,
                                'accounts_count' => $t->accounts_count,
                                'allocations_count' => $t->allocations_count,
                            ];
                        },
                    )->values()->all(),
                ];
            },
        )->values()->all();

        return Inertia::render('incomes/index', [
            'incomeTemplateSeries' => $incomeTemplateSeries,
        ]);
    }

    public function create(Request $request): Response
    {
        $user = $request->user();
        assert($user instanceof User);

        $prefill = null;
        $seriesIdForNewVersion = null;

        $versionOf = $request->query('version_of');
        if ($versionOf !== null && $versionOf !== '') {
            $base = IncomeTemplate::query()
                ->where('user_id', $user->id)
                ->whereKey((int) $versionOf)
                ->with(['accounts', 'allocations'])
                ->first();
            if ($base !== null) {
                $seriesIdForNewVersion = $base->series_id;
                $prefill = [
                    'name' => $base->name,
                    'description' => $base->description ?? '',
                    'company_name' => $base->company_name ?? '',
                    'payout_frequency' => $base->payout_frequency->value,
                    'expected_income' => (string) $base->expected_income,
                    'accounts' => $base->accounts->map(static fn (Account $a): array => [
                        'account_id' => $a->id,
                        'amount' => (string) $a->pivot->amount,
                    ])->values()->all(),
                    'allocations' => self::visibleAllocationPivotLines($base->allocations),
                ];
            }
        }

        return Inertia::render('incomes/create', [
            'accounts' => Account::query()
                ->where('user_id', $user->id)
                ->orderBy('name', 'asc')
                ->get(['id', 'name'])
                ->map(static fn (Account $a): array => [
                    'id' => $a->id,
                    'name' => $a->name,
                ])
                ->values()
                ->all(),
            'allocations' => Allocation::query()
                ->where('user_id', $user->id)
                ->where('is_unallocated', false)
                ->orderBy('name', 'asc')
                ->get(['id', 'name'])
                ->map(static fn (Allocation $a): array => [
                    'id' => $a->id,
                    'name' => $a->name,
                ])
                ->values()
                ->all(),
            'payoutFrequencies' => self::payoutFrequencyOptions(),
            'prefill' => $prefill,
            'seriesIdForNewVersion' => $seriesIdForNewVersion,
            'unallocated_allocation_id' => self::unallocatedAllocationIdForUser($user),
        ]);
    }

    public function store(StoreIncomeTemplateRequest $request, CreateIncomeTemplate $action): RedirectResponse
    {
        $user = $request->user();
        assert($user instanceof User);

        /** @var array{name: string, description?: string|null, company_name?: string|null, payout_frequency: string, expected_income: float|int|string, series_id?: int|null, accounts?: list<array{account_id: int, amount: string|float|int}>, allocations?: list<array{allocation_id: int, amount: string|float|int}>} $data */
        $data = $request->validated();
        $accounts = collect($data['accounts'] ?? [])->map(static function (array $row): array {
            return [
                'account_id' => (int) $row['account_id'],
                'amount' => bcadd('0.00', (string) $row['amount'], 2),
            ];
        })->all();
        $allocations = collect($data['allocations'] ?? [])->map(static function (array $row): array {
            return [
                'allocation_id' => (int) $row['allocation_id'],
                'amount' => bcadd('0.00', (string) $row['amount'], 2),
            ];
        })->all();

        $action->handle($user, [
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'company_name' => $data['company_name'] ?? null,
            'payout_frequency' => $data['payout_frequency'],
            'expected_income' => $data['expected_income'],
            'series_id' => $data['series_id'] ?? null,
            'accounts' => $accounts,
            'allocations' => $allocations,
        ]);

        return redirect()->route('income-templates.index')
            ->with('success', 'Income template saved.');
    }

    public function edit(Request $request, IncomeTemplate $incomeTemplate): Response
    {
        $user = $request->user();
        assert($user instanceof User);

        $incomeTemplate->load(['accounts', 'allocations', 'series.incomeTemplates']);

        $seriesVersions = $incomeTemplate->series->incomeTemplates
            ->map(static fn (IncomeTemplate $t): array => [
                'id' => $t->id,
                'version' => $t->version,
                'name' => $t->name,
            ])
            ->values()
            ->all();

        return Inertia::render('incomes/edit', [
            'incomeTemplate' => [
                'id' => $incomeTemplate->id,
                'series_id' => $incomeTemplate->series_id,
                'version' => $incomeTemplate->version,
                'name' => $incomeTemplate->name,
                'description' => $incomeTemplate->description ?? '',
                'company_name' => $incomeTemplate->company_name ?? '',
                'payout_frequency' => $incomeTemplate->payout_frequency->value,
                'expected_income' => (string) $incomeTemplate->expected_income,
                'accounts' => $incomeTemplate->accounts->map(static fn (Account $a): array => [
                    'account_id' => $a->id,
                    'amount' => (string) $a->pivot->amount,
                ])->values()->all(),
                'allocations' => self::visibleAllocationPivotLines($incomeTemplate->allocations),
            ],
            'seriesVersions' => $seriesVersions,
            'accounts' => Account::query()
                ->where('user_id', $user->id)
                ->orderBy('name', 'asc')
                ->get(['id', 'name'])
                ->map(static fn (Account $a): array => [
                    'id' => $a->id,
                    'name' => $a->name,
                ])
                ->values()
                ->all(),
            'allocations' => Allocation::query()
                ->where('user_id', $user->id)
                ->where('is_unallocated', false)
                ->orderBy('name', 'asc')
                ->get(['id', 'name'])
                ->map(static fn (Allocation $a): array => [
                    'id' => $a->id,
                    'name' => $a->name,
                ])
                ->values()
                ->all(),
            'payoutFrequencies' => self::payoutFrequencyOptions(),
            'unallocated_allocation_id' => self::unallocatedAllocationIdForUser($user),
        ]);
    }

    public function update(UpdateIncomeTemplateRequest $request, IncomeTemplate $incomeTemplate, UpdateIncomeTemplate $action): RedirectResponse
    {
        /** @var array{name: string, description?: string|null, company_name?: string|null, payout_frequency: string, expected_income: float|int|string, accounts?: list<array{account_id: int, amount: string|float|int}>, allocations?: list<array{allocation_id: int, amount: string|float|int}>} $data */
        $data = $request->validated();
        $accounts = collect($data['accounts'] ?? [])->map(static function (array $row): array {
            return [
                'account_id' => (int) $row['account_id'],
                'amount' => bcadd('0.00', (string) $row['amount'], 2),
            ];
        })->all();
        $allocations = collect($data['allocations'] ?? [])->map(static function (array $row): array {
            return [
                'allocation_id' => (int) $row['allocation_id'],
                'amount' => bcadd('0.00', (string) $row['amount'], 2),
            ];
        })->all();

        $action->handle($incomeTemplate, [
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'company_name' => $data['company_name'] ?? null,
            'payout_frequency' => $data['payout_frequency'],
            'expected_income' => $data['expected_income'],
            'accounts' => $accounts,
            'allocations' => $allocations,
        ]);

        return redirect()->route('income-templates.index')
            ->with('success', 'Income template updated.');
    }

    public function destroy(IncomeTemplate $incomeTemplate, DeleteIncomeTemplate $action): RedirectResponse
    {
        $action->handle($incomeTemplate);

        return redirect()->route('income-templates.index')
            ->with('success', 'Income template deleted.');
    }

    /**
     * @param  EloquentCollection<int, Allocation>  $allocations
     * @return list<array{allocation_id: int, amount: string}>
     */
    private static function visibleAllocationPivotLines(EloquentCollection $allocations): array
    {
        return $allocations
            ->filter(static fn (Allocation $a): bool => ! $a->is_unallocated)
            ->map(static fn (Allocation $a): array => [
                'allocation_id' => $a->id,
                'amount' => (string) $a->pivot->amount,
            ])
            ->values()
            ->all();
    }

    private static function unallocatedAllocationIdForUser(User $user): ?int
    {
        $id = Allocation::query()
            ->where('user_id', $user->id)
            ->where('is_unallocated', true)
            ->value('id');

        return $id !== null ? (int) $id : null;
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    private static function payoutFrequencyOptions(): array
    {
        return array_values(array_map(
            static fn (IncomePayoutFrequency $c): array => [
                'value' => $c->value,
                'label' => $c->label(),
            ],
            IncomePayoutFrequency::cases(),
        ));
    }
}
