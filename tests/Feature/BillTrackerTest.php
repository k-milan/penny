<?php

declare(strict_types=1);

use App\Enums\AccountType;
use App\Enums\AllocationType;
use App\Models\Account;
use App\Models\Allocation;
use App\Models\BillPeriod;
use App\Models\User;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia;

afterEach(function (): void {
    CarbonImmutable::setTestNow();
});

function trackerBill(User $user, string $name = 'Electricity'): Allocation
{
    return Allocation::query()->create([
        'user_id' => $user->id,
        'name' => $name,
        'type' => AllocationType::Bill,
        'due_date' => '2026-09-24',
        'due_day' => 24,
        'balance' => '0.00',
        'is_unallocated' => false,
    ]);
}

it('provides bill allocations and monthly periods for the tracker matrix', function (): void {
    CarbonImmutable::setTestNow('2026-09-12');
    $user = User::factory()->withoutTwoFactor()->create();
    $bill = trackerBill($user);

    $this->actingAs($user)
        ->get(route('bills.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('bills/index')
            ->where('bills.0.name', 'Electricity')
            ->where('bills.0.key', 'allocation:'.$bill->id)
            ->has('months', 8)
            ->where('months.5.key', '2026-09')
            ->where('months.5.bills.allocation:'.$bill->id.'.due_date', '2026-09-24')
            ->where('months.5.bills.allocation:'.$bill->id.'.needs_confirmation', true));

    expect(BillPeriod::query()->where('user_id', $user->id)->count())->toBe(8);
});

it('confirms the amount and due date for one monthly bill', function (): void {
    CarbonImmutable::setTestNow('2026-09-12');
    $user = User::factory()->withoutTwoFactor()->create();
    $bill = trackerBill($user);
    $this->actingAs($user)->get(route('bills.index'));
    $period = BillPeriod::query()
        ->where('allocation_id', $bill->id)
        ->whereDate('period', '2026-09-01')
        ->firstOrFail();

    $this->actingAs($user)
        ->patch(route('bills.update', $period), [
            'due_date' => '2026-09-26',
            'due_amount' => '153.42',
        ])
        ->assertRedirect();

    expect($period->fresh())
        ->due_amount->toBe('153.42')
        ->confirmed_at->not->toBeNull()
        ->and($bill->fresh()->due_day)->toBe(26);
});

it('only counts transactions explicitly marked as bill payments', function (): void {
    CarbonImmutable::setTestNow('2026-09-12');
    $user = User::factory()->withoutTwoFactor()->create();
    $bill = trackerBill($user);
    $bank = Account::query()->create([
        'user_id' => $user->id,
        'name' => 'Bank',
        'type' => AccountType::Bank,
        'balance' => '500.00',
    ]);
    $card = Account::query()->create([
        'user_id' => $user->id,
        'name' => 'Card',
        'type' => AccountType::CreditCard,
        'balance' => '-200.00',
    ]);

    $this->actingAs($user)->post(route('transactions.store'), [
        'date' => '2026-09-15',
        'description' => 'Card payment',
        'bill_allocation_id' => $bill->id,
        'accounts' => [
            ['account_id' => $bank->id, 'amount' => '-125.00'],
            ['account_id' => $card->id, 'amount' => '125.00'],
        ],
        'allocations' => [],
    ])->assertRedirect();

    $this->actingAs($user)->post(route('transactions.store'), [
        'date' => '2026-09-16',
        'description' => 'Unrelated card activity',
        'accounts' => [
            ['account_id' => $bank->id, 'amount' => '-10.00'],
            ['account_id' => $card->id, 'amount' => '10.00'],
        ],
        'allocations' => [],
    ])->assertRedirect();

    $this->actingAs($user)
        ->get(route('bills.index'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('months.5.bills.allocation:'.$bill->id.'.paid_amount', '125.00'));
});

it('tracks credit cards as monthly bills and counts card payments', function (): void {
    CarbonImmutable::setTestNow('2026-09-12');
    $user = User::factory()->withoutTwoFactor()->create();
    $bank = Account::query()->create([
        'user_id' => $user->id,
        'name' => 'Checking',
        'type' => AccountType::Bank,
        'balance' => '500.00',
    ]);
    $card = Account::query()->create([
        'user_id' => $user->id,
        'name' => 'Visa',
        'type' => AccountType::CreditCard,
        'balance' => '-200.00',
    ]);

    $this->actingAs($user)->post(route('transactions.store'), [
        'date' => '2026-09-15',
        'description' => 'Visa payment',
        'accounts' => [
            ['account_id' => $bank->id, 'amount' => '-75.00'],
            ['account_id' => $card->id, 'amount' => '75.00'],
        ],
        'allocations' => [],
    ])->assertRedirect();

    $this->actingAs($user)
        ->get(route('bills.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('bills.0.key', 'account:'.$card->id)
            ->where('bills.0.name', 'Visa')
            ->where('months.5.bills.account:'.$card->id.'.due_date', '2026-09-30')
            ->where('months.5.bills.account:'.$card->id.'.paid_amount', '75.00'));

    $period = BillPeriod::query()
        ->where('account_id', $card->id)
        ->whereDate('period', '2026-09-01')
        ->firstOrFail();

    $this->actingAs($user)
        ->patch(route('bills.update', $period), [
            'due_date' => '2026-09-22',
            'due_amount' => '180.00',
        ])
        ->assertRedirect();

    expect($card->fresh())
        ->due_day->toBe(22)
        ->due_date->toDateString()->toBe('2026-09-22');
});

it('rejects a bill payment link to another users bill', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $other = User::factory()->withoutTwoFactor()->create();
    $foreignBill = trackerBill($other);
    $account = Account::query()->create([
        'user_id' => $user->id,
        'name' => 'Bank',
        'type' => AccountType::Bank,
        'balance' => '100.00',
    ]);

    $this->actingAs($user)->post(route('transactions.store'), [
        'date' => '2026-09-15',
        'description' => 'Invalid payment',
        'bill_allocation_id' => $foreignBill->id,
        'accounts' => [['account_id' => $account->id, 'amount' => '0.00']],
        'allocations' => [],
    ])->assertSessionHasErrors('bill_allocation_id');
});
