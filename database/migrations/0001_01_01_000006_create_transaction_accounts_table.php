<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transaction_accounts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('transaction_id')
                ->constrained('transactions')
                ->cascadeOnDelete();
            $table->foreignId('account_id')
                ->constrained('accounts')
                ->restrictOnDelete();
            $table->decimal('amount', 15, 2);
            $table->timestamps();
        });
    }
};
