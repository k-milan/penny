<?php

declare(strict_types=1);

namespace App\Providers;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

final class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Auth::viaRequest('penny-mcp', static function (Request $request): ?User {
            $token = $request->bearerToken();
            if (! is_string($token) || $token === '') {
                return null;
            }

            return User::query()
                ->where('mcp_token_hash', hash('sha256', $token))
                ->where('mcp_token_expires_at', '>', now())
                ->first();
        });

        $this->bootModelsDefaults();
        $this->bootPasswordDefaults();
    }

    private function bootModelsDefaults(): void
    {
        Model::unguard();
    }

    private function bootPasswordDefaults(): void
    {
        Password::defaults(fn () => app()->isLocal() || app()->runningUnitTests() ? Password::min(12)->max(255) : Password::min(12)->max(255)->uncompromised());
    }
}
