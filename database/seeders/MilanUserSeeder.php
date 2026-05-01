<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Actions\EnsureUnallocatedAllocationForUser;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Seeds a personal dev login. Mimics registration: verified email, no 2FA,
 * and the default Unallocated allocation (User::created + idempotent ensure).
 *
 * Prefer setting SEED_MILAN_PASSWORD in .env instead of relying on the default.
 *
 *     php artisan db:seed --class=MilanUserSeeder
 */
final class MilanUserSeeder extends Seeder
{
    private const EMAIL = 'milan.kfm+1@gmail.com';

    public function run(): void
    {
        $plain = (string) (env('SEED_MILAN_PASSWORD') ?: 'Password123#');

        $user = User::query()->updateOrCreate(
            ['email' => self::EMAIL],
            [
                'name' => 'Milan',
                'password' => $plain,
                'email_verified_at' => now(),
                'two_factor_secret' => null,
                'two_factor_recovery_codes' => null,
                'two_factor_confirmed_at' => null,
            ],
        );

        app(EnsureUnallocatedAllocationForUser::class)->handle($user);
    }
}
