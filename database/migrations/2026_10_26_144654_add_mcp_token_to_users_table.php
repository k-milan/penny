<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('mcp_token_hash', 64)->nullable()->unique();
            $table->timestamp('mcp_token_expires_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropUnique(['mcp_token_hash']);
            $table->dropColumn(['mcp_token_hash', 'mcp_token_expires_at']);
        });
    }
};
