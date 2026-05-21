<?php

declare(strict_types=1);

use App\Enums\AccountType;
use App\Models\Account;
use App\Models\Transaction;
use App\Models\TransactionAccount;
use App\Models\User;

it('renders the account show page', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $account = Account::query()->create([
        'user_id' => $user->id,
        'name' => 'Checking',
        'type' => AccountType::Bank,
        'balance' => '500.00',
    ]);

    $this->actingAs($user)
        ->get(route('accounts.show', $account, absolute: false))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('accounts/show')
            ->has('account', fn ($prop) => $prop
                ->where('id', $account->id)
                ->where('name', 'Checking')
                ->where('type', AccountType::Bank->value)
                ->where('balance', '500.00')
                ->etc()
            )
            ->has('accounts')
            ->has('allocations')
        );
});

it('returns 404 for an account belonging to another user', function (): void {
    $owner = User::factory()->withoutTwoFactor()->create();
    $other = User::factory()->withoutTwoFactor()->create();
    $account = Account::query()->create([
        'user_id' => $owner->id,
        'name' => 'Savings',
        'type' => AccountType::Bank,
        'balance' => '0.00',
    ]);

    $this->actingAs($other)
        ->get(route('accounts.show', $account, absolute: false))
        ->assertNotFound();
});

it('requires authentication to view the account show page', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $account = Account::query()->create([
        'user_id' => $user->id,
        'name' => 'Checking',
        'type' => AccountType::Bank,
        'balance' => '0.00',
    ]);

    $this->get(route('accounts.show', $account, absolute: false))
        ->assertRedirect(route('login', absolute: false));
});

it('only shows transactions for the current account on the show page', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();

    $account = Account::query()->create([
        'user_id' => $user->id,
        'name' => 'Checking',
        'type' => AccountType::Bank,
        'balance' => '200.00',
    ]);

    $otherAccount = Account::query()->create([
        'user_id' => $user->id,
        'name' => 'Savings',
        'type' => AccountType::Bank,
        'balance' => '0.00',
    ]);

    $linkedTransaction = Transaction::query()->create([
        'user_id' => $user->id,
        'date' => '2025-01-01',
        'description' => 'Linked',
        'note' => null,
    ]);
    TransactionAccount::query()->create([
        'transaction_id' => $linkedTransaction->id,
        'account_id' => $account->id,
        'amount' => '100.00',
    ]);

    $unlinkedTransaction = Transaction::query()->create([
        'user_id' => $user->id,
        'date' => '2025-01-02',
        'description' => 'Not linked',
        'note' => null,
    ]);
    TransactionAccount::query()->create([
        'transaction_id' => $unlinkedTransaction->id,
        'account_id' => $otherAccount->id,
        'amount' => '50.00',
    ]);

    $linkedCount = Transaction::query()
        ->whereHas('transactionAccounts', fn ($q) => $q->where('account_id', $account->id))
        ->count();

    expect($linkedCount)->toBe(1);

    $this->actingAs($user)
        ->get(route('accounts.show', $account, absolute: false))
        ->assertOk();
});
