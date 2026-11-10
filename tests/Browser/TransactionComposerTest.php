<?php

declare(strict_types=1);

use App\Enums\AccountType;
use App\Enums\AllocationType;
use App\Models\Account;
use App\Models\Allocation;
use App\Models\Transaction;
use App\Models\User;

it('saves composer movements with the correct balanced ledger effects', function (array $starting, array $other): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $entities = [];
    foreach (['Checking' => AccountType::Bank, 'Cash' => AccountType::Cash, 'Card' => AccountType::CreditCard, 'Sister' => AccountType::Person, 'Friend' => AccountType::Person] as $name => $type) {
        $entities[$name] = Account::query()->create(['user_id' => $user->id, 'name' => $name, 'type' => $type, 'balance' => '0.00']);
    }
    foreach (['Food', 'Personal'] as $name) {
        $entities[$name] = Allocation::query()->create(['user_id' => $user->id, 'name' => $name, 'type' => AllocationType::Normal, 'balance' => '0.00', 'is_unallocated' => false]);
    }
    $this->actingAs($user);
    $page = visit(route('transactions.index'));
    $page->press('New transaction')->press('button:has-text("Composer (experimental)")')->fill('#composer-description', 'Composer test');

    $anchorSign = (float) $starting[0][1] > 0 ? 1 : -1;
    $flow = $anchorSign * ($entities[$starting[0][0]] instanceof Account ? 1 : -1);

    foreach ([[$starting, 'start'], [$other, 'other']] as [$rows, $side]) {
        foreach ($rows as $index => [$name, $amount]) {
            if ($index > 0) {
                $page->press($side === 'start' ? 'Another starting movement' : 'button:has-text("Split / add another")');
            }
            $prefix = '#composer-'.$side.'-'.$index;
            $page->fill($prefix.'-entity', $name)->click('[role="option"]');
            $sign = (float) $amount > 0 ? 1 : -1;
            $defaultSign = $flow * ($entities[$name] instanceof Account ? 1 : -1) * ($side === 'start' ? 1 : -1);
            if ($side === 'start' && $index === 0) {
                $page->select($prefix.'-direction', (string) $sign);
            } else {
                $page->assertSelected($prefix.'-direction', (string) $defaultSign);
                if ($sign !== $defaultSign) {
                    $page->select($prefix.'-direction', (string) $sign);
                }
            }
            $page->click($prefix.'-amount')->fill($prefix.'-amount', mb_ltrim($amount, '-'));
        }
    }

    $page->assertSee('Everything is accounted for')->assertEnabled('#composer-save')->assertNoJavascriptErrors()->press('Save transaction')->assertDontSee('Experimental · Start with one change');
    $transaction = $user->transactions()->where('description', 'Composer test')->sole();
    expect($transaction->transactionAccounts()->count() + $transaction->transactionAllocations()->count())->toBe(count($starting) + count($other));
    foreach (array_merge($starting, $other) as [$name, $amount]) {
        $entity = $entities[$name];
        $lines = $entity instanceof Account ? $transaction->transactionAccounts() : $transaction->transactionAllocations();
        $foreignKey = $entity instanceof Account ? 'account_id' : 'allocation_id';
        expect($lines->where($foreignKey, $entity->id)->sole()->amount)->toBe(number_format((float) $amount, 2, '.', ''))
            ->and($entity->fresh()->balance)->toBe(number_format((float) $amount, 2, '.', ''));
    }
})->with([
    'bank purchase' => [[['Checking', '-1000']], [['Food', '-1000']]],
    'card purchase split between budgets' => [[['Card', '-1000']], [['Food', '-600'], ['Personal', '-400']]],
    'income split between budgets' => [[['Checking', '1000']], [['Food', '600'], ['Personal', '400']]],
    'card payment' => [[['Checking', '-1000']], [['Card', '1000']]],
    'card payment starting at card' => [[['Card', '1000']], [['Checking', '-1000']]],
    'lend or repay person' => [[['Checking', '-1000']], [['Sister', '1000']]],
    'borrow or receive repayment' => [[['Checking', '1000']], [['Sister', '-1000']]],
    'shared card purchase' => [[['Card', '-1000']], [['Food', '-600'], ['Sister', '400']]],
    'card purchase entirely for someone else' => [[['Card', '-1000']], [['Sister', '1000']]],
    'person covers own and another persons spending' => [[['Sister', '-1000']], [['Food', '-600'], ['Friend', '400']]],
    'person covers my spending' => [[['Sister', '-1000']], [['Food', '-1000']]],
    'budget increase against person receivable' => [[['Sister', '1000']], [['Food', '1000']]],
    'start at allocation for purchase' => [[['Food', '-1000']], [['Card', '-1000']]],
    'budget transfer' => [[['Personal', '-1000']], [['Food', '1000']]],
    'person to person' => [[['Sister', '-1000']], [['Friend', '1000']]],
    'account transfer' => [[['Checking', '-1000']], [['Cash', '1000']]],
    'withdrawal with fee' => [[['Checking', '-1020']], [['Cash', '1000'], ['Personal', '-20']]],
    'card cash advance with fee' => [[['Card', '-1020']], [['Checking', '1000'], ['Personal', '-20']]],
    'card cash advance' => [[['Checking', '1000']], [['Card', '-1000']]],
    'repayment with expense difference' => [[['Checking', '600']], [['Sister', '-620'], ['Personal', '-20']]],
    'income partly held for people' => [[['Checking', '1000']], [['Sister', '-600'], ['Food', '400']]],
    'multiple payment sources and allocations' => [[['Checking', '-600'], ['Cash', '-400']], [['Food', '-900'], ['Personal', '-100']]],
    'shared purchase with change' => [[['Checking', '-1450']], [['Cash', '500'], ['Sister', '580'], ['Personal', '-370']]],
    'card credit restores budget' => [[['Card', '405']], [['Personal', '405']]],
]);

it('keeps existing flows and prevents invalid composer submissions', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    Account::query()->create(['user_id' => $user->id, 'name' => 'Checking', 'type' => AccountType::Bank, 'balance' => '1000.00']);
    Allocation::query()->create(['user_id' => $user->id, 'name' => 'Food', 'type' => AllocationType::Normal, 'balance' => '1000.00', 'is_unallocated' => false]);
    $this->actingAs($user);
    $page = visit(route('transactions.index'));
    $page->press('New transaction')->assertSee('Purchase')->assertSee('Transfer')->assertSee('Loan')->assertSee('Credit Card')->press('button:has-text("Composer (experimental)")')->assertDisabled('#composer-save');
    $page->fill('#composer-description', 'Invalid entry')->fill('#composer-start-0-entity', 'Checking')->click('[role="option"]')->fill('#composer-start-0-amount', '100')->fill('#composer-other-0-entity', 'Food')->click('[role="option"]')->assertEnabled('#composer-save');
    $page->click('#composer-other-0-amount')->fill('#composer-other-0-amount', '90')->assertSee('left to explain')->assertDisabled('#composer-save');
    $page->click('#composer-other-0-amount')->fill('#composer-other-0-amount', '-100')->assertDisabled('#composer-save');
    $page->click('#composer-other-0-amount')->fill('#composer-other-0-amount', '0')->assertDisabled('#composer-save');
    $page->click('#composer-other-0-amount')->fill('#composer-other-0-amount', '100')->assertEnabled('#composer-save')->press('Cancel');
    expect(Transaction::query()->count())->toBe(0);
    $page->press('New transaction')->press('button:has-text("Composer (experimental)")')->assertValue('#composer-description', '')->assertDisabled('#composer-save')->press('Cancel');
    $page = visit(route('dashboard'));
    $page->click('[aria-label="Add"]')->press('button:has-text("Composer (experimental)")')->assertSee('Start with')->assertSee('Explained by')->assertNoJavascriptErrors();
});

it('previews crossing a person balance and works on a narrow screen', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $bank = Account::query()->create(['user_id' => $user->id, 'name' => 'Checking', 'type' => AccountType::Bank, 'balance' => '1000.00']);
    $person = Account::query()->create(['user_id' => $user->id, 'name' => 'Sister', 'type' => AccountType::Person, 'balance' => '-600.00']);
    $this->actingAs($user);
    $page = visit(route('transactions.index'));
    $page->press('New transaction')->press('button:has-text("Composer (experimental)")')->fill('#composer-description', 'Settle and lend')->fill('#composer-start-0-entity', 'Checking')->click('[role="option"]')->fill('#composer-start-0-amount', '1000')->fill('#composer-other-0-entity', 'Sister')->click('[role="option"]')->assertSee('You owe them ₱600.00 → They owe you ₱400.00')->screenshot(false, 'composer-desktop');
    $page->resize(375, 812)->assertEnabled('#composer-save')->assertNoJavascriptErrors();
    expect($page->script('document.documentElement.scrollWidth <= window.innerWidth'))->toBeTrue();
    $page->screenshot(false, 'composer-mobile')->press('Save transaction')->assertDontSee('Experimental · Start with one change');
    expect($bank->fresh()->balance)->toBe('0.00')->and($person->fresh()->balance)->toBe('400.00');
});
