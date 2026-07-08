<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\AdvanceBillDueDatesForUser;
use App\Http\Resources\AccountResource;
use App\Http\Resources\AllocationResource;
use App\Http\Resources\TransactionResource;
use App\Models\Account;
use App\Models\Allocation;
use App\Models\Transaction;
use App\Models\User;
use App\Support\UnallocatedAmount;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

final readonly class DashboardController
{
    public function __invoke(Request $request, AdvanceBillDueDatesForUser $advanceBillDueDates): Response
    {
        $user = $request->user();
        assert($user instanceof User);

        $advanceBillDueDates->handle($user);

        $accounts = Account::query()
            ->where('user_id', $user->id)
            ->orderByDesc('is_pinned')
            ->orderBy('name', 'asc')
            ->get();

        $allocations = Allocation::query()
            ->where('user_id', $user->id)
            ->orderByDesc('is_pinned')
            ->orderBy('name', 'asc')
            ->get();

        $unallocatedAllocationId = Allocation::query()
            ->where('user_id', $user->id)
            ->where('is_unallocated', true)
            ->value('id');

        return Inertia::render('dashboard', [
            'accounts' => AccountResource::collection($accounts)->resolve(),
            'allocations' => AllocationResource::collection($allocations)->resolve(),
            'unallocated' => UnallocatedAmount::forUserId($user->id),
            'unallocated_allocation_id' => $unallocatedAllocationId !== null
                ? (int) $unallocatedAllocationId
                : null,
            'stats' => Inertia::defer(
                fn (): array => $this->resolveDashboardStats(
                    $user,
                    $accounts,
                    $allocations->where('is_unallocated', false)->values()
                ),
                'dashboard',
            ),
            'recentTransactions' => Inertia::scroll(
                static function () use ($user) {
                    $paginator = Transaction::query()
                        ->where('user_id', $user->id)
                        ->with([
                            'transactionAccounts.account',
                            'transactionAllocations.allocation',
                        ])
                        ->orderByDesc('date')
                        ->orderByDesc('created_at')
                        ->orderByDesc('id')
                        ->paginate(10, ['*'], 'recent_transactions');

                    return $paginator->through(
                        static fn (Transaction $transaction): array => (new TransactionResource($transaction))->resolve(request())
                    );
                }
            )->defer('dashboard'),
        ]);
    }

    /**
     * @param  EloquentCollection<int, Account>  $accounts
     * @param  EloquentCollection<int, Allocation>  $allocations
     * @return array<string, mixed>
     */
    private function resolveDashboardStats(User $user, EloquentCollection $accounts, EloquentCollection $allocations): array
    {
        $accountBalanceTotal = '0.00';
        foreach ($accounts as $account) {
            $accountBalanceTotal = bcadd($accountBalanceTotal, bcadd('0.00', (string) $account->balance, 2), 2);
        }

        $allocationBalanceTotal = '0.00';
        foreach ($allocations as $allocation) {
            $allocationBalanceTotal = bcadd($allocationBalanceTotal, bcadd('0.00', (string) $allocation->balance, 2), 2);
        }

        $transactionCount = Transaction::query()
            ->where('user_id', $user->id)
            ->count();

        $now = CarbonImmutable::now();
        $cashFlowToday = $this->sumAccountIncomeExpenseBetween($user, $now->startOfDay(), $now->endOfDay());
        $cashFlowLast7Days = $this->sumAccountIncomeExpenseBetween(
            $user,
            $now->subDays(6)->startOfDay(),
            $now->endOfDay(),
        );
        $cashFlowLast30Days = $this->sumAccountIncomeExpenseBetween(
            $user,
            $now->subDays(29)->startOfDay(),
            $now->endOfDay(),
        );

        $activityStart = CarbonImmutable::now()->subDays(6)->startOfDay()->toDateString();

        /** @var array<string, array{income: string, expense: string}> $flowsKeyedByYmd */
        $flowsKeyedByYmd = [];
        $flowRows = DB::table('transaction_accounts')
            ->join('transactions', 'transactions.id', '=', 'transaction_accounts.transaction_id')
            ->where('transactions.user_id', $user->id)
            ->whereDate('transactions.date', '>=', $activityStart)
            ->select(['transactions.date', 'transaction_accounts.amount'])
            ->get();

        foreach ($flowRows as $row) {
            $dateStr = CarbonImmutable::parse((string) $row->date)->toDateString();
            if (! isset($flowsKeyedByYmd[$dateStr])) {
                $flowsKeyedByYmd[$dateStr] = [
                    'income' => '0.00',
                    'expense' => '0.00',
                ];
            }
            $amt = bcadd('0.00', (string) $row->amount, 2);
            if (bccomp($amt, '0', 2) > 0) {
                $flowsKeyedByYmd[$dateStr]['income'] = bcadd($flowsKeyedByYmd[$dateStr]['income'], $amt, 2);
            } elseif (bccomp($amt, '0', 2) < 0) {
                $flowsKeyedByYmd[$dateStr]['expense'] = bcadd(
                    $flowsKeyedByYmd[$dateStr]['expense'],
                    bcmul($amt, '-1', 2),
                    2
                );
            }
        }

        $activityLast7Days = [];
        for ($i = 6; $i >= 0; $i--) {
            $day = CarbonImmutable::now()->subDays($i)->toDateString();
            $flow = $flowsKeyedByYmd[$day] ?? ['income' => '0.00', 'expense' => '0.00'];
            $activityLast7Days[] = [
                'date' => $day,
                'income' => $flow['income'],
                'expense' => $flow['expense'],
            ];
        }

        return [
            'account_balance_total' => $accountBalanceTotal,
            'allocation_balance_total' => $allocationBalanceTotal,
            'transaction_count' => $transactionCount,
            'cash_flow' => [
                'today' => $cashFlowToday,
                'last_7_days' => $cashFlowLast7Days,
                'last_30_days' => $cashFlowLast30Days,
            ],
            'activity_last_7_days' => $activityLast7Days,
        ];
    }

    /**
     * Income / expense from account lines (same basis as the activity chart): credits as income, debits as expense.
     *
     * @return array{income: string, expense: string}
     */
    private function sumAccountIncomeExpenseBetween(
        User $user,
        CarbonImmutable $startDateInclusive,
        CarbonImmutable $endDateInclusive,
    ): array {
        $row = DB::table('transaction_accounts')
            ->join('transactions', 'transactions.id', '=', 'transaction_accounts.transaction_id')
            ->where('transactions.user_id', $user->id)
            ->whereDate('transactions.date', '>=', $startDateInclusive->toDateString())
            ->whereDate('transactions.date', '<=', $endDateInclusive->toDateString())
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN transaction_accounts.amount > 0 THEN transaction_accounts.amount ELSE 0 END), 0) as income_sum, '.
                'COALESCE(SUM(CASE WHEN transaction_accounts.amount < 0 THEN -transaction_accounts.amount ELSE 0 END), 0) as expense_sum'
            )
            ->first();

        return [
            'income' => bcadd('0.00', $row !== null && $row->income_sum !== null ? (string) $row->income_sum : '0', 2),
            'expense' => bcadd('0.00', $row !== null && $row->expense_sum !== null ? (string) $row->expense_sum : '0', 2),
        ];
    }
}
