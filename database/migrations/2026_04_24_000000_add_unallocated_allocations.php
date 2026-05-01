<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('allocations', function (Blueprint $table): void {
            $table->boolean('is_unallocated')->default(false)->after('user_id');
            $table->index(['user_id', 'is_unallocated']);
        });

        $this->backfill();
    }

    public function down(): void
    {
        Schema::table('allocations', function (Blueprint $table): void {
            $table->dropIndex(['user_id', 'is_unallocated']);
            $table->dropColumn('is_unallocated');
        });
    }

    private function backfill(): void
    {
        $userIds = DB::table('users')->orderBy('id')->pluck('id');

        foreach ($userIds as $userId) {
            if (DB::table('allocations')->where('user_id', $userId)->where('is_unallocated', true)->exists()) {
                continue;
            }

            $sumAccounts = (string) DB::table('accounts')->where('user_id', $userId)->sum('balance');
            $sumAlloc = (string) DB::table('allocations')->where('user_id', $userId)->sum('balance');

            $gap = bcsub(
                bcadd('0.00', $sumAccounts, 2),
                bcadd('0.00', $sumAlloc, 2),
                2
            );

            DB::table('allocations')->insert([
                'user_id' => $userId,
                'name' => 'Unallocated',
                'type' => 'unallocated',
                'due_date' => null,
                'goal_amount' => null,
                'balance' => $gap,
                'is_unallocated' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
};
