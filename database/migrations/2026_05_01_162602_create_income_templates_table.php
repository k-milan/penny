<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('income_templates', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('company_name')->nullable();
            $table->string('payout_frequency');
            $table->decimal('expected_income', 15, 2);
            $table->timestamps();
        });

        Schema::create('account_income_template', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('income_template_id')->constrained()->cascadeOnDelete();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->decimal('amount', 15, 2);
            $table->timestamps();

            $table->unique(
                ['income_template_id', 'account_id'],
                'inc_tmpl_account_unique'
            );
        });

        Schema::create('allocation_income_template', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('income_template_id')->constrained()->cascadeOnDelete();
            $table->foreignId('allocation_id')->constrained()->cascadeOnDelete();
            $table->decimal('amount', 15, 2);
            $table->timestamps();

            $table->unique(
                ['income_template_id', 'allocation_id'],
                'inc_tmpl_alloc_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('allocation_income_template');
        Schema::dropIfExists('account_income_template');
        Schema::dropIfExists('income_templates');
    }
};
