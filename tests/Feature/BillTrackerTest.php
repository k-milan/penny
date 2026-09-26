<?php

declare(strict_types=1);

use App\Enums\AccountType;
use App\Enums\AllocationType;
use App\Models\Account;
use App\Models\Allocation;
use App\Models\BillPeriod;
use App\Models\Transaction;
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
            ->has('months', 3)
            ->where('months.0.key', '2026-09')
            ->where('months.0.bills.allocation:'.$bill->id.'.due_date', '2026-09-24')
            ->where('months.0.bills.allocation:'.$bill->id.'.needs_confirmation', true));

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

it('credits a payment to its selected bill month regardless of payment date', function (): void {
    CarbonImmutable::setTestNow('2026-09-12');
    $user = User::factory()->withoutTwoFactor()->create();
    $bill = trackerBill($user, 'BDO');
    $bank = Account::query()->create([
        'user_id' => $user->id,
        'name' => 'Checking',
        'type' => AccountType::Bank,
        'balance' => '500.00',
    ]);
    $card = Account::query()->create([
        'user_id' => $user->id,
        'name' => 'Card',
        'type' => AccountType::CreditCard,
        'balance' => '-200.00',
    ]);

    $this->actingAs($user)->get(route('transactions.index'))->assertOk();

    $septemberPeriod = BillPeriod::query()
        ->where('allocation_id', $bill->id)
        ->whereDate('period', '2026-09-01')
        ->firstOrFail();
    $septemberPeriod->update([
        'due_date' => '2026-10-09',
        'due_amount' => '100.00',
        'confirmed_at' => now(),
    ]);

    $this->actingAs($user)->post(route('transactions.store'), [
        'date' => '2026-10-02',
        'description' => 'Pay BDO',
        'bill_allocation_id' => $bill->id,
        'bill_period_id' => $septemberPeriod->id,
        'accounts' => [
            ['account_id' => $bank->id, 'amount' => '-100.00'],
            ['account_id' => $card->id, 'amount' => '100.00'],
        ],
        'allocations' => [],
    ])->assertRedirect();

    expect(Transaction::query()->latest('id')->firstOrFail()->bill_period_id)
        ->toBe($septemberPeriod->id);

    $this->actingAs($user)
        ->get(route('bills.index'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('months.0.key', '2026-09')
            ->where('months.0.bills.allocation:'.$bill->id.'.due_date', '2026-10-09')
            ->where('months.0.bills.allocation:'.$bill->id.'.paid_amount', '100.00'));
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
            ->where('months.0.bills.allocation:'.$bill->id.'.paid_amount', '125.00'));
});

it('only includes previous months that contain bill payments', function (): void {
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
        'date' => '2026-07-15',
        'description' => 'Electricity payment',
        'bill_allocation_id' => $bill->id,
        'accounts' => [
            ['account_id' => $bank->id, 'amount' => '-90.00'],
            ['account_id' => $card->id, 'amount' => '90.00'],
        ],
        'allocations' => [],
    ])->assertRedirect();

    $this->actingAs($user)
        ->get(route('bills.index'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->has('months', 4)
            ->where('months.0.key', '2026-07')
            ->where('months.0.bills.allocation:'.$bill->id.'.paid_amount', '90.00')
            ->where('months.1.key', '2026-09')
            ->where('months.2.key', '2026-10')
            ->where('months.3.key', '2026-11'));
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
            ->where('months.0.bills.account:'.$card->id.'.due_date', '2026-09-30')
            ->where('months.0.bills.account:'.$card->id.'.paid_amount', '75.00'));

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
