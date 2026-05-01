<?php

declare(strict_types=1);

namespace App\Actions;

use App\Enums\IncomePayoutFrequency;
use App\Models\IncomeTemplate;
use Illuminate\Support\Facades\DB;

final readonly class UpdateIncomeTemplate
{
    public function __construct(private SyncIncomeTemplatePivots $syncPivots) {}

    /**
     * @param  array{
     *     name: string,
     *     description?: string|null,
     *     company_name?: string|null,
     *     payout_frequency: IncomePayoutFrequency|string,
     *     expected_income: float|int|string,
     *     accounts?: list<array{account_id: int, amount: string}>,
     *     allocations?: list<array{allocation_id: int, amount: string}>,
     * }  $attributes
     */
    public function handle(IncomeTemplate $template, array $attributes): void
    {
        DB::transaction(function () use ($template, $attributes): void {
            $frequency = $attributes['payout_frequency'] instanceof IncomePayoutFrequency
                ? $attributes['payout_frequency']
                : IncomePayoutFrequency::from((string) $attributes['payout_frequency']);

            $template->update([
                'name' => $attributes['name'],
                'description' => $attributes['description'] ?? null,
                'company_name' => $attributes['company_name'] ?? null,
                'payout_frequency' => $frequency,
                'expected_income' => bcadd('0.00', (string) $attributes['expected_income'], 2),
            ]);

            $this->syncPivots->handle(
                $template,
                $attributes['accounts'] ?? [],
                $attributes['allocations'] ?? [],
            );
        });
    }
}
