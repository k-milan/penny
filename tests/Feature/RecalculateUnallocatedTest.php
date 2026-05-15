<?php

declare(strict_types=1);

use App\Actions\CreateAccount;
use App\Actions\EnsureUnallocatedAllocationForUser;
use App\Enums\AccountType;
use App\Models\Allocation;
use App\Models\User;

it('recalculates unallocated balance to match account total minus other allocations', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();

    app(CreateAccount::class)->handle($user, [
        'name' => 'Checking',
        'type' => AccountType::Bank,
        'initial_balance' => '200.00',
    ]);

    $this->actingAs($user)
        ->fromRoute('allocations.create')
        ->post(route('allocations.store', absolute: false), [
            'name' => 'Savings',
            'type' => 'normal',
            'initial_balance' => '50.00',
        ]);

    $unallocated = Allocation::query()->where('user_id', $user->id)->where('is_unallocated', true)->firstOrFail();
    expect((string) $unallocated->balance)->toBe('150.00');

    $unallocated->update(['balance' => '999.00']);

    $this->actingAs($user)
        ->post(route('allocations.recalculate-unallocated', absolute: false))
        ->assertRedirect()
        ->assertSessionHas('success');

    expect((string) $unallocated->fresh()->balance)->toBe('150.00');
});

it('sets unallocated to total account balance when no other allocations exist', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();

    app(CreateAccount::class)->handle($user, [
        'name' => 'Checking',
        'type' => AccountType::Bank,
        'initial_balance' => '300.00',
    ]);

    $unallocated = Allocation::query()->where('user_id', $user->id)->where('is_unallocated', true)->firstOrFail();

    $unallocated->update(['balance' => '0.00']);

    $this->actingAs($user)
        ->post(route('allocations.recalculate-unallocated', absolute: false))
        ->assertRedirect();

    expect((string) $unallocated->fresh()->balance)->toBe('300.00');
});

it('sets unallocated to zero when there are no accounts', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();

    $unallocated = app(EnsureUnallocatedAllocationForUser::class)->handle($user);
    $unallocated->update(['balance' => '999.00']);

    $this->actingAs($user)
        ->post(route('allocations.recalculate-unallocated', absolute: false))
        ->assertRedirect();

    expect((string) $unallocated->fresh()->balance)->toBe('0.00');
});

it('requires authentication', function (): void {
    $this->post(route('allocations.recalculate-unallocated', absolute: false))
        ->assertRedirect(route('login'));
});
