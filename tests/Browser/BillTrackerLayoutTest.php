<?php

declare(strict_types=1);

use App\Enums\AccountType;
use App\Enums\AllocationType;
use App\Models\Account;
use App\Models\Allocation;
use App\Models\User;

it('shows bills as rows beneath grouped month columns', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();

    foreach (['Water', 'Electricity', 'Car'] as $index => $name) {
        Allocation::query()->create([
            'user_id' => $user->id,
            'name' => $name,
            'type' => AllocationType::Bill,
            'due_date' => now()->startOfMonth()->addDays($index + 4)->toDateString(),
            'due_day' => $index + 5,
            'balance' => '0.00',
            'is_unallocated' => false,
        ]);
    }

    Account::query()->create([
        'user_id' => $user->id,
        'name' => 'Visa',
        'type' => AccountType::CreditCard,
        'balance' => '-250.00',
    ]);

    $this->actingAs($user);

    $page = visit(route('bills.index'));

    expect($page->script(<<<'JS'
        (() => {
            const table = document.querySelector('table');
            const headerRows = table?.querySelectorAll('thead tr') ?? [];
            const monthHeaders = headerRows[0]?.querySelectorAll('th[colspan="3"]') ?? [];
            const subheaders = Array.from(headerRows[1]?.querySelectorAll('th') ?? []).map((header) => header.textContent?.trim());
            const billNames = Array.from(table?.querySelectorAll('tbody tr > th:first-child') ?? []).map((header) => header.textContent?.trim());
            const columnCount = table?.querySelector('tbody tr')?.children.length ?? 0;

            return {
                corner: headerRows[0]?.querySelector('th[rowspan="2"]')?.textContent?.trim(),
                monthCount: monthHeaders.length,
                monthColspans: Array.from(monthHeaders).map((header) => header.getAttribute('colspan')),
                firstSubheaders: subheaders.slice(0, 3),
                billNames,
                columnCount,
            };
        })()
        JS))->toBe([
        'corner' => 'Bill',
        'monthCount' => 8,
        'monthColspans' => array_fill(0, 8, '3'),
        'firstSubheaders' => ['Due date', 'Due amount', 'Paid'],
        'billNames' => ['Car', 'Electricity', 'Visa', 'Water'],
        'columnCount' => 25,
    ]);
});
