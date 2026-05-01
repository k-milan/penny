<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\IncomeTemplate;
use App\Models\IncomeTemplateSeries;

final readonly class DeleteIncomeTemplate
{
    public function handle(IncomeTemplate $template): void
    {
        $seriesId = $template->series_id;
        $template->delete();

        if (IncomeTemplate::query()->where('series_id', $seriesId)->doesntExist()) {
            IncomeTemplateSeries::query()->whereKey($seriesId)->delete();
        }
    }
}
