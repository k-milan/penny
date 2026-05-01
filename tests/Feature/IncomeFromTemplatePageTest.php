<?php

declare(strict_types=1);

use App\Actions\CreateAccount;
use App\Actions\CreateAllocation;
use App\Enums\AccountType;
use App\Enums\AllocationType;
use App\Enums\IncomePayoutFrequency;
use App\Models\Allocation;
use App\Models\IncomeTemplate;
use App\Models\User;

it('redirects guests from the record income page', function (): void {
    $this->get(route('transactions.income', absolute: false))
        ->assertRedirect(route('login', absolute: false));
});

it('shows the record income page with serialized templates', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $account = app(CreateAccount::class)->handle($user, [
        'name' => 'Checking',
        'type' => AccountType::Bank,
        'initial_balance' => '0.00',
    ]);
    $allocation = app(CreateAllocation::class)->handle($user, [
        'name' => 'Savings pool',
        'type' => AllocationType::Normal,
    ]);
    $unallocated = Allocation::query()
        ->where('user_id', $user->id)
        ->where('is_unallocated', true)
        ->firstOrFail();

    $template = IncomeTemplate::factory()->for($user)->create([
        'name' => 'Salary',
        'payout_frequency' => IncomePayoutFrequency::Monthly,
        'expected_income' => '50000.00',
        'company_name' => 'Acme',
        'description' => 'Notes',
    ]);
    $template->accounts()->attach($account->id, ['amount' => '50000.00']);
    $template->allocations()->attach([
        $allocation->id => ['amount' => '10000.00'],
        $unallocated->id => ['amount' => '40000.00'],
    ]);

    $this->actingAs($user)
        ->get(route('transactions.income', absolute: false))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('transactions/income-from-template')
            ->has('incomeTemplates', 1)
            ->has('accounts', 1)
            ->has('allocations', 1)
            ->where('unallocated_allocation_id', $unallocated->id));
});

it('stores a balanced income-like transaction with unallocated top-up', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $account = app(CreateAccount::class)->handle($user, [
        'name' => 'Checking',
        'type' => AccountType::Bank,
        'initial_balance' => '0.00',
    ]);
    $allocation = app(CreateAllocation::class)->handle($user, [
        'name' => 'Household',
        'type' => AllocationType::Normal,
    ]);
    $unallocated = Allocation::query()
        ->where('user_id', $user->id)
        ->where('is_unallocated', true)
        ->firstOrFail();

    $template = IncomeTemplate::factory()->for($user)->create([
        'name' => 'Payroll',
        'expected_income' => '1000.00',
    ]);
    $template->accounts()->attach($account->id, ['amount' => '1000.00']);
    $template->allocations()->attach([
        $allocation->id => ['amount' => '400.00'],
        $unallocated->id => ['amount' => '600.00'],
    ]);

    $this->actingAs($user)
        ->fromRoute('transactions.income')
        ->post(route('transactions.store', absolute: false), [
            'date' => now()->toDateString(),
            'description' => $template->name,
            'note' => 'Income note',
            'accounts' => [
                ['account_id' => $account->id, 'amount' => '1000.00'],
            ],
            'allocations' => [
                ['allocation_id' => $allocation->id, 'amount' => '400.00'],
                ['allocation_id' => $unallocated->id, 'amount' => '600.00'],
            ],
        ])
        ->assertRedirectToRoute('dashboard')
        ->assertSessionHasNoErrors();

    $this->assertDatabaseCount('transactions', 1);
    expect($account->fresh()->balance)->toBe('1000.00');
    expect($allocation->fresh()->balance)->toBe('400.00');
    expect($unallocated->fresh()->balance)->toBe('600.00');
});
