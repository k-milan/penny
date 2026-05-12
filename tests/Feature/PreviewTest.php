<?php

declare(strict_types=1);

use App\Models\User;

it('creates an isolated preview session with seeded data', function (): void {
    $response = $this->get(route('preview'));

    $response->assertRedirectToRoute('dashboard')
        ->assertSessionHas('success');

    $user = User::query()->whereNotNull('preview_expires_at')->first();

    expect($user)->not->toBeNull()
        ->and($user->email_verified_at)->not->toBeNull()
        ->and($user->preview_expires_at?->betweenIncluded(now()->addHours(5)->addMinutes(59), now()->addHours(6)->addMinute()))->toBeTrue()
        ->and($user->accounts()->count())->toBe(3)
        ->and($user->allocations()->where('is_unallocated', false)->count())->toBe(3)
        ->and($user->transactions()->count())->toBe(3)
        ->and($user->incomeTemplates()->count())->toBe(1);

    $this->assertAuthenticatedAs($user);
});

it('shares preview mode metadata for preview users', function (): void {
    $user = User::factory()->withoutTwoFactor()->create([
        'preview_expires_at' => now()->addHours(6),
    ]);

    $response = $this->actingAs($user)->get(route('dashboard'));

    $response->assertInertia(fn ($page) => $page
        ->where('preview.enabled', true)
        ->where('preview.expires_at', now()->addHours(6)->toIso8601String()));
});

it('prunes expired preview users without touching normal users', function (): void {
    $normalUser = User::factory()->create();
    $expiredPreview = User::factory()->create([
        'preview_expires_at' => now()->subMinute(),
    ]);
    $activePreview = User::factory()->create([
        'preview_expires_at' => now()->addMinute(),
    ]);

    $this->artisan('preview:prune')
        ->expectsOutput('Pruned 1 expired preview user(s).')
        ->assertSuccessful();

    expect(User::query()->whereKey($normalUser->id)->exists())->toBeTrue()
        ->and(User::query()->whereKey($expiredPreview->id)->exists())->toBeFalse()
        ->and(User::query()->whereKey($activePreview->id)->exists())->toBeTrue();
});
