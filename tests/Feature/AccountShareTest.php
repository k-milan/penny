<?php

declare(strict_types=1);

use App\Enums\AccountType;
use App\Models\Account;
use App\Models\Transaction;
use App\Models\TransactionAccount;
use App\Models\User;

it('auto-generates a share token when a person account show page is visited', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $account = Account::query()->create([
        'user_id' => $user->id,
        'name' => 'Alice',
        'type' => AccountType::Person,
        'balance' => '100.00',
    ]);

    expect($account->share_token)->toBeNull();

    $this->actingAs($user)
        ->get(route('accounts.show', $account, absolute: false))
        ->assertOk();

    $account->refresh();
    expect($account->share_token)->not->toBeNull();
    expect(mb_strlen((string) $account->share_token))->toBe(32);
});

it('does not auto-generate a share token for non-person accounts', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $account = Account::query()->create([
        'user_id' => $user->id,
        'name' => 'Savings',
        'type' => AccountType::Bank,
        'balance' => '500.00',
    ]);

    $this->actingAs($user)
        ->get(route('accounts.show', $account, absolute: false))
        ->assertOk();

    $account->refresh();
    expect($account->share_token)->toBeNull();
});

it('returns the share_token in account props for person accounts', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $account = Account::query()->create([
        'user_id' => $user->id,
        'name' => 'Bob',
        'type' => AccountType::Person,
        'balance' => '50.00',
    ]);

    $this->actingAs($user)
        ->get(route('accounts.show', $account, absolute: false))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('accounts/show')
            ->has('account', fn ($prop) => $prop
                ->where('type', AccountType::Person->value)
                ->whereNot('share_token', null)
                ->etc()
            )
        );
});

it('does not return share_token in props for non-person accounts', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $account = Account::query()->create([
        'user_id' => $user->id,
        'name' => 'Savings',
        'type' => AccountType::Bank,
        'balance' => '0.00',
    ]);

    $this->actingAs($user)
        ->get(route('accounts.show', $account, absolute: false))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('accounts/show')
            ->has('account', fn ($prop) => $prop
                ->where('share_token', null)
                ->etc()
            )
        );
});

it('renders the public share page for a valid token', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $account = Account::query()->create([
        'user_id' => $user->id,
        'name' => 'Charlie',
        'type' => AccountType::Person,
        'balance' => '200.00',
        'share_token' => 'abc123validtoken12345678901234',
    ]);

    $this->get(route('accounts.share', ['token' => $account->share_token], absolute: false))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('accounts/share')
            ->has('account', fn ($prop) => $prop
                ->where('name', 'Charlie')
                ->where('balance', '200.00')
                ->etc()
            )
            ->where('owner_name', $user->name)
            ->has('transactions')
        );
});

it('shows an itemized opening balance on a person account share page', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $account = Account::query()->create([
        'user_id' => $user->id,
        'name' => 'Charlie',
        'type' => AccountType::Person,
        'balance' => '5000.00',
        'share_token' => 'openingbalancesharetoken1234567890',
    ]);
    $account->openingBalanceItems()->createMany([
        ['description' => 'Utilities', 'amount' => '1000.00'],
        ['description' => 'Groceries', 'amount' => '4000.00'],
    ]);

    $this->get(route('accounts.share', ['token' => $account->share_token], absolute: false))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('accounts/share')
            ->has('account.opening_balance_items', 2)
            ->where('account.opening_balance_items.0', [
                'description' => 'Utilities',
                'amount' => '1000.00',
            ])
            ->where('account.opening_balance_items.1', [
                'description' => 'Groceries',
                'amount' => '4000.00',
            ])
        );
});

it('saves a person account opening balance breakdown that matches its opening balance', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $account = Account::query()->create([
        'user_id' => $user->id,
        'name' => 'Charlie',
        'type' => AccountType::Person,
        'balance' => '5000.00',
    ]);

    $this->actingAs($user)
        ->patch(route('accounts.update', $account, absolute: false), [
            'name' => 'Charlie',
            'type' => AccountType::Person->value,
            'opening_balance_items' => [
                ['description' => 'Utilities', 'amount' => '1000.00'],
                ['description' => 'Groceries', 'amount' => '4000.00'],
            ],
        ])
        ->assertRedirectToRoute('accounts.index')
        ->assertSessionHasNoErrors();

    expect($account->openingBalanceItems()->orderBy('id')->get()->map(fn ($item): array => [
        'description' => $item->description,
        'amount' => (string) $item->amount,
    ])->all())->toBe([
        ['description' => 'Utilities', 'amount' => '1000.00'],
        ['description' => 'Groceries', 'amount' => '4000.00'],
    ]);
});

it('returns 404 for an unknown share token', function (): void {
    $this->get(route('accounts.share', ['token' => 'nonexistent-token-xyz'], absolute: false))
        ->assertNotFound();
});

it('returns 404 if the token belongs to a non-person account', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    Account::query()->create([
        'user_id' => $user->id,
        'name' => 'Savings',
        'type' => AccountType::Bank,
        'balance' => '0.00',
        'share_token' => 'banktoken123456789012345678901',
    ]);

    $this->get(route('accounts.share', ['token' => 'banktoken123456789012345678901'], absolute: false))
        ->assertNotFound();
});

it('shows only transactions for that account on the public share page', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();

    $person = Account::query()->create([
        'user_id' => $user->id,
        'name' => 'Dave',
        'type' => AccountType::Person,
        'balance' => '150.00',
        'share_token' => 'sharetoken12345678901234567890',
    ]);

    $other = Account::query()->create([
        'user_id' => $user->id,
        'name' => 'Savings',
        'type' => AccountType::Bank,
        'balance' => '0.00',
    ]);

    $linked = Transaction::query()->create([
        'user_id' => $user->id,
        'date' => '2025-06-01',
        'description' => 'Loan to Dave',
        'note' => null,
    ]);
    TransactionAccount::query()->create([
        'transaction_id' => $linked->id,
        'account_id' => $person->id,
        'amount' => '150.00',
    ]);

    $unlinked = Transaction::query()->create([
        'user_id' => $user->id,
        'date' => '2025-06-02',
        'description' => 'Unrelated',
        'note' => null,
    ]);
    TransactionAccount::query()->create([
        'transaction_id' => $unlinked->id,
        'account_id' => $other->id,
        'amount' => '50.00',
    ]);

    $linkedCount = Transaction::query()
        ->whereHas('transactionAccounts', fn ($q) => $q->where('account_id', $person->id))
        ->count();

    expect($linkedCount)->toBe(1);

    $this->get(route('accounts.share', ['token' => $person->share_token], absolute: false))
        ->assertOk();
});
