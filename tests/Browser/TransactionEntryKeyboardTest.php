<?php

declare(strict_types=1);

use App\Enums\AccountType;
use App\Enums\AllocationType;
use App\Models\Account;
use App\Models\Allocation;
use App\Models\User;

it('opens bill payment transactions with the tracked bill selected', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();

    Account::query()->create([
        'user_id' => $user->id,
        'name' => 'Checking',
        'type' => AccountType::Bank,
        'balance' => '500.00',
    ]);

    $bill = Allocation::query()->create([
        'user_id' => $user->id,
        'name' => 'Electricity',
        'type' => AllocationType::Bill,
        'due_date' => now()->addWeek()->toDateString(),
        'due_day' => now()->addWeek()->day,
        'balance' => '100.00',
        'is_unallocated' => false,
    ]);

    $this->actingAs($user);

    $page = visit(route('transactions.index'));
    $page->press('New transaction')->press('Pay a bill');

    expect($page->script('document.querySelector("#is-bill-payment")?.getAttribute("data-state")'))->toBe('checked')
        ->and($page->value('[aria-label="Bill being paid"]'))->toBe((string) $bill->id)
        ->and($page->script('document.querySelector("[role=dialog][data-state=open] h2")?.textContent?.trim()'))->toBe('Pay a bill');

    $page = visit(route('dashboard'));
    $page->click('[aria-label="Add"]')->press('Pay a bill');

    expect($page->script('document.querySelector("#is-bill-payment")?.getAttribute("data-state")'))->toBe('checked')
        ->and($page->value('[aria-label="Bill being paid"]'))->toBe((string) $bill->id);
});

it('tabs through a purchase without looping back to add allocation', function (): void {
    $user = User::factory()->create();

    Account::query()->create([
        'user_id' => $user->id,
        'name' => 'Checking',
        'type' => AccountType::Bank,
        'balance' => '100.00',
    ]);

    Allocation::query()->create([
        'user_id' => $user->id,
        'name' => 'Groceries',
        'type' => AllocationType::Normal,
        'balance' => '100.00',
        'is_unallocated' => false,
    ]);
    Allocation::query()->create([
        'user_id' => $user->id,
        'name' => 'Dining',
        'type' => AllocationType::Normal,
        'balance' => '100.00',
        'is_unallocated' => false,
    ]);
    $this->actingAs($user);

    $page = visit(route('transactions.index'));
    $page->press('New transaction')->press('Purchase');
    $page->fill('#purchase-description', 'Eggs');
    $page->click('[aria-label="Payment account"]')->click('[role="option"]');
    $page->click('[aria-label="Purchase allocation"]')->click('[role="option"]:has-text("Groceries")');
    $page->fill('#purchase-amount', '10');
    $page->fill('[aria-label="Allocation amount"]', '10');
    $page->keys('[aria-label="Payment account"]', 'Tab');

    expect($page->script('document.activeElement?.id'))->toBe('purchase-amount');

    $page->keys('#purchase-amount', 'Tab');

    expect($page->script('document.activeElement?.id'))->toBe('purchase-add-allocation');

    $page->keys('#purchase-add-allocation', 'Tab');

    expect($page->script('document.activeElement?.id'))->toBe('purchase-allocation-0');

    $page->keys('[aria-label="Allocation amount"]', 'Tab');

    expect($page->script('document.activeElement?.id'))->toBe('purchase-note');

    $page->keys('#purchase-note', 'Tab');

    expect($page->script('document.activeElement?.id'))->toBe('purchase-submit');
});

it('keeps each credit-card purchase split paired with its own add button', function (): void {
    $user = User::factory()->create();

    foreach ([
        ['Checking', AccountType::Bank],
        ['Credit card', AccountType::CreditCard],
        ['Alex', AccountType::Person],
        ['Jamie', AccountType::Person],
    ] as [$name, $type]) {
        Account::query()->create([
            'user_id' => $user->id,
            'name' => $name,
            'type' => $type,
            'balance' => '100.00',
        ]);
    }

    Allocation::query()->create([
        'user_id' => $user->id,
        'name' => 'Groceries',
        'type' => AllocationType::Normal,
        'balance' => '100.00',
        'is_unallocated' => false,
    ]);
    Allocation::query()->create([
        'user_id' => $user->id,
        'name' => 'Dining',
        'type' => AllocationType::Normal,
        'balance' => '100.00',
        'is_unallocated' => false,
    ]);

    $this->actingAs($user);

    $page = visit(route('transactions.index'));
    $page->press('New transaction')->press('Credit Card');

    $page->keys('[data-addable-line-list="credit-purchase-allocations"] input[inputmode="decimal"]', 'Tab');

    expect($page->script('document.activeElement?.dataset?.addableLineAdd'))->toBe('credit-purchase-allocations');

    $page->script('document.querySelector("[data-addable-line-add=\"credit-purchase-people\"]")?.click()');
    $page->wait(0.1);
    $page->keys('[data-addable-line-list="credit-purchase-people"] input[inputmode="decimal"]', 'Tab');

    expect($page->script('document.activeElement?.dataset?.addableLineAdd'))->toBe('credit-purchase-people');
});

it('moves keyboard focus into the create-choice modal when it opens', function (): void {
    $this->actingAs(User::factory()->create());

    $page = visit(route('transactions.index'));
    $page->press('New transaction');

    expect($page->script('document.querySelector("[role=\"dialog\"]")?.contains(document.activeElement)'))->toBeTrue();
});

it('navigates the displayed week without changing the selected date', function (): void {
    $this->actingAs(User::factory()->create());

    $page = visit(route('bill-splits.create'));
    $selectedDate = $page->value('#bill-date');

    expect($page->script('document.querySelector("#bill-date")?.parentElement?.querySelectorAll("[role=\"radio\"]").length'))->toBe(7);

    $page->script('document.querySelector("#bill-date")?.parentElement?.querySelector("[aria-label=\"Previous week\"]")?.click()');

    expect($page->value('#bill-date'))->toBe($selectedDate);
});

it('tabs from the last account amount to add and focuses the new line', function (): void {
    $this->actingAs(User::factory()->create());

    $page = visit(route('income-templates.create'));

    $page->keys('input[id^="acct-amt-"]', 'Tab');

    expect($page->script('document.activeElement?.textContent?.trim()'))->toBe('Add account');

    $page->press('Add account')->wait(0.1);

    expect($page->script('document.activeElement?.getAttribute("aria-label")'))->toBe('Account');

    $page->script('document.querySelector("input[id^=\"alloc-amt-\"]")?.focus()');
    $page->keys('input[id^="alloc-amt-"]', 'Tab');

    expect($page->script('document.activeElement?.textContent?.trim()'))->toBe('Add allocation');
});
