<?php

declare(strict_types=1);

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $backfillUserId = User::query()->orderBy('id')->value('id');

        foreach (['accounts', 'allocations', 'transactions'] as $table) {
            $rowCount = DB::table($table)->count();

            if ($rowCount === 0) {
                Schema::table($table, function (Blueprint $t): void {
                    $t->foreignId('user_id')->constrained()->cascadeOnDelete();
                });

                continue;
            }

            if ($backfillUserId === null) {
                throw new RuntimeException(
                    'Add at least one user before running this migration: '.$table.' has rows and needs a user_id to backfill.',
                );
            }

            Schema::table($table, function (Blueprint $t): void {
                $t->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            });

            DB::table($table)->whereNull('user_id')->update(['user_id' => $backfillUserId]);

            if (DB::getDriverName() === 'mysql') {
                DB::statement('ALTER TABLE `'.$table.'` MODIFY `user_id` BIGINT UNSIGNED NOT NULL');
            } else {
                Schema::table($table, function (Blueprint $t): void {
                    $t->unsignedBigInteger('user_id')->nullable(false)->change();
                });
            }
        }
    }

    public function down(): void
    {
        foreach (['accounts', 'allocations', 'transactions'] as $table) {
            if (! Schema::hasTable($table) || ! Schema::hasColumn($table, 'user_id')) {
                continue;
            }

            Schema::table($table, function (Blueprint $t): void {
                $t->dropConstrainedForeignId('user_id');
            });
        }
    }
};
