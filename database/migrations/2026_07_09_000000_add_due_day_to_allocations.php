<?php

declare(strict_types=1);

use Carbon\CarbonImmutable;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('allocations', function (Blueprint $table): void {
            $table->unsignedTinyInteger('due_day')->nullable()->after('due_date');
        });

        DB::table('allocations')
            ->whereNotNull('due_date')
            ->orderBy('id')
            ->eachById(function (object $allocation): void {
                DB::table('allocations')
                    ->where('id', $allocation->id)
                    ->update([
                        'due_day' => CarbonImmutable::parse((string) $allocation->due_date)->day,
                    ]);
            });
    }

    public function down(): void
    {
        Schema::table('allocations', function (Blueprint $table): void {
            $table->dropColumn('due_day');
        });
    }
};
