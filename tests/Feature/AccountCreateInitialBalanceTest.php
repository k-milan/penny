<?php

declare(strict_types=1);

use App\Enums\AccountType;
use App\Models\Account;
use App\Models\User;

it('sets balance from optional initial balance when creating an account', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();

    $this->actingAs($user)
        ->fromRoute('accounts.create')
        ->post(route('accounts.store', absolute: false), [
            'name' => 'Checking',
            'type' => AccountType::Bank->value,
            'initial_balance' => '42.50',
        ])
        ->assertRedirectToRoute('accounts.index')
        ->assertSessionHasNoErrors();

    $account = Account::query()->where('user_id', $user->id)->firstOrFail();
    expect((string) $account->balance)->toBe('42.50');
});

it('defaults balance to zero when initial balance is omitted', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();

    $this->actingAs($user)
        ->fromRoute('accounts.create')
        ->post(route('accounts.store', absolute: false), [
            'name' => 'Cash',
            'type' => AccountType::Cash->value,
        ])
        ->assertRedirectToRoute('accounts.index');

    $account = Account::query()->where('user_id', $user->id)->firstOrFail();
    expect((string) $account->balance)->toBe('0.00');
});
