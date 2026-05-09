<?php

declare(strict_types=1);

use App\Models\User;

it('shows the transactions index with paginated scroll prop', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();

    $this->actingAs($user)
        ->get(route('transactions.index', absolute: false))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('transactions/index')
            ->has('accounts')
            ->has('allocations')
            ->has('unallocated_allocation_id')
            ->has('transactions'));
});
