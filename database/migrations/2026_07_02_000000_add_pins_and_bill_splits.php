<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('accounts', function (Blueprint $table): void {
            $table->boolean('is_pinned')->default(false)->index();
        });
        Schema::table('allocations', function (Blueprint $table): void {
            $table->boolean('is_pinned')->default(false)->index();
        });

        Schema::create('bill_splits', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('transaction_id')->unique()->constrained()->cascadeOnDelete();
            $table->decimal('subtotal', 15, 2);
            $table->decimal('service_charge', 15, 2)->default(0);
            $table->decimal('discount', 15, 2)->default(0);
            $table->decimal('total', 15, 2);
            $table->timestamps();
        });

        Schema::create('bill_split_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('bill_split_id')->constrained()->cascadeOnDelete();
            $table->string('description');
            $table->decimal('amount', 15, 2);
            $table->unsignedInteger('position');
            $table->timestamps();
        });

        Schema::create('bill_split_participants', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('bill_split_id')->constrained()->cascadeOnDelete();
            $table->foreignId('account_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('allocation_id')->nullable()->constrained()->restrictOnDelete();
            $table->decimal('item_subtotal', 15, 2);
            $table->decimal('service_charge', 15, 2);
            $table->decimal('discount', 15, 2)->default(0);
            $table->decimal('total', 15, 2);
            $table->timestamps();
            $table->unique(['bill_split_id', 'account_id']);
            $table->unique(['bill_split_id', 'allocation_id']);
        });

        Schema::create('bill_split_item_participant', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('bill_split_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('bill_split_participant_id')->constrained()->cascadeOnDelete();
            $table->decimal('amount', 15, 2);
            $table->timestamps();
            $table->unique(['bill_split_item_id', 'bill_split_participant_id'], 'bill_item_participant_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bill_split_item_participant');
        Schema::dropIfExists('bill_split_participants');
        Schema::dropIfExists('bill_split_items');
        Schema::dropIfExists('bill_splits');
        Schema::table('allocations', fn (Blueprint $table) => $table->dropColumn('is_pinned'));
        Schema::table('accounts', fn (Blueprint $table) => $table->dropColumn('is_pinned'));
    }
};
