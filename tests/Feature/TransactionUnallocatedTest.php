<?php

declare(strict_types=1);

use App\Actions\CreateAccount;
use App\Actions\CreateAllocation;
use App\Enums\AccountType;
use App\Enums\AllocationType;
use App\Models\User;

it('allows a two-account transfer when line totals net to zero and there are no allocation lines', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $from = app(CreateAccount::class)->handle($user, [
        'name' => 'Checking',
        'type' => AccountType::Bank,
        'initial_balance' => '100.00',
    ]);
    $to = app(CreateAccount::class)->handle($user, [
        'name' => 'Savings',
        'type' => AccountType::Bank,
        'initial_balance' => '0.00',
    ]);

    $response = $this->actingAs($user)->fromRoute('dashboard')->post(
        route('transactions.store', absolute: false),
        [
            'date' => now()->toDateString(),
            'description' => 'Internal transfer',
            'note' => null,
            'accounts' => [
                [
                    'account_id' => $from->id,
                    'amount' => '-100.00',
                ],
                [
                    'account_id' => $to->id,
                    'amount' => '100.00',
                ],
            ],
            'allocations' => [],
        ],
    );

    $response->assertRedirectToRoute('dashboard');
    $response->assertSessionHasNoErrors();
    $this->assertDatabaseCount('transactions', 1);
    expect($from->fresh()->balance)->toBe('0.00');
    expect($to->fresh()->balance)->toBe('100.00');
});

it('allows an account transfer with a fee taken from a chosen allocation', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $from = app(CreateAccount::class)->handle($user, [
        'name' => 'Checking',
        'type' => AccountType::Bank,
        'initial_balance' => '500.00',
    ]);
    $to = app(CreateAccount::class)->handle($user, [
        'name' => 'Savings',
        'type' => AccountType::Bank,
        'initial_balance' => '0.00',
    ]);
    $fees = app(CreateAllocation::class)->handle($user, [
        'name' => 'Bank fees',
        'type' => AllocationType::Normal,
        'initial_balance' => '50.00',
    ]);

    $response = $this->actingAs($user)->fromRoute('dashboard')->post(
        route('transactions.store', absolute: false),
        [
            'date' => now()->toDateString(),
            'description' => 'Transfer with fee',
            'note' => null,
            'accounts' => [
                ['account_id' => $from->id, 'amount' => '-105.00'],
                ['account_id' => $to->id, 'amount' => '100.00'],
            ],
            'allocations' => [
                ['allocation_id' => $fees->id, 'amount' => '-5.00'],
            ],
        ],
    );

    $response->assertRedirectToRoute('dashboard');
    $response->assertSessionHasNoErrors();
    expect($from->fresh()->balance)->toBe('395.00');
    expect($to->fresh()->balance)->toBe('100.00');
    expect($fees->fresh()->balance)->toBe('45.00');
});

it('allows an account transfer with a fee taken from unallocated', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $from = app(CreateAccount::class)->handle($user, [
        'name' => 'Checking',
        'type' => AccountType::Bank,
        'initial_balance' => '200.00',
    ]);
    $to = app(CreateAccount::class)->handle($user, [
        'name' => 'Savings',
        'type' => AccountType::Bank,
        'initial_balance' => '0.00',
    ]);
    $unallocated = App\Models\Allocation::query()
        ->where('user_id', $user->id)
        ->where('is_unallocated', true)
        ->firstOrFail();
    $unallocatedBefore = (string) $unallocated->fresh()->balance;

    $response = $this->actingAs($user)->fromRoute('dashboard')->post(
        route('transactions.store', absolute: false),
        [
            'date' => now()->toDateString(),
            'description' => 'Wire with fee',
            'note' => null,
            'accounts' => [
                ['account_id' => $from->id, 'amount' => '-60.00'],
                ['account_id' => $to->id, 'amount' => '50.00'],
            ],
            'allocations' => [
                ['allocation_id' => $unallocated->id, 'amount' => '-10.00'],
            ],
        ],
    );

    $response->assertRedirectToRoute('dashboard');
    $response->assertSessionHasNoErrors();
    expect($from->fresh()->balance)->toBe('140.00');
    expect($to->fresh()->balance)->toBe('50.00');
    expect(
        bcsub((string) $unallocated->fresh()->balance, $unallocatedBefore, 2),
    )->toBe('-10.00');
});

it('allows a two-allocation transfer when line totals net to zero and there are no account lines', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $account = app(CreateAccount::class)->handle($user, [
        'name' => 'Omni',
        'type' => AccountType::Bank,
        'initial_balance' => '100.00',
    ]);
    $from = app(CreateAllocation::class)->handle($user, [
        'name' => 'A',
        'type' => AllocationType::Normal,
        'initial_balance' => '60.00',
    ]);
    $to = app(CreateAllocation::class)->handle($user, [
        'name' => 'B',
        'type' => AllocationType::Savings,
        'initial_balance' => '0.00',
    ]);

    $response = $this->actingAs($user)->fromRoute('dashboard')->post(
        route('transactions.store', absolute: false),
        [
            'date' => now()->toDateString(),
            'description' => 'Rebalance envelopes',
            'note' => null,
            'accounts' => [],
            'allocations' => [
                [
                    'allocation_id' => $from->id,
                    'amount' => '-20.00',
                ],
                [
                    'allocation_id' => $to->id,
                    'amount' => '20.00',
                ],
            ],
        ],
    );

    $response->assertRedirectToRoute('dashboard');
    $response->assertSessionHasNoErrors();
    $this->assertDatabaseCount('transactions', 1);
    expect($from->fresh()->balance)->toBe('40.00');
    expect($to->fresh()->balance)->toBe('20.00');
    expect($account->fresh()->balance)->toBe('100.00');
});

it('allows a card payment split across two accounts with no allocation lines', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $checking = app(CreateAccount::class)->handle($user, [
        'name' => 'Checking',
        'type' => AccountType::Bank,
        'initial_balance' => '1000.00',
    ]);
    $savings = app(CreateAccount::class)->handle($user, [
        'name' => 'Savings',
        'type' => AccountType::Bank,
        'initial_balance' => '500.00',
    ]);
    $card = app(CreateAccount::class)->handle($user, [
        'name' => 'Visa',
        'type' => AccountType::CreditCard,
        'initial_balance' => '-800.00',
    ]);

    $response = $this->actingAs($user)->fromRoute('dashboard')->post(
        route('transactions.store', absolute: false),
        [
            'date' => now()->toDateString(),
            'description' => 'Card payment',
            'note' => null,
            'accounts' => [
                ['account_id' => $card->id, 'amount' => '500.00'],
                ['account_id' => $checking->id, 'amount' => '-300.00'],
                ['account_id' => $savings->id, 'amount' => '-200.00'],
            ],
            'allocations' => [],
        ],
    );

    $response->assertRedirectToRoute('dashboard');
    $response->assertSessionHasNoErrors();
    expect($card->fresh()->balance)->toBe('-300.00');
    expect($checking->fresh()->balance)->toBe('700.00');
    expect($savings->fresh()->balance)->toBe('300.00');
});

it('allows a loan-style transaction with one person receivable, cash out, and allocation', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $cash = app(CreateAccount::class)->handle($user, [
        'name' => 'Cash',
        'type' => AccountType::Cash,
        'initial_balance' => '5000.00',
    ]);
    $person = app(CreateAccount::class)->handle($user, [
        'name' => 'Alex',
        'type' => AccountType::Person,
        'initial_balance' => '0.00',
    ]);
    $env = app(CreateAllocation::class)->handle($user, [
        'name' => 'Loans pot',
        'type' => AllocationType::Normal,
        'initial_balance' => '1000.00',
    ]);

    $response = $this->actingAs($user)->fromRoute('dashboard')->post(
        route('transactions.store', absolute: false),
        [
            'date' => now()->toDateString(),
            'description' => 'Loan split',
            'note' => null,
            'accounts' => [
                ['account_id' => $person->id, 'amount' => '500.00'],
                ['account_id' => $cash->id, 'amount' => '-300.00'],
            ],
            'allocations' => [
                ['allocation_id' => $env->id, 'amount' => '200.00'],
            ],
        ],
    );

    $response->assertRedirectToRoute('dashboard');
    $response->assertSessionHasNoErrors();
    expect($cash->fresh()->balance)->toBe('4700.00');
    expect($person->fresh()->balance)->toBe('500.00');
    expect($env->fresh()->balance)->toBe('1200.00');
});

it('allows a transaction when account line totals and allocation line totals are equal', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $account = app(CreateAccount::class)->handle($user, [
        'name' => 'Checking',
        'type' => AccountType::Bank,
        'initial_balance' => '200.00',
    ]);
    $allocation = app(CreateAllocation::class)->handle($user, [
        'name' => 'Bills',
        'type' => AllocationType::Normal,
        'initial_balance' => '0.00',
    ]);

    $response = $this->actingAs($user)->fromRoute('dashboard')->post(
        route('transactions.store', absolute: false),
        [
            'date' => now()->toDateString(),
            'description' => 'Sync totals',
            'note' => null,
            'accounts' => [
                [
                    'account_id' => $account->id,
                    'amount' => '150.00',
                ],
            ],
            'allocations' => [
                [
                    'allocation_id' => $allocation->id,
                    'amount' => '150.00',
                ],
            ],
        ],
    );

    $response->assertRedirectToRoute('dashboard');
    $response->assertSessionHasNoErrors();
    $this->assertDatabaseCount('transactions', 1);
    expect($account->fresh()->balance)->toBe('350.00');
    expect($allocation->fresh()->balance)->toBe('150.00');
});

it('rejects a transaction when account and allocation line totals do not match', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $account = app(CreateAccount::class)->handle($user, [
        'name' => 'Checking',
        'type' => AccountType::Bank,
        'initial_balance' => '200.00',
    ]);
    $allocation = app(CreateAllocation::class)->handle($user, [
        'name' => 'Bills',
        'type' => AllocationType::Normal,
        'initial_balance' => '0.00',
    ]);

    $this->actingAs($user)->fromRoute('dashboard')->post(
        route('transactions.store', absolute: false),
        [
            'date' => now()->toDateString(),
            'description' => 'Mismatched totals',
            'note' => null,
            'accounts' => [
                [
                    'account_id' => $account->id,
                    'amount' => '200.00',
                ],
            ],
            'allocations' => [
                [
                    'allocation_id' => $allocation->id,
                    'amount' => '100.00',
                ],
            ],
        ],
    )->assertSessionHasErrors(['accounts', 'allocations']);
});

it('rejects duplicate account lines on a transaction', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $first = app(CreateAccount::class)->handle($user, [
        'name' => 'A1',
        'type' => AccountType::Bank,
        'initial_balance' => '100.00',
    ]);
    app(CreateAccount::class)->handle($user, [
        'name' => 'A2',
        'type' => AccountType::Bank,
        'initial_balance' => '100.00',
    ]);

    $this->actingAs($user)->fromRoute('dashboard')->post(
        route('transactions.store', absolute: false),
        [
            'date' => now()->toDateString(),
            'description' => 'Duplicate account lines',
            'note' => null,
            'accounts' => [
                ['account_id' => $first->id, 'amount' => '10.00'],
                ['account_id' => $first->id, 'amount' => '5.00'],
            ],
            'allocations' => [],
        ],
    )->assertSessionHasErrors(['accounts.0.account_id', 'accounts.1.account_id']);
});

it('rejects duplicate allocation lines on a transaction', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    app(CreateAccount::class)->handle($user, [
        'name' => 'Checking',
        'type' => AccountType::Bank,
        'initial_balance' => '200.00',
    ]);
    $envelope = app(CreateAllocation::class)->handle($user, [
        'name' => 'Envelope 1',
        'type' => AllocationType::Normal,
        'initial_balance' => '0.00',
    ]);
    app(CreateAllocation::class)->handle($user, [
        'name' => 'Envelope 2',
        'type' => AllocationType::Savings,
        'initial_balance' => '0.00',
    ]);

    $this->actingAs($user)->fromRoute('dashboard')->post(
        route('transactions.store', absolute: false),
        [
            'date' => now()->toDateString(),
            'description' => 'Duplicate allocation lines',
            'note' => null,
            'accounts' => [],
            'allocations' => [
                ['allocation_id' => $envelope->id, 'amount' => '10.00'],
                ['allocation_id' => $envelope->id, 'amount' => '3.00'],
            ],
        ],
    )->assertSessionHasErrors([
        'allocations.0.allocation_id',
        'allocations.1.allocation_id',
    ]);
});

it('includes unallocated on the dashboard', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    app(CreateAccount::class)->handle($user, [
        'name' => 'A',
        'type' => AccountType::Bank,
        'initial_balance' => '50.00',
    ]);
    app(CreateAllocation::class)->handle($user, [
        'name' => 'B',
        'type' => AllocationType::Normal,
        'initial_balance' => '20.00',
    ]);

    $this->actingAs($user)
        ->get(route('dashboard', absolute: false))
        ->assertInertia(
            fn ($page) => $page
                ->component('dashboard')
                ->where('unallocated', '30.00')
                ->has('unallocated_allocation_id'),
        );
});
