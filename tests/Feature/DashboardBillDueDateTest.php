<?php

declare(strict_types=1);

use App\Enums\AllocationType;
use App\Models\Allocation;
use App\Models\User;
use Inertia\Testing\AssertableInertia;

it('advances past bill due dates to the same day in the next current or future month', function (): void {
    $this->travelTo('2026-07-09 09:00:00');

    $user = User::factory()->create();
    $bill = Allocation::query()->create([
        'user_id' => $user->id,
        'name' => 'Internet',
        'type' => AllocationType::Bill,
        'due_date' => '2026-06-05',
        'due_day' => 5,
        'balance' => '0.00',
    ]);

    $this->actingAs($user)
        ->get(route('dashboard', absolute: false))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('dashboard')
            ->where('allocations.0.id', $bill->id)
            ->where('allocations.0.due_date', '2026-08-05')
            ->where('allocations.0.due_day', 5));

    expect($bill->fresh()->due_date?->toDateString())->toBe('2026-08-05')
        ->and($bill->fresh()->due_day)->toBe(5);
});

it('keeps end-of-month bill intent when shorter months roll over', function (): void {
    $this->travelTo('2026-03-01 09:00:00');

    $user = User::factory()->create();
    $bill = Allocation::query()->create([
        'user_id' => $user->id,
        'name' => 'Rent',
        'type' => AllocationType::Bill,
        'due_date' => '2026-02-28',
        'due_day' => 31,
        'balance' => '0.00',
    ]);

    $this->actingAs($user)
        ->get(route('dashboard', absolute: false))
        ->assertOk();

    expect($bill->fresh()->due_date?->toDateString())->toBe('2026-03-31')
        ->and($bill->fresh()->due_day)->toBe(31);
});
