<?php

declare(strict_types=1);

use App\Enums\AllocationType;
use App\Models\Allocation;
use App\Models\Transaction;
use App\Models\TransactionAllocation;
use App\Models\User;

it('renders the allocation show page', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $allocation = Allocation::query()->create([
        'user_id' => $user->id,
        'name' => 'Groceries',
        'type' => AllocationType::Normal,
        'balance' => '300.00',
        'is_unallocated' => false,
    ]);

    $this->actingAs($user)
        ->get(route('allocations.show', $allocation, absolute: false))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('allocations/show')
            ->has('allocation', fn ($prop) => $prop
                ->where('id', $allocation->id)
                ->where('name', 'Groceries')
                ->where('type', AllocationType::Normal->value)
                ->where('balance', '300.00')
                ->where('is_unallocated', false)
            )
            ->has('accounts')
            ->has('allocations')
        );
});

it('renders the unallocated allocation show page', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $unallocated = Allocation::query()->create([
        'user_id' => $user->id,
        'name' => 'Unallocated',
        'type' => AllocationType::Normal,
        'balance' => '0.00',
        'is_unallocated' => true,
    ]);

    $this->actingAs($user)
        ->get(route('allocations.show', $unallocated, absolute: false))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('allocations/show')
            ->has('allocation', fn ($prop) => $prop
                ->where('id', $unallocated->id)
                ->where('is_unallocated', true)
                ->etc()
            )
        );
});

it('returns 404 for an allocation belonging to another user', function (): void {
    $owner = User::factory()->withoutTwoFactor()->create();
    $other = User::factory()->withoutTwoFactor()->create();
    $allocation = Allocation::query()->create([
        'user_id' => $owner->id,
        'name' => 'Groceries',
        'type' => AllocationType::Normal,
        'balance' => '0.00',
        'is_unallocated' => false,
    ]);

    $this->actingAs($other)
        ->get(route('allocations.show', $allocation, absolute: false))
        ->assertNotFound();
});

it('requires authentication to view the allocation show page', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $allocation = Allocation::query()->create([
        'user_id' => $user->id,
        'name' => 'Groceries',
        'type' => AllocationType::Normal,
        'balance' => '0.00',
        'is_unallocated' => false,
    ]);

    $this->get(route('allocations.show', $allocation, absolute: false))
        ->assertRedirect(route('login', absolute: false));
});

it('only shows transactions for the current allocation on the show page', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();

    $allocation = Allocation::query()->create([
        'user_id' => $user->id,
        'name' => 'Groceries',
        'type' => AllocationType::Normal,
        'balance' => '200.00',
        'is_unallocated' => false,
    ]);

    $otherAllocation = Allocation::query()->create([
        'user_id' => $user->id,
        'name' => 'Rent',
        'type' => AllocationType::Bill,
        'balance' => '0.00',
        'is_unallocated' => false,
    ]);

    $linkedTransaction = Transaction::query()->create([
        'user_id' => $user->id,
        'date' => '2025-01-01',
        'description' => 'Linked',
        'note' => null,
    ]);
    TransactionAllocation::query()->create([
        'transaction_id' => $linkedTransaction->id,
        'allocation_id' => $allocation->id,
        'amount' => '100.00',
    ]);

    $unlinkedTransaction = Transaction::query()->create([
        'user_id' => $user->id,
        'date' => '2025-01-02',
        'description' => 'Not linked',
        'note' => null,
    ]);
    TransactionAllocation::query()->create([
        'transaction_id' => $unlinkedTransaction->id,
        'allocation_id' => $otherAllocation->id,
        'amount' => '50.00',
    ]);

    $linkedCount = Transaction::query()
        ->whereHas('transactionAllocations', fn ($q) => $q->where('allocation_id', $allocation->id))
        ->count();

    expect($linkedCount)->toBe(1);

    $this->actingAs($user)
        ->get(route('allocations.show', $allocation, absolute: false))
        ->assertOk();
});
