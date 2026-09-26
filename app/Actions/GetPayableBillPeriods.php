<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\BillPeriod;
use App\Models\Transaction;
use App\Models\User;

final readonly class GetPayableBillPeriods
{
    /**
     * @return array<int, array{id: int, bill_key: string, bill_name: string, source_type: string, source_id: int, period: string, due_date: string, due_amount: string|null, paid_amount: string}>
     */
    public function handle(User $user): array
    {
        $paidAmounts = Transaction::query()
            ->where('user_id', $user->id)
            ->whereNotNull('bill_period_id')
            ->selectRaw('bill_period_id, SUM(bill_payment_amount) as paid_amount')
            ->groupBy('bill_period_id')
            ->pluck('paid_amount', 'bill_period_id');

        return BillPeriod::query()
            ->with(['allocation:id,name', 'account:id,name'])
            ->where('user_id', $user->id)
            ->whereNotNull('due_date')
            ->orderBy('period')
            ->orderBy('due_date')
            ->get()
            ->map(function (BillPeriod $period) use ($paidAmounts): array {
                $paidAmount = (string) ($paidAmounts->get($period->id) ?? '0.00');
                $sourceType = $period->allocation_id !== null ? 'allocation' : 'account';
                $sourceId = $period->allocation_id ?? (int) $period->getAttribute('account_id');

                return [
                    'id' => $period->id,
                    'bill_key' => $sourceType.':'.$sourceId,
                    'bill_name' => $period->allocation?->name ?? $period->account?->name ?? 'Bill',
                    'source_type' => $sourceType,
                    'source_id' => $sourceId,
                    'period' => $period->period->format('Y-m'),
                    'due_date' => $period->due_date->format('Y-m-d'),
                    'due_amount' => $period->due_amount === null ? null : (string) $period->due_amount,
                    'paid_amount' => $paidAmount,
                ];
            })
            ->filter(static fn (array $period): bool => $period['due_amount'] === null
                || bccomp($period['paid_amount'], $period['due_amount'], 2) < 0)
            ->values()
            ->all();
    }
}
