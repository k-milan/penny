<?php

declare(strict_types=1);

use App\Enums\AccountType;
use App\Models\Account;
use App\Models\Allocation;
use App\Models\Transaction;
use App\Models\TransactionAccount;
use App\Models\User;

it('deletes an account and redirects', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $account = Account::query()->create([
        'user_id' => $user->id,
        'name' => 'Savings',
        'type' => AccountType::Bank,
        'balance' => '0.00',
    ]);

    $this->actingAs($user)
        ->delete(route('accounts.destroy', $account, absolute: false))
        ->assertRedirectToRoute('accounts.index')
        ->assertSessionHas('success');

    expect(Account::query()->find($account->id))->toBeNull();
});

it('decreases unallocated balance when deleting an account with a positive balance', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();

    $this->actingAs($user)
        ->fromRoute('accounts.create')
        ->post(route('accounts.store', absolute: false), [
            'name' => 'Checking',
            'type' => AccountType::Bank->value,
            'initial_balance' => '100.00',
        ]);

    $account = Account::query()->where('user_id', $user->id)->firstOrFail();
    $unallocated = Allocation::query()->where('user_id', $user->id)->where('is_unallocated', true)->firstOrFail();

    expect((string) $unallocated->balance)->toBe('100.00');

    $this->actingAs($user)
        ->delete(route('accounts.destroy', $account, absolute: false))
        ->assertRedirectToRoute('accounts.index');

    expect((string) $unallocated->fresh()->balance)->toBe('0.00');
});

it('does not alter unallocated balance when deleting a zero-balance account', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();

    $this->actingAs($user)
        ->fromRoute('accounts.create')
        ->post(route('accounts.store', absolute: false), [
            'name' => 'Checking',
            'type' => AccountType::Bank->value,
            'initial_balance' => '50.00',
        ]);

    $zeroAccount = Account::query()->create([
        'user_id' => $user->id,
        'name' => 'Cash',
        'type' => AccountType::Cash,
        'balance' => '0.00',
    ]);

    $unallocated = Allocation::query()->where('user_id', $user->id)->where('is_unallocated', true)->firstOrFail();
    expect((string) $unallocated->balance)->toBe('50.00');

    $this->actingAs($user)
        ->delete(route('accounts.destroy', $zeroAccount, absolute: false))
        ->assertRedirectToRoute('accounts.index');

    expect((string) $unallocated->fresh()->balance)->toBe('50.00');
});

it('prevents deleting an account with linked transaction lines', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $account = Account::query()->create([
        'user_id' => $user->id,
        'name' => 'Savings',
        'type' => AccountType::Bank,
        'balance' => '0.00',
    ]);

    $transaction = Transaction::query()->create([
        'user_id' => $user->id,
        'date' => now()->toDateString(),
        'description' => 'Test',
    ]);

    TransactionAccount::query()->create([
        'transaction_id' => $transaction->id,
        'account_id' => $account->id,
        'amount' => '10.00',
    ]);

    $this->actingAs($user)
        ->delete(route('accounts.destroy', $account, absolute: false))
        ->assertRedirectToRoute('accounts.index')
        ->assertSessionHas('error');

    expect(Account::query()->find($account->id))->not->toBeNull();
});

it('handles deleting a bill split person after their transaction line is replaced', function (bool $replacePerson): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $payment = app(App\Actions\CreateAccount::class)->handle($user, [
        'name' => 'Checking',
        'type' => AccountType::Bank,
        'initial_balance' => '100.00',
    ]);
    $person = app(App\Actions\CreateAccount::class)->handle($user, [
        'name' => 'Duplicate person',
        'type' => AccountType::Person,
        'initial_balance' => '0.00',
    ]);
    $replacement = app(App\Actions\CreateAccount::class)->handle($user, [
        'name' => 'Correct person',
        'type' => AccountType::Person,
        'initial_balance' => '0.00',
    ]);
    $transaction = app(App\Actions\CreateBillSplit::class)->handle($user, [
        'date' => now()->toDateString(),
        'description' => 'Lunch',
        'payment_account_id' => $payment->id,
        'total' => '20.00',
        'items' => [[
            'description' => 'Meal',
            'unit_price' => '20.00',
            'quantity' => 1,
            'assignees' => [['type' => 'account', 'id' => $person->id]],
        ]],
    ]);
    $participant = $transaction->billSplit->participants->sole();

    if ($replacePerson) {
        app(App\Actions\UpdateTransaction::class)->handle($transaction, [
            'date' => now()->toDateString(),
            'description' => 'Lunch',
            'accounts' => [
                ['account_id' => $payment->id, 'amount' => '-20.00'],
                ['account_id' => $replacement->id, 'amount' => '20.00'],
            ],
            'allocations' => [],
        ]);
    }

    $this->actingAs($user)
        ->delete(route('accounts.destroy', $person, absolute: false))
        ->assertRedirectToRoute('accounts.index')
        ->assertSessionHas($replacePerson ? 'success' : 'error');

    expect($person->fresh() === null)->toBe($replacePerson)
        ->and($participant->fresh()->account_id)->toBe($replacePerson ? null : $person->id)
        ->and($participant->fresh()->total)->toBe('20.00')
        ->and((float) $participant->items()->sole()->pivot->amount)->toBe(20.0)
        ->and($payment->fresh()->balance)->toBe('80.00')
        ->and($replacement->fresh()->balance)->toBe($replacePerson ? '20.00' : '0.00');
})->with([true, false]);
