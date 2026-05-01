<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\IncomePayoutFrequency;
use App\Models\IncomeTemplate;
use App\Models\IncomeTemplateSeries;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<IncomeTemplate>
 */
final class IncomeTemplateFactory extends Factory
{
    protected $model = IncomeTemplate::class;

    public function configure(): static
    {
        return $this->afterMaking(function (IncomeTemplate $template): void {
            if ($template->series_id !== null) {
                return;
            }
            $series = IncomeTemplateSeries::query()->create([
                'user_id' => $template->user_id,
            ]);
            $template->setAttribute('series_id', $series->id);
            $template->setAttribute('version', 1);
        });
    }

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'name' => fake()->words(3, true),
            'description' => fake()->optional(0.6)->sentence(),
            'company_name' => fake()->optional(0.7)->company(),
            'payout_frequency' => fake()->randomElement(IncomePayoutFrequency::cases()),
            'expected_income' => fake()->randomFloat(2, 1_000, 80_000),
        ];
    }
}
