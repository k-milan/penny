<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\EnsureBillPeriodsForUser;
use App\Enums\AllocationType;
use App\Http\Requests\UpdateBillPeriodRequest;
use App\Models\Allocation;
use App\Models\BillPeriod;
use App\Models\Transaction;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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

        $bills = Allocation::query()
            ->where('user_id', $user->id)
            ->where('type', AllocationType::Bill)
            ->whereNotNull('due_day')
            ->orderBy('name')
            ->get();

        $firstPeriod = $today->startOfMonth()->subMonths(5);
        $lastPeriod = $today->startOfMonth()->addMonths(2);
        $periods = BillPeriod::query()
            ->where('user_id', $user->id)
            ->whereBetween('period', [$firstPeriod->toDateString(), $lastPeriod->toDateString()])
            ->get()
            ->keyBy(static fn (BillPeriod $period): string => $period->allocation_id.'|'.$period->period->format('Y-m'));

        $payments = Transaction::query()
            ->where('user_id', $user->id)
            ->whereNotNull('bill_allocation_id')
            ->whereBetween('date', [$firstPeriod->toDateString(), $lastPeriod->endOfMonth()->toDateString()])
            ->get()
            ->groupBy(static fn (Transaction $transaction): string => $transaction->bill_allocation_id.'|'.$transaction->date->format('Y-m'))
            ->map(static fn ($transactions): string => $transactions->reduce(
                static fn (string $sum, Transaction $transaction): string => bcadd($sum, (string) $transaction->bill_payment_amount, 2),
                '0.00',
            ));

        $months = [];
        for ($offset = 0; $offset < 8; $offset++) {
            $month = $firstPeriod->addMonthsNoOverflow($offset);
            $cells = [];
            foreach ($bills as $bill) {
                $key = $bill->id.'|'.$month->format('Y-m');
                $period = $periods->get($key) ?? BillPeriod::query()
                    ->where('allocation_id', $bill->id)
                    ->whereDate('period', $month->toDateString())
                    ->firstOrFail();
                $cells[(string) $bill->id] = [
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
            'bills' => $bills->map(static fn (Allocation $bill): array => [
                'id' => $bill->id,
                'name' => $bill->name,
            ])->values(),
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

        $allocation = $billPeriod->allocation;
        if ($billPeriod->due_date->greaterThanOrEqualTo(today())) {
            $allocation->update([
                'due_date' => $billPeriod->due_date->toDateString(),
                'due_day' => $billPeriod->due_date->day,
            ]);
        }

        return back()->with('success', 'Bill details confirmed.');
    }
}
