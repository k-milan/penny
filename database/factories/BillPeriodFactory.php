<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\AllocationType;
use App\Models\Allocation;
use App\Models\BillPeriod;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<BillPeriod>
 */
final class BillPeriodFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $period = CarbonImmutable::instance(fake()->dateTimeBetween('-6 months', '+2 months'))->startOfMonth();

        return [
            'user_id' => User::factory(),
            'allocation_id' => function (array $attributes) use ($period): int {
                return (int) Allocation::query()->create([
                    'user_id' => $attributes['user_id'],
                    'name' => fake()->unique()->words(2, true),
                    'type' => AllocationType::Bill,
                    'due_date' => $period->day(15)->toDateString(),
                    'due_day' => 15,
                    'balance' => '0.00',
                    'is_unallocated' => false,
                ])->id;
            },
            'period' => $period->toDateString(),
            'due_date' => $period->day(15)->toDateString(),
            'due_amount' => fake()->randomFloat(2, 100, 5000),
            'confirmed_at' => now(),
        ];
    }
}
