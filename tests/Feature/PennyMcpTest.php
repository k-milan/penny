<?php

declare(strict_types=1);

use App\Actions\CreateTransaction as CreateTransactionAction;
use App\Mcp\Servers\PennyServer;
use App\Mcp\Tools\CreateTransaction;
use App\Mcp\Tools\DeleteTransaction;
use App\Mcp\Tools\EditTransaction;
use App\Mcp\Tools\GetAccounts;
use App\Mcp\Tools\GetAllocations;
use App\Mcp\Tools\GetTransactions;
use App\Mcp\Tools\SplitBill;
use App\Models\Account;
use App\Models\Allocation;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

beforeEach(function (): void {
    $this->user = User::factory()->create();
    $this->account = Account::query()->create(['user_id' => $this->user->id, 'name' => 'Checking', 'type' => 'bank', 'balance' => '500.00']);
    $this->allocation = Allocation::query()->create(['user_id' => $this->user->id, 'name' => 'Food', 'type' => 'normal', 'balance' => '200.00']);
    $this->data = [
        'date' => '2026-10-26',
        'description' => 'Lunch',
        'note' => 'Original note',
        'accounts' => [['account_id' => $this->account->id, 'amount' => '-20.00']],
        'allocations' => [['allocation_id' => $this->allocation->id, 'amount' => '-20.00']],
    ];
});

it('creates, partially edits, replaces lines, and deletes normal transactions with correct balances', function (): void {
    PennyServer::actingAs($this->user)->tool(CreateTransaction::class, $this->data)->assertOk()->assertSee('Lunch');
    $transaction = Transaction::query()->sole();
    expect($this->account->fresh()->balance)->toBe('480.00');
    expect($this->allocation->fresh()->balance)->toBe('180.00');

    PennyServer::actingAs($this->user)->tool(EditTransaction::class, ['transaction_id' => $transaction->id, 'description' => 'Dinner'])->assertOk();
    expect($transaction->fresh()->description)->toBe('Dinner');
    expect($transaction->fresh()->note)->toBe('Original note');
    expect($this->account->fresh()->balance)->toBe('480.00');

    PennyServer::actingAs($this->user)->tool(EditTransaction::class, [
        'transaction_id' => $transaction->id,
        'note' => null,
        'accounts' => [['account_id' => $this->account->id, 'amount' => '-30.00']],
        'allocations' => [['allocation_id' => $this->allocation->id, 'amount' => '-30.00']],
    ])->assertOk();
    expect($this->account->fresh()->balance)->toBe('470.00');
    expect($this->allocation->fresh()->balance)->toBe('170.00');
    expect($transaction->fresh()->note)->toBeNull();

    PennyServer::actingAs($this->user)->tool(DeleteTransaction::class, ['transaction_id' => $transaction->id])->assertOk();
    expect($this->account->fresh()->balance)->toBe('500.00');
    expect($this->allocation->fresh()->balance)->toBe('200.00');
    expect(Transaction::query()->count())->toBe(0);
});

it('rejects invalid normal transactions without changing balances', function (array $changes): void {
    PennyServer::actingAs($this->user)->tool(CreateTransaction::class, array_replace($this->data, $changes))->assertHasErrors();
    expect(Transaction::query()->count())->toBe(0);
    expect($this->account->fresh()->balance)->toBe('500.00');
})->with([
    'missing date' => [['date' => null]],
    'empty lines' => [['accounts' => [], 'allocations' => []]],
    'unequal totals' => [['allocations' => []]],
    'invalid account' => [['accounts' => [['account_id' => 999999, 'amount' => '-20.00']]]],
    'invalid line shape' => [['accounts' => ['bad']]],
]);

it('rejects duplicate transaction lines', function (): void {
    $this->data['accounts'][] = $this->data['accounts'][0];
    PennyServer::actingAs($this->user)->tool(CreateTransaction::class, $this->data)->assertHasErrors();
    expect(Transaction::query()->count())->toBe(0);
});

it('returns only owned accounts and allocations with balances', function (): void {
    $other = User::factory()->create();
    Account::query()->create(['user_id' => $other->id, 'name' => 'Private account', 'type' => 'bank', 'balance' => '123.00']);
    Allocation::query()->create(['user_id' => $other->id, 'name' => 'Private allocation', 'type' => 'normal', 'balance' => '321.00']);
    PennyServer::actingAs($this->user)->tool(GetAccounts::class)->assertOk()->assertSee(['Checking', '500.00'])->assertDontSee('Private account');
    PennyServer::actingAs($this->user)->tool(GetAllocations::class)->assertOk()->assertSee(['Food', '200.00'])->assertDontSee('Private allocation');
});

it('filters transactions by exact date, inclusive range, multiple account and allocation IDs, and pagination', function (): void {
    $secondAccount = Account::query()->create(['user_id' => $this->user->id, 'name' => 'Cash', 'type' => 'cash', 'balance' => '100.00']);
    $secondAllocation = Allocation::query()->create(['user_id' => $this->user->id, 'name' => 'Travel', 'type' => 'normal', 'balance' => '100.00']);
    app(CreateTransactionAction::class)->handle($this->user, $this->data);
    app(CreateTransactionAction::class)->handle($this->user, array_replace($this->data, [
        'date' => '2026-10-25', 'description' => 'Taxi',
        'accounts' => [['account_id' => $secondAccount->id, 'amount' => '-20.00']],
        'allocations' => [['allocation_id' => $secondAllocation->id, 'amount' => '-20.00']],
    ]));
    app(CreateTransactionAction::class)->handle($this->user, array_replace($this->data, ['date' => '2026-10-24', 'description' => 'Outside range']));
    PennyServer::actingAs($this->user)->tool(GetTransactions::class, ['date' => '2026-10-26'])->assertOk()->assertSee('Lunch')->assertDontSee(['Taxi', 'Outside range']);
    $filters = ['date_from' => '2026-10-25', 'date_to' => '2026-10-26', 'account_ids' => [$this->account->id, $secondAccount->id], 'allocation_ids' => [$this->allocation->id, $secondAllocation->id]];
    PennyServer::actingAs($this->user)->tool(GetTransactions::class, $filters)->assertOk()->assertSee(['Lunch', 'Taxi'])->assertDontSee('Outside range');
    PennyServer::actingAs($this->user)->tool(GetTransactions::class, array_replace($filters, ['allocation_ids' => [$secondAllocation->id]]))->assertOk()->assertSee('Taxi')->assertDontSee('Lunch');
    PennyServer::actingAs($this->user)->tool(GetTransactions::class, array_replace($filters, ['per_page' => 1, 'page' => 2]))->assertOk()->assertSee('Taxi')->assertDontSee('Lunch');
});

it('rejects invalid transaction filters', function (array $filters): void {
    PennyServer::actingAs($this->user)->tool(GetTransactions::class, $filters)->assertHasErrors();
})->with([
    [['date_from' => '2026-10-26', 'date_to' => '2026-10-25']],
    [['date' => 'not a date']],
    [['per_page' => 101]],
    [['page' => 0]],
    [['account_ids' => []]],
]);

it('isolates all transaction operations and line references from other users', function (): void {
    $transaction = app(CreateTransactionAction::class)->handle($this->user, $this->data);
    $other = User::factory()->create();
    PennyServer::actingAs($other)->tool(GetTransactions::class)->assertOk()->assertDontSee('Lunch');
    PennyServer::actingAs($other)->tool(EditTransaction::class, ['transaction_id' => $transaction->id, 'description' => 'Stolen'])->assertHasErrors();
    PennyServer::actingAs($other)->tool(DeleteTransaction::class, ['transaction_id' => $transaction->id])->assertHasErrors();
    PennyServer::actingAs($other)->tool(CreateTransaction::class, $this->data)->assertHasErrors();
    PennyServer::actingAs($other)->tool(GetTransactions::class, ['account_ids' => [$this->account->id]])->assertHasErrors();
    PennyServer::actingAs($other)->tool(GetTransactions::class, ['allocation_ids' => [$this->allocation->id]])->assertHasErrors();
    expect($transaction->fresh()->description)->toBe('Lunch');
});

it('splits a receipt with weighted shares and service charge and reverses it on deletion', function (): void {
    PennyServer::actingAs($this->user)->tool(SplitBill::class, [
        'date' => '2026-10-26', 'description' => 'Shared dinner', 'payment_account_id' => $this->account->id,
        'total' => '33.00', 'service_charge' => '3.00',
        'items' => [['description' => 'Pizza', 'quantity' => 1, 'unit_price' => '30.00', 'assignees' => [
            ['type' => 'allocation', 'id' => $this->allocation->id, 'shares' => 2],
            ['type' => 'new_person', 'name' => 'Sam', 'shares' => 1],
        ]]],
    ])->assertOk()->assertSee(['Shared dinner', 'bill_split']);
    $transaction = Transaction::query()->sole();
    $person = $this->user->accounts()->where('name', 'Sam')->sole();
    expect($person->balance)->toBe('11.00');
    expect($this->account->fresh()->balance)->toBe('467.00');
    expect($this->allocation->fresh()->balance)->toBe('178.00');
    expect($transaction->billSplit->total)->toBe('33.00');
    PennyServer::actingAs($this->user)->tool(EditTransaction::class, ['transaction_id' => $transaction->id, 'description' => 'Changed'])->assertHasErrors();
    PennyServer::actingAs($this->user)->tool(DeleteTransaction::class, ['transaction_id' => $transaction->id])->assertOk();
    expect($this->account->fresh()->balance)->toBe('500.00');
    expect($person->fresh()->balance)->toBe('0.00');
    $this->assertDatabaseCount('bill_splits', 0);
});

it('rolls back invalid bill splits including foreign participants', function (string $failure): void {
    $other = User::factory()->create();
    $foreign = $other->allocations()->first();
    $data = [
        'date' => '2026-10-26', 'description' => 'Invalid bill', 'payment_account_id' => $this->account->id,
        'total' => $failure === 'total' ? '99.00' : '30.00',
        'items' => [['description' => 'Pizza', 'quantity' => 1, 'unit_price' => '30.00', 'assignees' => [
            ['type' => 'new_person', 'name' => 'Rollback person'],
            ['type' => 'allocation', 'id' => $failure === 'ownership' ? $foreign->id : $this->allocation->id],
        ]]],
    ];
    PennyServer::actingAs($this->user)->tool(SplitBill::class, $data)->assertHasErrors();
    expect(Transaction::query()->count())->toBe(0);
    expect(Account::query()->where('name', 'Rollback person')->exists())->toBeFalse();
    expect($this->account->fresh()->balance)->toBe('500.00');
})->with(['total', 'ownership']);

it('rejects tools when no user is authenticated', function (string $tool): void {
    Auth::forgetGuards();
    PennyServer::tool($tool)->assertHasErrors();
})->with([CreateTransaction::class, EditTransaction::class, DeleteTransaction::class, SplitBill::class, GetTransactions::class, GetAccounts::class, GetAllocations::class]);

it('protects the hosted endpoint with a valid unexpired bearer token and exposes all seven tools', function (): void {
    $payload = ['jsonrpc' => '2.0', 'id' => 1, 'method' => 'tools/list'];
    $this->postJson('/mcp/penny', $payload)->assertUnauthorized();
    $token = Str::random(64);
    $this->user->forceFill(['mcp_token_hash' => hash('sha256', $token), 'mcp_token_expires_at' => now()->addDay()])->save();
    Auth::forgetGuards();
    $response = $this->withToken($token)->postJson('/mcp/penny', $payload)->assertSuccessful();
    $names = collect($response->json('result.tools'))->pluck('name')->all();
    expect($names)->toEqualCanonicalizing(['create_transaction', 'split_bill', 'edit_transaction', 'delete_transaction', 'get_transactions', 'get_accounts', 'get_allocations']);
    expect($this->user->toArray())->not->toHaveKeys(['mcp_token_hash', 'mcp_token_expires_at']);
    $this->user->forceFill(['mcp_token_expires_at' => now()->subSecond()])->save();
    Auth::forgetGuards();
    $this->withToken($token)->postJson('/mcp/penny', $payload)->assertUnauthorized();
});

it('authenticates tool calls as the bearer token owner', function (): void {
    $token = Str::random(64);
    $this->user->forceFill(['mcp_token_hash' => hash('sha256', $token), 'mcp_token_expires_at' => now()->addDay()])->save();
    $this->withToken($token)->postJson('/mcp/penny', [
        'jsonrpc' => '2.0', 'id' => 1, 'method' => 'tools/call',
        'params' => ['name' => 'create_transaction', 'arguments' => $this->data],
    ])->assertSuccessful()->assertJsonPath('result.isError', false);
    expect(Transaction::query()->sole()->user_id)->toBe($this->user->id);
});

it('issues hashed tokens, rotates them, validates expiry, and revokes access', function (): void {
    Str::createRandomStringsUsing(fn () => str_repeat('a', 64));
    $this->artisan('penny:mcp-token', ['email' => $this->user->email])->expectsOutput(str_repeat('a', 64))->assertSuccessful();
    expect($this->user->fresh()->getRawOriginal('mcp_token_hash'))->toBe(hash('sha256', str_repeat('a', 64)));
    expect($this->user->fresh()->mcp_token_expires_at->equalTo(now()->addDays(90)->startOfSecond()))->toBeTrue();
    Str::createRandomStringsUsing(fn () => str_repeat('b', 64));
    $this->artisan('penny:mcp-token', ['email' => $this->user->email, '--days' => 7])->expectsOutput(str_repeat('b', 64))->assertSuccessful();
    expect($this->user->fresh()->getRawOriginal('mcp_token_hash'))->toBe(hash('sha256', str_repeat('b', 64)));
    $this->artisan('penny:mcp-token', ['email' => $this->user->email, '--days' => 0])->assertFailed();
    $this->artisan('penny:mcp-token', ['email' => 'missing@example.test'])->assertFailed();
    $this->artisan('penny:mcp-token', ['email' => $this->user->email, '--revoke' => true])->assertSuccessful();
    expect($this->user->fresh()->getRawOriginal('mcp_token_hash'))->toBeNull();
});

it('rejects unsafe decimal amounts for both normal transaction lines', function (string $amount): void {
    $this->data['accounts'][0]['amount'] = $amount;
    $this->data['allocations'][0]['amount'] = $amount;
    PennyServer::actingAs($this->user)->tool(CreateTransaction::class, $this->data)->assertHasErrors();
    expect(Transaction::query()->count())->toBe(0);
    expect($this->account->fresh()->balance)->toBe('500.00');
    expect($this->allocation->fresh()->balance)->toBe('200.00');
})->with(['-2e1', '-20.009', '-10000000000000.00']);

it('rejects unsafe receipt amounts before splitting a bill', function (string $amount): void {
    PennyServer::actingAs($this->user)->tool(SplitBill::class, [
        'date' => '2026-10-26', 'description' => 'Invalid receipt',
        'payment_account_id' => $this->account->id, 'total' => $amount,
        'items' => [['description' => 'Food', 'quantity' => 1, 'unit_price' => $amount, 'assignees' => [
            ['type' => 'allocation', 'id' => $this->allocation->id],
        ]]],
    ])->assertHasErrors();
    expect(Transaction::query()->count())->toBe(0);
    expect($this->account->fresh()->balance)->toBe('500.00');
})->with(['2e1', '20.009', '10000000000000.00']);
