<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bill_split_items', function (Blueprint $table): void {
            $table->unsignedInteger('quantity')->default(1)->after('description');
            $table->decimal('unit_price', 15, 2)->default(0)->after('quantity');
        });
    }

    public function down(): void
    {
        Schema::table('bill_split_items', function (Blueprint $table): void {
            $table->dropColumn(['quantity', 'unit_price']);
        });
    }
};
