<?php

declare(strict_types=1);

namespace App\Actions;

use App\Enums\AllocationType;
use App\Models\Allocation;
use App\Models\BillPeriod;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class EnsureBillPeriodsForUser
{
    public function handle(User $user, ?CarbonImmutable $today = null): void
    {
        $today ??= CarbonImmutable::today();
        $firstPeriod = $today->startOfMonth()->subMonths(5);

        DB::transaction(function () use ($user, $firstPeriod): void {
            Allocation::query()
                ->where('user_id', $user->id)
                ->where('type', AllocationType::Bill)
                ->whereNotNull('due_day')
                ->orderBy('id')
                ->each(function (Allocation $allocation) use ($user, $firstPeriod): void {
                    for ($offset = 0; $offset < 8; $offset++) {
                        $period = $firstPeriod->addMonthsNoOverflow($offset)->startOfMonth();
                        $dueDay = min((int) $allocation->due_day, $period->daysInMonth);

                        BillPeriod::query()->firstOrCreate(
                            [
                                'allocation_id' => $allocation->id,
                                'period' => $period->toDateString(),
                            ],
                            [
                                'user_id' => $user->id,
                                'due_date' => $period->day($dueDay)->toDateString(),
                            ],
                        );
                    }
                });
        });
    }
}
