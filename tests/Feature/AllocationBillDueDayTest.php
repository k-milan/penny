<?php

declare(strict_types=1);

use App\Enums\AllocationType;
use App\Models\Allocation;
use App\Models\User;

it('stores the recurring due day when creating a bill allocation', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('allocations.store', absolute: false), [
            'name' => 'Internet',
            'type' => AllocationType::Bill->value,
            'due_date' => '2026-07-15',
            'initial_balance' => '0.00',
        ])
        ->assertRedirect(route('allocations.index', absolute: false));

    $allocation = Allocation::query()
        ->where('user_id', $user->id)
        ->where('name', 'Internet')
        ->firstOrFail();

    expect($allocation->due_date?->toDateString())->toBe('2026-07-15')
        ->and($allocation->due_day)->toBe(15);
});

it('updates and clears the recurring due day with allocation type changes', function (): void {
    $user = User::factory()->create();
    $allocation = Allocation::query()->create([
        'user_id' => $user->id,
        'name' => 'Internet',
        'type' => AllocationType::Bill,
        'due_date' => '2026-07-15',
        'due_day' => 15,
        'balance' => '0.00',
    ]);

    $this->actingAs($user)
        ->patch(route('allocations.update', $allocation, absolute: false), [
            'name' => 'Internet',
            'type' => AllocationType::Bill->value,
            'due_date' => '2026-08-20',
        ])
        ->assertRedirect(route('allocations.index', absolute: false));

    expect($allocation->fresh()->due_date?->toDateString())->toBe('2026-08-20')
        ->and($allocation->fresh()->due_day)->toBe(20);

    $this->actingAs($user)
        ->patch(route('allocations.update', $allocation, absolute: false), [
            'name' => 'Internet',
            'type' => AllocationType::Normal->value,
        ])
        ->assertRedirect(route('allocations.index', absolute: false));

    expect($allocation->fresh()->due_date)->toBeNull()
        ->and($allocation->fresh()->due_day)->toBeNull();
});
