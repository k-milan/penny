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
