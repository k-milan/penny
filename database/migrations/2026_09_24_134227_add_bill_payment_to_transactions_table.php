<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->foreignId('bill_allocation_id')
                ->nullable()
                ->after('note')
                ->constrained('allocations')
                ->nullOnDelete();
            $table->decimal('bill_payment_amount', 15, 2)->nullable()->after('bill_allocation_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('bill_allocation_id');
            $table->dropColumn('bill_payment_amount');
        });
    }
};
