<?php

declare(strict_types=1);

use App\Enums\AccountType;
use App\Enums\AllocationType;
use App\Models\Account;
use App\Models\Allocation;
use App\Models\User;
use Inertia\Testing\AssertableInertia;

function purchaseAccount(User $user, string $name, AccountType $type, string $balance = '0.00'): Account
{
    return Account::query()->create([
        'user_id' => $user->id,
        'name' => $name,
        'type' => $type,
        'balance' => $balance,
    ]);
}

function purchaseAllocation(User $user, string $name, string $balance = '0.00'): Allocation
{
    return Allocation::query()->create([
        'user_id' => $user->id,
        'name' => $name,
        'type' => AllocationType::Normal,
        'balance' => $balance,
        'is_unallocated' => false,
    ]);
}

it('creates an itemized purchase with equal and proportional cent-safe shares', function (): void {
    $user = User::factory()->create();
    $bank = purchaseAccount($user, 'Bank', AccountType::Bank, '1000.00');
    $person = purchaseAccount($user, 'Alex', AccountType::Person);
    $food = purchaseAllocation($user, 'Food', '500.00');

    $response = $this->actingAs($user)->post(route('bill-splits.store'), [
        'date' => '2026-07-02',
        'description' => 'Dinner',
        'payment_account_id' => $bank->id,
        'total' => '110.01',
        'service_charge' => '10.00',
        'items' => [
            [
                'description' => 'Shared platter',
                'quantity' => 1,
                'unit_price' => '100.01',
                'assignees' => [
                    ['type' => 'account', 'id' => $person->id],
                    ['type' => 'allocation', 'id' => $food->id],
                ],
            ],
        ],
    ]);

    $response->assertRedirect();
    $this->assertDatabaseHas('bill_splits', [
        'subtotal' => '100.01',
        'service_charge' => '10.00',
        'total' => '110.01',
    ]);
    $this->assertDatabaseHas('transaction_accounts', [
        'account_id' => $bank->id,
        'amount' => '-110.01',
    ]);
    $this->assertDatabaseHas('transaction_accounts', [
        'account_id' => $person->id,
        'amount' => '55.01',
    ]);
    $this->assertDatabaseHas('transaction_allocations', [
        'allocation_id' => $food->id,
        'amount' => '-55.00',
    ]);
    expect($bank->fresh()->balance)->toBe('889.99')
        ->and($person->fresh()->balance)->toBe('55.01')
        ->and($food->fresh()->balance)->toBe('445.00');
});

it('splits an item by weighted participant shares', function (): void {
    $user = User::factory()->create();
    $bank = purchaseAccount($user, 'Bank', AccountType::Bank, '100.00');
    $person = purchaseAccount($user, 'Alex', AccountType::Person);
    $food = purchaseAllocation($user, 'Food');

    $this->actingAs($user)->post(route('bill-splits.store'), [
        'date' => '2026-07-05',
        'description' => 'Weighted dinner',
        'payment_account_id' => $bank->id,
        'total' => '100.00',
        'items' => [[
            'description' => 'Shared platter',
            'quantity' => 1,
            'unit_price' => '100.00',
            'assignees' => [
                ['type' => 'account', 'id' => $person->id, 'shares' => 2],
                ['type' => 'allocation', 'id' => $food->id, 'shares' => 1],
            ],
        ]],
    ])->assertRedirect();

    $this->assertDatabaseHas('transaction_accounts', [
        'account_id' => $person->id,
        'amount' => '66.67',
    ]);
    $this->assertDatabaseHas('transaction_allocations', [
        'allocation_id' => $food->id,
        'amount' => '-33.33',
    ]);
    $this->assertDatabaseHas('bill_split_item_participant', [
        'shares' => 2,
        'amount' => '66.67',
    ]);
});

it('creates one ad hoc person across multiple items atomically', function (): void {
    $user = User::factory()->create();
    $bank = purchaseAccount($user, 'Cash', AccountType::Cash, '100.00');

    $this->actingAs($user)->post(route('bill-splits.store'), [
        'date' => '2026-07-02',
        'description' => 'Snacks',
        'payment_account_id' => $bank->id,
        'total' => '30.00',
        'items' => [
            [
                'description' => 'One',
                'quantity' => 1,
                'unit_price' => '10.00',
                'assignees' => [['type' => 'new_person', 'name' => 'Jamie']],
            ],
            [
                'description' => 'Two',
                'quantity' => 2,
                'unit_price' => '10.00',
                'assignees' => [['type' => 'new_person', 'name' => 'Jamie']],
            ],
        ],
    ])->assertRedirect();

    expect(Account::query()->where('user_id', $user->id)->where('name', 'Jamie')->count())->toBe(1);
    $jamie = Account::query()->where('user_id', $user->id)->where('name', 'Jamie')->firstOrFail();
    expect($jamie->balance)->toBe('30.00');
});

it('rejects unreconciled and foreign-user bill data without side effects', function (): void {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $bank = purchaseAccount($user, 'Bank', AccountType::Bank, '100.00');
    $foreignPerson = purchaseAccount($other, 'Other person', AccountType::Person);

    $this->actingAs($user)->post(route('bill-splits.store'), [
        'date' => '2026-07-02',
        'description' => 'Invalid',
        'payment_account_id' => $bank->id,
        'total' => '20.00',
        'items' => [[
            'description' => 'Item',
            'quantity' => 1,
            'unit_price' => '10.00',
            'assignees' => [['type' => 'account', 'id' => $foreignPerson->id]],
        ]],
    ])->assertSessionHasErrors();

    $this->assertDatabaseCount('transactions', 0);
    $this->assertDatabaseCount('bill_splits', 0);
    expect($bank->fresh()->balance)->toBe('100.00');
});

it('exposes only a persons own itemized share on their public link', function (): void {
    $user = User::factory()->create();
    $bank = purchaseAccount($user, 'Bank', AccountType::Bank, '100.00');
    $person = purchaseAccount($user, 'Alex', AccountType::Person);
    $person->update(['share_token' => 'person-share-token']);
    $food = purchaseAllocation($user, 'Food');

    $this->actingAs($user)->post(route('bill-splits.store'), [
        'date' => '2026-07-02',
        'description' => 'Lunch',
        'payment_account_id' => $bank->id,
        'total' => '22.00',
        'service_charge' => '2.00',
        'items' => [[
            'description' => 'Meal',
            'quantity' => 2,
            'unit_price' => '10.00',
            'assignees' => [
                ['type' => 'account', 'id' => $person->id],
                ['type' => 'allocation', 'id' => $food->id],
            ],
        ]],
    ])->assertRedirect();

    auth()->logout();
    $this->get(route('accounts.share', 'person-share-token'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('transactions.data.0.bill.items.0.description', 'Meal')
            ->where('transactions.data.0.bill.items.0.amount', '10.00')
            ->where('transactions.data.0.bill.service_charge', '1.00')
            ->where('transactions.data.0.bill.total', '11.00')
            ->missing('transactions.data.0.bill.payment_account')
            ->missing('transactions.data.0.bill.participants')
            ->missing('transactions.data.0.bill.allocations'));
});

it('records a simple purchase without creating a bill split', function (): void {
    $user = User::factory()->create();
    $bank = purchaseAccount($user, 'Bank', AccountType::Bank, '100.00');
    $food = purchaseAllocation($user, 'Food', '50.00');

    $this->actingAs($user)->post(route('purchases.store'), [
        'date' => '2026-07-02',
        'description' => 'Groceries',
        'payment_account_id' => $bank->id,
        'allocation_id' => $food->id,
        'total' => '25.00',
    ])->assertRedirect();

    $this->assertDatabaseCount('transactions', 1);
    $this->assertDatabaseCount('bill_splits', 0);
    expect($bank->fresh()->balance)->toBe('75.00')
        ->and($food->fresh()->balance)->toBe('25.00');
});

it('renders bill splitting as its own page', function (): void {
    $user = User::factory()->create();
    purchaseAccount($user, 'Bank', AccountType::Bank);
    purchaseAllocation($user, 'Food');

    $this->actingAs($user)
        ->get(route('bill-splits.create'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('bill-splits/create')
            ->has('accounts', 1)
            ->has('allocations', 2));
});
