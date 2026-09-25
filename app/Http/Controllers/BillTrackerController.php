<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\EnsureBillPeriodsForUser;
use App\Enums\AccountType;
use App\Enums\AllocationType;
use App\Http\Requests\UpdateBillPeriodRequest;
use App\Models\Account;
use App\Models\Allocation;
use App\Models\BillPeriod;
use App\Models\Transaction;
use App\Models\TransactionAccount;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;

final readonly class BillTrackerController
{
    public function index(Request $request, EnsureBillPeriodsForUser $ensureBillPeriods): Response
    {
        $user = $request->user();
        assert($user instanceof User);

        $today = CarbonImmutable::today();
        $ensureBillPeriods->handle($user, $today);

        $allocationBills = Allocation::query()
            ->where('user_id', $user->id)
            ->where('type', AllocationType::Bill)
            ->whereNotNull('due_day')
            ->orderBy('name')
            ->get();
        $supportsCreditCardBills = Schema::hasColumn('accounts', 'due_day')
            && Schema::hasColumn('bill_periods', 'account_id');
        $creditCards = $supportsCreditCardBills
            ? Account::query()
                ->where('user_id', $user->id)
                ->where('type', AccountType::CreditCard)
                ->orderBy('name')
                ->get()
            : collect();
        $bills = $allocationBills
            ->map(static fn (Allocation $bill): array => [
                'key' => 'allocation:'.$bill->id,
                'source_type' => 'allocation',
                'source_id' => $bill->id,
                'name' => $bill->name,
            ])
            ->concat($creditCards->map(static fn (Account $card): array => [
                'key' => 'account:'.$card->id,
                'source_type' => 'account',
                'source_id' => $card->id,
                'name' => $card->name,
            ]))
            ->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        $firstPeriod = $today->startOfMonth()->subMonths(5);
        $lastPeriod = $today->startOfMonth()->addMonths(2);
        $periods = BillPeriod::query()
            ->where('user_id', $user->id)
            ->whereBetween('period', [$firstPeriod->toDateString(), $lastPeriod->toDateString()])
            ->get()
            ->keyBy(static fn (BillPeriod $period): string => ($period->allocation_id !== null
                ? 'allocation:'.$period->allocation_id
                : 'account:'.$period->getAttribute('account_id')).'|'.$period->period->format('Y-m'));

        $allocationPayments = Transaction::query()
            ->where('user_id', $user->id)
            ->whereNotNull('bill_allocation_id')
            ->whereBetween('date', [$firstPeriod->toDateString(), $lastPeriod->endOfMonth()->toDateString()])
            ->get()
            ->groupBy(static fn (Transaction $transaction): string => 'allocation:'.$transaction->bill_allocation_id.'|'.$transaction->date->format('Y-m'))
            ->map(static fn ($transactions): string => $transactions->reduce(
                static fn (string $sum, Transaction $transaction): string => bcadd($sum, (string) $transaction->bill_payment_amount, 2),
                '0.00',
            ));
        $creditCardPayments = TransactionAccount::query()
            ->with('transaction:id,date')
            ->whereIn('account_id', $creditCards->pluck('id'))
            ->where('amount', '>', 0)
            ->whereHas('transaction', fn ($query) => $query
                ->where('user_id', $user->id)
                ->whereBetween('date', [$firstPeriod->toDateString(), $lastPeriod->endOfMonth()->toDateString()]))
            ->get()
            ->groupBy(static fn (TransactionAccount $line): string => 'account:'.$line->account_id.'|'.$line->transaction->date->format('Y-m'))
            ->map(static fn ($lines): string => $lines->reduce(
                static fn (string $sum, TransactionAccount $line): string => bcadd($sum, (string) $line->amount, 2),
                '0.00',
            ));
        $payments = collect($allocationPayments->all())->merge($creditCardPayments);

        $months = [];
        for ($offset = 0; $offset < 8; $offset++) {
            $month = $firstPeriod->addMonthsNoOverflow($offset);
            $cells = [];
            foreach ($bills as $bill) {
                $key = $bill['key'].'|'.$month->format('Y-m');
                $period = $periods->get($key) ?? BillPeriod::query()
                    ->when(
                        $bill['source_type'] === 'allocation',
                        fn ($query) => $query->where('allocation_id', $bill['source_id']),
                        fn ($query) => $query->where('account_id', $bill['source_id']),
                    )
                    ->whereDate('period', $month->toDateString())
                    ->firstOrFail();
                $cells[$bill['key']] = [
                    'id' => $period->id,
                    'due_date' => $period->due_date->format('Y-m-d'),
                    'due_amount' => $period->due_amount,
                    'paid_amount' => $payments->get($key, '0.00'),
                    'confirmed' => $period->confirmed_at !== null,
                    'needs_confirmation' => $period->confirmed_at === null
                        && $today->betweenIncluded($period->due_date->copy()->subDays(14), $period->due_date),
                ];
            }

            $months[] = [
                'key' => $month->format('Y-m'),
                'label' => $month->format('F Y'),
                'is_current' => $month->isSameMonth($today),
                'bills' => $cells,
            ];
        }

        return Inertia::render('bills/index', [
            'bills' => $bills,
            'months' => $months,
        ]);
    }

    public function update(UpdateBillPeriodRequest $request, BillPeriod $billPeriod): RedirectResponse
    {
        /** @var array{due_date: string, due_amount: int|float|string} $data */
        $data = $request->validated();
        $billPeriod->update([
            'due_date' => $data['due_date'],
            'due_amount' => (string) $data['due_amount'],
            'confirmed_at' => now(),
        ]);

        if ($billPeriod->due_date->greaterThanOrEqualTo(today())) {
            $billPeriod->allocation?->update([
                'due_date' => $billPeriod->due_date->toDateString(),
                'due_day' => $billPeriod->due_date->day,
            ]);
            if (Schema::hasColumn('bill_periods', 'account_id')) {
                $billPeriod->account?->update([
                    'due_date' => $billPeriod->due_date->toDateString(),
                    'due_day' => $billPeriod->due_date->day,
                ]);
            }
        }

        return back()->with('success', 'Bill details confirmed.');
    }
}
