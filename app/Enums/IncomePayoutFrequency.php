<?php

declare(strict_types=1);

namespace App\Enums;

enum IncomePayoutFrequency: string
{
    case Weekly = 'weekly';
    case BiWeekly = 'bi_weekly';
    case SemiMonthly = 'semi_monthly';
    case Monthly = 'monthly';
    case Quarterly = 'quarterly';
    case Annually = 'annually';
    case Irregular = 'irregular';

    public function label(): string
    {
        return match ($this) {
            self::Weekly => 'Weekly',
            self::BiWeekly => 'Every two weeks',
            self::SemiMonthly => 'Twice per month',
            self::Monthly => 'Monthly',
            self::Quarterly => 'Quarterly',
            self::Annually => 'Annually',
            self::Irregular => 'Irregular',
        };
    }
}
