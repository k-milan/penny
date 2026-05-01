<?php

declare(strict_types=1);

namespace App\Actions;

use App\Enums\IncomePayoutFrequency;
use App\Models\IncomeTemplate;
use App\Models\IncomeTemplateSeries;
use App\Models\User;
use Illuminate\Support\Facades\DB;

final readonly class CreateIncomeTemplate
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
     *     series_id?: int|null,
     * }  $attributes
     */
    public function handle(User $user, array $attributes): IncomeTemplate
    {
        return DB::transaction(function () use ($user, $attributes): IncomeTemplate {
            $frequency = $attributes['payout_frequency'] instanceof IncomePayoutFrequency
                ? $attributes['payout_frequency']
                : IncomePayoutFrequency::from((string) $attributes['payout_frequency']);

            $seriesId = $attributes['series_id'] ?? null;

            if ($seriesId !== null) {
                $series = IncomeTemplateSeries::query()
                    ->where('user_id', $user->id)
                    ->whereKey($seriesId)
                    ->firstOrFail();
                $nextVersion = ((int) IncomeTemplate::query()
                    ->where('series_id', $series->id)
                    ->max('version')) + 1;
            } else {
                $series = IncomeTemplateSeries::query()->create([
                    'user_id' => $user->id,
                ]);
                $nextVersion = 1;
            }

            $template = IncomeTemplate::query()->create([
                'user_id' => $user->id,
                'series_id' => $series->id,
                'version' => $nextVersion,
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

            return $template;
        });
    }
}
