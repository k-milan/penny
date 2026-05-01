<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Allocation;
use App\Models\IncomeTemplate;

final readonly class SyncIncomeTemplatePivots
{
    /**
     * @param  list<array{account_id: int, amount: string}>  $accountRows
     * @param  list<array{allocation_id: int, amount: string}>  $allocationRows
     */
    public function handle(
        IncomeTemplate $template,
        array $accountRows,
        array $allocationRows,
    ): void {
        $accountSync = [];
        foreach ($accountRows as $row) {
            $accountSync[(int) $row['account_id']] = [
                'amount' => bcadd('0.00', $row['amount'], 2),
            ];
        }
        $template->accounts()->sync($accountSync);

        $allocationRows = $this->mergeUnallocatedRemainder($template, $allocationRows);

        $allocSync = [];
        foreach ($allocationRows as $row) {
            $allocSync[(int) $row['allocation_id']] = [
                'amount' => bcadd('0.00', $row['amount'], 2),
            ];
        }
        $template->allocations()->sync($allocSync);
    }

    /**
     * Any gap between expected income (per payout) and non–unallocated allocation lines
     * is assigned to the user’s Unallocated bucket. Unallocated must not be passed in
     * explicitly; it is stripped if present and re-derived.
     *
     * @param  list<array{allocation_id: int, amount: string|float|int}>  $allocationRows
     * @return list<array{allocation_id: int, amount: string}>
     */
    private function mergeUnallocatedRemainder(
        IncomeTemplate $template,
        array $allocationRows,
    ): array {
        $unallocatedId = Allocation::query()
            ->where('user_id', $template->user_id)
            ->where('is_unallocated', true)
            ->value('id');
        if ($unallocatedId === null) {
            /** @var list<array{allocation_id: int, amount: string}> */
            return array_map(static function (array $row): array {
                return [
                    'allocation_id' => (int) $row['allocation_id'],
                    'amount' => bcadd('0.00', (string) $row['amount'], 2),
                ];
            }, $allocationRows);
        }

        $uid = (int) $unallocatedId;
        $filtered = [];
        foreach ($allocationRows as $row) {
            if ((int) $row['allocation_id'] === $uid) {
                continue;
            }
            $filtered[] = [
                'allocation_id' => (int) $row['allocation_id'],
                'amount' => bcadd('0.00', (string) $row['amount'], 2),
            ];
        }

        $expected = bcadd('0.00', (string) $template->expected_income, 2);
        $sum = '0.00';
        foreach ($filtered as $row) {
            $sum = bcadd($sum, $row['amount'], 2);
        }
        $remainder = bcsub($expected, $sum, 2);
        if (bccomp($remainder, '0.00', 2) === 1) {
            $filtered[] = ['allocation_id' => $uid, 'amount' => $remainder];
        }

        return $filtered;
    }
}
