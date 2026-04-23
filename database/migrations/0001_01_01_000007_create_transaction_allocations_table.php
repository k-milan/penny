<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transaction_allocations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('transaction_id')
                ->constrained('transactions')
                ->cascadeOnDelete();
            $table->foreignId('allocation_id')
                ->constrained('allocations')
                ->restrictOnDelete();
            $table->decimal('amount', 15, 2);
            $table->timestamps();
        });
    }
};
