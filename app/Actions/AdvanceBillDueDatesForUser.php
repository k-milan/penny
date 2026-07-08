<?php

declare(strict_types=1);

namespace App\Actions;

use App\Enums\AllocationType;
use App\Models\Allocation;
use App\Models\User;
use Carbon\CarbonImmutable;

final readonly class AdvanceBillDueDatesForUser
{
    public static function nextDueDate(int $dueDay, CarbonImmutable $today): CarbonImmutable
    {
        $month = $today->startOfMonth();

        while (true) {
            $candidate = $month->day(min($dueDay, $month->daysInMonth));
            if ($candidate->greaterThanOrEqualTo($today->startOfDay())) {
                return $candidate;
            }

            $month = $month->addMonthNoOverflow()->startOfMonth();
        }
    }

    public function handle(User $user, ?CarbonImmutable $today = null): void
    {
        $today ??= CarbonImmutable::today();

        Allocation::query()
            ->where('user_id', $user->id)
            ->where('type', AllocationType::Bill)
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<', $today->toDateString())
            ->orderBy('id')
            ->each(function (Allocation $allocation) use ($today): void {
                $dueDay = $allocation->due_day ?? $allocation->due_date?->day;
                if ($dueDay === null) {
                    return;
                }

                $allocation->forceFill([
                    'due_date' => self::nextDueDate($dueDay, $today)->toDateString(),
                    'due_day' => $dueDay,
                ])->save();
            });
    }
}
