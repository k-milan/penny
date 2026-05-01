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

it('redirects guests from incomes index', function (): void {
    $this->get(route('income-templates.index', absolute: false))
        ->assertRedirect(route('login', absolute: false));
});

it('shows income templates index for authenticated user', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();

    $this->actingAs($user)
        ->get(route('income-templates.index', absolute: false))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('incomes/index')
            ->has('incomeTemplateSeries'));
});

it('stores income template with account and allocation amounts', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $account = app(CreateAccount::class)->handle($user, [
        'name' => 'Payroll account',
        'type' => AccountType::Bank,
        'initial_balance' => '0.00',
    ]);
    $allocation = app(CreateAllocation::class)->handle($user, [
        'name' => 'Household',
        'type' => AllocationType::Normal,
    ]);

    $this->actingAs($user)
        ->fromRoute('income-templates.create')
        ->post(route('income-templates.store', absolute: false), [
            'name' => 'Salary',
            'description' => 'Day job',
            'company_name' => 'Acme Inc',
            'payout_frequency' => IncomePayoutFrequency::Monthly->value,
            'expected_income' => '50000.00',
            'accounts' => [
                ['account_id' => $account->id, 'amount' => '50000.00'],
            ],
            'allocations' => [
                ['allocation_id' => $allocation->id, 'amount' => '10000.00'],
            ],
        ])
        ->assertRedirectToRoute('income-templates.index')
        ->assertSessionHasNoErrors();

    $template = IncomeTemplate::query()->where('user_id', $user->id)->firstOrFail();
    $unallocatedAlloc = Allocation::query()
        ->where('user_id', $user->id)
        ->where('is_unallocated', true)
        ->firstOrFail();

    expect($template->name)->toBe('Salary');
    expect($template->company_name)->toBe('Acme Inc');
    expect($template->payout_frequency)->toBe(IncomePayoutFrequency::Monthly);
    expect(bccomp((string) $template->expected_income, '50000.00', 2))->toBe(0);
    expect($template->version)->toBe(1);
    expect($template->series_id)->not->toBeNull();

    expect($template->accounts)->toHaveCount(1);
    expect(
        bccomp((string) $template->accounts->first()->pivot->amount, '50000.00', 2),
    )->toBe(0);
    expect($template->allocations)->toHaveCount(2);
    $allocById = $template->allocations->keyBy(static fn ($a) => $a->id);
    expect(
        bccomp((string) $allocById->get($allocation->id)->pivot->amount, '10000.00', 2),
    )->toBe(0);
    expect(
        bccomp((string) $allocById->get($unallocatedAlloc->id)->pivot->amount, '40000.00', 2),
    )->toBe(0);
});

it('stores a new template version in the same series when series_id is sent', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $account = app(CreateAccount::class)->handle($user, [
        'name' => 'Payroll account',
        'type' => AccountType::Bank,
        'initial_balance' => '0.00',
    ]);
    $v1 = IncomeTemplate::factory()->for($user)->create([
        'name' => 'Salary',
        'payout_frequency' => IncomePayoutFrequency::Monthly,
        'expected_income' => '10000.00',
    ]);
    $v1->accounts()->attach($account->id, ['amount' => '10000.00']);
    $seriesId = $v1->series_id;
    expect($v1->version)->toBe(1);

    $this->actingAs($user)
        ->post(route('income-templates.store', absolute: false), [
            'name' => 'Salary raise',
            'description' => null,
            'company_name' => null,
            'payout_frequency' => IncomePayoutFrequency::Monthly->value,
            'expected_income' => '12000.00',
            'series_id' => $seriesId,
            'accounts' => [
                ['account_id' => $account->id, 'amount' => '12000.00'],
            ],
            'allocations' => [],
        ])
        ->assertRedirectToRoute('income-templates.index')
        ->assertSessionHasNoErrors();

    $v2 = IncomeTemplate::query()
        ->where('series_id', $seriesId)
        ->orderByDesc('version')
        ->with('allocations')
        ->firstOrFail();
    expect(
        IncomeTemplate::query()->where('series_id', $seriesId)->count(),
    )->toBe(2);
    expect($v2->version)->toBe(2);
    expect($v2->name)->toBe('Salary raise');
    $unallocatedAlloc = Allocation::query()
        ->where('user_id', $user->id)
        ->where('is_unallocated', true)
        ->firstOrFail();
    expect($v2->allocations)->toHaveCount(1);
    expect($v2->allocations->first()->id)->toBe($unallocatedAlloc->id);
    expect(
        bccomp((string) $v2->allocations->first()->pivot->amount, '12000.00', 2),
    )->toBe(0);
});

it('rejects account lines that belong to another user', function (): void {
    $owner = User::factory()->withoutTwoFactor()->create();
    $other = User::factory()->withoutTwoFactor()->create();
    $foreignAccount = app(CreateAccount::class)->handle($other, [
        'name' => 'Other',
        'type' => AccountType::Bank,
        'initial_balance' => '0.00',
    ]);

    $this->actingAs($owner)
        ->post(route('income-templates.store', absolute: false), [
            'name' => 'Bad',
            'company_name' => null,
            'description' => null,
            'payout_frequency' => IncomePayoutFrequency::Monthly->value,
            'expected_income' => '100.00',
            'accounts' => [
                ['account_id' => $foreignAccount->id, 'amount' => '100.00'],
            ],
            'allocations' => [],
        ])
        ->assertSessionHasErrors(['accounts.0.account_id']);
});

it('updates pivot lines', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $a1 = app(CreateAccount::class)->handle($user, [
        'name' => 'A1',
        'type' => AccountType::Bank,
        'initial_balance' => '0.00',
    ]);
    $a2 = app(CreateAccount::class)->handle($user, [
        'name' => 'A2',
        'type' => AccountType::Bank,
        'initial_balance' => '0.00',
    ]);
    $template = IncomeTemplate::factory()->for($user)->create([
        'payout_frequency' => IncomePayoutFrequency::Monthly,
        'expected_income' => '1000.00',
    ]);
    $template->accounts()->attach($a1->id, ['amount' => '1000.00']);

    $this->actingAs($user)
        ->put(
            route('income-templates.update', $template, absolute: false),
            [
                'name' => $template->name,
                'description' => null,
                'company_name' => null,
                'payout_frequency' => IncomePayoutFrequency::BiWeekly->value,
                'expected_income' => '2000.00',
                'accounts' => [
                    ['account_id' => $a2->id, 'amount' => '2000.00'],
                ],
                'allocations' => [],
            ],
        )
        ->assertRedirectToRoute('income-templates.index')
        ->assertSessionHasNoErrors();

    $template->refresh();
    $unallocatedAlloc = Allocation::query()
        ->where('user_id', $user->id)
        ->where('is_unallocated', true)
        ->firstOrFail();

    expect($template->payout_frequency)->toBe(IncomePayoutFrequency::BiWeekly)
        ->and((string) $template->expected_income)->toBe('2000.00');
    expect($template->accounts->pluck('id')->all())->toBe([$a2->id]);
    expect($template->allocations)->toHaveCount(1);
    expect($template->allocations->first()->id)->toBe($unallocatedAlloc->id);
    expect(
        bccomp((string) $template->allocations->first()->pivot->amount, '2000.00', 2),
    )->toBe(0);
});

it('deletes an income template', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $template = IncomeTemplate::factory()->for($user)->create();

    $this->actingAs($user)
        ->delete(
            route('income-templates.destroy', $template, absolute: false),
        )
        ->assertRedirectToRoute('income-templates.index');

    expect(IncomeTemplate::query()->find($template->id))->toBeNull();
});

it('returns 404 when editing another users template', function (): void {
    $owner = User::factory()->withoutTwoFactor()->create();
    $intruder = User::factory()->withoutTwoFactor()->create();
    $template = IncomeTemplate::factory()->for($owner)->create();

    $this->actingAs($intruder)
        ->get(
            route('income-templates.edit', $template, absolute: false),
        )
        ->assertNotFound();
});
