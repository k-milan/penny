<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('allocations', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('type')->default('normal');
            $table->date('due_date')->nullable();
            $table->decimal('goal_amount', 15, 2)->nullable();
            $table->decimal('balance', 15, 2)->default('0.00');
            $table->timestamps();
        });
    }
};
