<?php

declare(strict_types=1);

use App\Enums\AccountType;
use App\Models\Account;
use App\Models\User;

it('persists account pins and returns pinned accounts first', function (): void {
    $user = User::factory()->create();
    $zulu = Account::query()->create([
        'user_id' => $user->id,
        'name' => 'Zulu',
        'type' => AccountType::Bank,
        'balance' => '0.00',
    ]);
    Account::query()->create([
        'user_id' => $user->id,
        'name' => 'Alpha',
        'type' => AccountType::Bank,
        'balance' => '0.00',
    ]);

    $this->actingAs($user)
        ->patch(route('accounts.update', $zulu), ['is_pinned' => true])
        ->assertRedirect(route('accounts.index'));

    expect($zulu->fresh()->is_pinned)->toBeTrue();
    $this->actingAs($user)
        ->getJson(route('api.accounts.index'))
        ->assertOk()
        ->assertJsonPath('data.0.name', 'Zulu')
        ->assertJsonPath('data.0.is_pinned', true);
});

it('does not allow a user to pin another users account', function (): void {
    $owner = User::factory()->create();
    $attacker = User::factory()->create();
    $account = Account::query()->create([
        'user_id' => $owner->id,
        'name' => 'Private',
        'type' => AccountType::Bank,
        'balance' => '0.00',
    ]);

    $this->actingAs($attacker)
        ->patch(route('accounts.update', $account), ['is_pinned' => true])
        ->assertNotFound();
    expect($account->fresh()->is_pinned)->toBeFalse();
});
