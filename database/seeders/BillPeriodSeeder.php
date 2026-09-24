<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\BillPeriod;
use Illuminate\Database\Seeder;

final class BillPeriodSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        BillPeriod::factory()->count(3)->create();
    }
}
