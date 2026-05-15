<?php

declare(strict_types=1);

use App\Actions\CreateAccount;
use App\Actions\EnsureUnallocatedAllocationForUser;
use App\Enums\AccountType;
use App\Models\Allocation;
use App\Models\User;

it('rejects a new allocation when initial balance is greater than unallocated', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    app(CreateAccount::class)->handle($user, [
        'name' => 'Checking',
        'type' => AccountType::Bank,
        'initial_balance' => '100.00',
    ]);

    $response = $this->actingAs($user)
        ->fromRoute('allocations.create')
        ->post(route('allocations.store', absolute: false), [
            'name' => 'Envelopes',
            'type' => 'normal',
            'initial_balance' => '150.00',
        ]);

    $response->assertSessionHasErrors('initial_balance');
    expect(Allocation::query()->where('is_unallocated', false)->count())
        ->toBe(0);
});

it('creates a new allocation when initial balance is within unallocated', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    app(CreateAccount::class)->handle($user, [
        'name' => 'Checking',
        'type' => AccountType::Bank,
        'initial_balance' => '100.00',
    ]);

    $response = $this->actingAs($user)
        ->fromRoute('allocations.create')
        ->post(route('allocations.store', absolute: false), [
            'name' => 'Envelopes',
            'type' => 'normal',
            'initial_balance' => '100.00',
        ]);

    $response->assertRedirectToRoute('allocations.index');
    $response->assertSessionHasNoErrors();
    expect(Allocation::query()->where('is_unallocated', false)->count())->toBe(1);
    $created = Allocation::query()
        ->where('is_unallocated', false)
        ->firstOrFail();
    expect((string) $created->balance)->toBe('100.00');
});

it('creates an allocation with a negative initial balance and increases unallocated', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();

    $unallocated = app(EnsureUnallocatedAllocationForUser::class)->handle($user);
    $unallocated->update(['balance' => '0.00']);

    $this->actingAs($user)
        ->fromRoute('allocations.create')
        ->post(route('allocations.store', absolute: false), [
            'name' => 'Credit Debt',
            'type' => 'normal',
            'initial_balance' => '-75.00',
        ])
        ->assertRedirectToRoute('allocations.index')
        ->assertSessionHasNoErrors();

    $created = Allocation::query()->where('is_unallocated', false)->firstOrFail();
    expect((string) $created->balance)->toBe('-75.00');

    expect((string) $unallocated->fresh()->balance)->toBe('75.00');
});

it('rejects a negative initial balance that would exceed the unallocated floor', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();

    $this->actingAs($user)
        ->fromRoute('allocations.create')
        ->post(route('allocations.store', absolute: false), [
            'name' => 'Envelopes',
            'type' => 'normal',
            'initial_balance' => '150.00',
        ])
        ->assertSessionHasErrors('initial_balance');
});
