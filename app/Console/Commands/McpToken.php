<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

final class McpToken extends Command
{
    protected $signature = 'penny:mcp-token {email : Penny user email} {--revoke : Revoke the current token} {--days=90 : Token validity in days}';

    protected $description = 'Issue, rotate, or revoke a user\'s Penny MCP bearer token';

    public function handle(): int
    {
        $user = User::query()->where('email', $this->argument('email'))->first();
        if ($user === null) {
            $this->error('Penny user not found.');

            return self::FAILURE;
        }
        if ($this->option('revoke')) {
            $user->forceFill(['mcp_token_hash' => null, 'mcp_token_expires_at' => null])->save();
            $this->info('Penny MCP token revoked.');

            return self::SUCCESS;
        }
        $days = filter_var($this->option('days'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 365]]);
        if ($days === false) {
            $this->error('Token validity must be between 1 and 365 days.');

            return self::FAILURE;
        }
        $token = Str::random(64);
        $user->forceFill([
            'mcp_token_hash' => hash('sha256', $token),
            'mcp_token_expires_at' => now()->addDays($days),
        ])->save();
        $this->info('Penny MCP token issued. Any previous token is revoked. Copy it now; it will not be shown again.');
        $this->line($token);
        $this->info('Use Authorization: Bearer <token> with /mcp/penny.');

        return self::SUCCESS;
    }
}
