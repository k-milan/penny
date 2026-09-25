<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('bill_periods', function (Blueprint $table) {
            $table->dropForeign(['allocation_id']);
            $table->dropUnique(['allocation_id', 'period']);
        });

        Schema::table('bill_periods', function (Blueprint $table) {
            $table->foreignId('allocation_id')->nullable()->change();
            $table->foreign('allocation_id')->references('id')->on('allocations')->cascadeOnDelete();
            $table->foreignId('account_id')->nullable()->after('allocation_id')->constrained()->cascadeOnDelete();
            $table->unique(['allocation_id', 'period']);
            $table->unique(['account_id', 'period']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('bill_periods')->whereNotNull('account_id')->delete();

        Schema::table('bill_periods', function (Blueprint $table) {
            $table->dropConstrainedForeignId('account_id');
            $table->dropForeign(['allocation_id']);
            $table->dropUnique(['account_id', 'period']);
            $table->dropUnique(['allocation_id', 'period']);
        });

        Schema::table('bill_periods', function (Blueprint $table) {
            $table->foreignId('allocation_id')->nullable(false)->change();
            $table->foreign('allocation_id')->references('id')->on('allocations')->cascadeOnDelete();
            $table->unique(['allocation_id', 'period']);
        });
    }
};
