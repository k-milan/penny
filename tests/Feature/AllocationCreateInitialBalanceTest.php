<?php

declare(strict_types=1);

use App\Actions\CreateAccount;
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
