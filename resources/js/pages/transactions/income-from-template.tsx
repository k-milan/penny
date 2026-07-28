import IncomeFromTemplateController from '@/actions/App/Http/Controllers/IncomeFromTemplateController';
import IncomeTemplateController from '@/actions/App/Http/Controllers/IncomeTemplateController';
import TransactionController from '@/actions/App/Http/Controllers/TransactionController';
import InputError from '@/components/input-error';
import { MoneyInput } from '@/components/money-input';
import {
    ProjectedBalance,
    SearchableCombobox,
} from '@/components/searchable-combobox';
import { TransactionDateSelector } from '@/components/transaction-date-selector';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { formatPhpMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import type { FormEvent, ReactElement } from 'react';
import { useMemo } from 'react';

const selectClass =
    'border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]';

type IncomeTemplateOption = {
    id: number;
    name: string;
    version: number;
    description: string | null;
    company_name: string | null;
    payout_frequency: string;
    payout_frequency_label: string;
    expected_income: string;
    accounts: { account_id: number; amount: string }[];
    allocations: {
        allocation_id: number;
        amount: string;
        is_unallocated: boolean;
    }[];
};

type AccountLine = { key: string; account_id: number | ''; amount: string };
type AllocationLine = {
    key: string;
    allocation_id: number | '';
    amount: string;
};

function newKey(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyAccountLine(): AccountLine {
    return { key: newKey(), account_id: '', amount: '' };
}

function emptyAllocationLine(): AllocationLine {
    return { key: newKey(), allocation_id: '', amount: '' };
}

function parseExpectedIncomePayout(raw: string): number | null {
    const t = raw.trim();
    if (t === '' || t === '-') {
        return null;
    }
    const n = Number.parseFloat(t);
    return Number.isFinite(n) ? n : null;
}

function sumAccountDeposits(rows: AccountLine[]): number {
    let sum = 0;
    for (const r of rows) {
        if (r.account_id === '') {
            continue;
        }
        const raw = r.amount.trim();
        if (raw === '' || raw === '-') {
            continue;
        }
        const n = Number.parseFloat(raw);
        if (Number.isFinite(n)) {
            sum += n;
        }
    }
    return sum;
}

function sumAllocationAmounts(rows: AllocationLine[]): number {
    let sum = 0;
    for (const r of rows) {
        if (r.allocation_id === '') {
            continue;
        }
        const raw = r.amount.trim();
        if (raw === '' || raw === '-') {
            continue;
        }
        const n = Number.parseFloat(raw);
        if (Number.isFinite(n)) {
            sum += n;
        }
    }
    return sum;
}

function sumUserAllocationAmounts(
    rows: AllocationLine[],
    unallocatedAllocationId: number | null | undefined,
): number {
    const uid = unallocatedAllocationId ?? null;
    const filtered =
        uid === null
            ? rows
            : rows.filter(
                  (r) =>
                      r.allocation_id === '' || Number(r.allocation_id) !== uid,
              );
    return sumAllocationAmounts(filtered);
}

function composeNoteFromTemplate(
    t: IncomeTemplateOption,
    expectedIncomeStr: string,
): string {
    const blocks: string[] = [];
    const company = t.company_name?.trim();
    if (company) {
        blocks.push(
            `This payout is from ${company}. Pay cycle: ${t.payout_frequency_label.toLowerCase()}.`,
        );
    } else {
        blocks.push(`Pay cycle: ${t.payout_frequency_label.toLowerCase()}.`);
    }
    const payoutTarget = parseExpectedIncomePayout(expectedIncomeStr);
    if (payoutTarget !== null) {
        blocks.push(
            `Expected gross for this payout: ${formatPhpMoney(payoutTarget)}.`,
        );
    }
    const desc = t.description?.trim();
    if (desc) {
        blocks.push(desc);
    }
    return blocks.join('\n\n');
}

type FormState = {
    date: string;
    template_id: number | '';
    name: string;
    note: string;
    expected_income: string;
    accounts: AccountLine[];
    allocations: AllocationLine[];
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: dashboard().url },
    {
        title: 'Record income',
        href: IncomeFromTemplateController.create().url,
    },
];

function sumNumericAmounts(amounts: string[]): number {
    let sum = 0;
    for (const s of amounts) {
        const n = Number.parseFloat(s);
        if (Number.isFinite(n)) {
            sum += n;
        }
    }
    return sum;
}

function amountOrNull(raw: string): number | null {
    const value = Number.parseFloat(raw);
    return Number.isFinite(value) ? value : null;
}

export default function IncomeFromTemplatePage({
    incomeTemplates,
    accounts,
    allocations,
    unallocated_allocation_id: unallocatedAllocationId,
}: {
    incomeTemplates: IncomeTemplateOption[];
    accounts: {
        id: number;
        name: string;
        type: string;
        balance: string;
        is_pinned: boolean;
    }[];
    allocations: {
        id: number;
        name: string;
        type: string;
        balance: string;
        is_pinned: boolean;
    }[];
    unallocated_allocation_id: number | null;
}): ReactElement {
    const form = useForm<FormState>({
        date: new Date().toISOString().slice(0, 10),
        template_id: '',
        name: '',
        note: '',
        expected_income: '',
        accounts: [emptyAccountLine()],
        allocations: [emptyAllocationLine()],
    });

    const expectedPayout = useMemo(
        () => parseExpectedIncomePayout(form.data.expected_income),
        [form.data.expected_income],
    );
    const accountDepositTotal = useMemo(
        () => sumAccountDeposits(form.data.accounts),
        [form.data.accounts],
    );
    const allocationSplitTotal = useMemo(
        () =>
            sumUserAllocationAmounts(
                form.data.allocations,
                unallocatedAllocationId,
            ),
        [form.data.allocations, unallocatedAllocationId],
    );

    const allocationGapVsAccounts = accountDepositTotal - allocationSplitTotal;

    const handleSubmit = (e: FormEvent): void => {
        e.preventDefault();
        form.clearErrors();
        if (form.data.name.trim() === '') {
            return;
        }

        const uid =
            unallocatedAllocationId !== null && unallocatedAllocationId > 0
                ? unallocatedAllocationId
                : null;

        const accountPayload = form.data.accounts
            .filter(
                (r) => r.account_id !== '' && String(r.amount).trim() !== '',
            )
            .map((r) => ({
                account_id: Number(r.account_id),
                amount: r.amount,
            }));

        if (accountPayload.length === 0) {
            return;
        }

        const userAllocationRows = form.data.allocations
            .filter(
                (r) =>
                    r.allocation_id !== '' &&
                    String(r.amount).trim() !== '' &&
                    (uid === null || Number(r.allocation_id) !== uid),
            )
            .map((r) => ({
                allocation_id: Number(r.allocation_id),
                amount: r.amount,
            }));

        const accountTotal = sumNumericAmounts(
            accountPayload.map((r) => r.amount),
        );
        const userAllocTotal = sumNumericAmounts(
            userAllocationRows.map((r) => r.amount),
        );
        const remainder =
            Math.round((accountTotal - userAllocTotal) * 100) / 100;

        if (remainder < -0.01) {
            return;
        }

        let allocationPayload = userAllocationRows;
        if (remainder > 0) {
            if (uid === null) {
                return;
            }
            allocationPayload = [
                ...userAllocationRows,
                { allocation_id: uid, amount: remainder.toFixed(2) },
            ];
        }

        const allocTotal = sumNumericAmounts(
            allocationPayload.map((r) => r.amount),
        );
        if (Math.abs(accountTotal - allocTotal) > 0.01) {
            return;
        }

        form.transform(() => ({
            date: form.data.date,
            description: form.data.name.trim(),
            note: form.data.note.trim() === '' ? null : form.data.note,
            accounts: accountPayload,
            allocations: allocationPayload,
        }));
        form.post(TransactionController.store.url());
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Record income" />
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <Button
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        asChild
                    >
                        <Link
                            href={dashboard().url}
                            aria-label="Back to dashboard"
                        >
                            <ArrowLeft className="size-4" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-semibold">
                            Record income
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Start from an income template, then adjust amounts.
                            Saving creates a normal transaction.
                        </p>
                    </div>
                </div>

                {incomeTemplates.length === 0 ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>No income templates yet</CardTitle>
                            <CardDescription>
                                Create a template first to use this shortcut, or
                                add a transaction from the dashboard.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button asChild>
                                <Link
                                    href={IncomeTemplateController.create().url}
                                >
                                    New income template
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                ) : null}

                <Card>
                    <CardHeader>
                        <CardTitle>Income transaction</CardTitle>
                        <CardDescription>
                            Template values are a starting point only—edit
                            anything before you save.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form className="space-y-8" onSubmit={handleSubmit}>
                            <div className="grid gap-2">
                                <Label htmlFor="template_id">Template</Label>
                                <SearchableCombobox
                                    ariaLabel="Income template"
                                    value={form.data.template_id || null}
                                    placeholder="Optional template…"
                                    options={incomeTemplates.map((t) => ({
                                        id: t.id,
                                        name: `${t.name}${t.version > 1 ? ` (v${t.version})` : ''}`,
                                    }))}
                                    onChange={(value) => {
                                        if (value === null) {
                                            form.setData({
                                                ...form.data,
                                                template_id: '',
                                                name: '',
                                                note: '',
                                                expected_income: '',
                                                accounts: [emptyAccountLine()],
                                                allocations: [
                                                    emptyAllocationLine(),
                                                ],
                                            });
                                            return;
                                        }
                                        const id = Number(value);
                                        const t = incomeTemplates.find(
                                            (x) => x.id === id,
                                        );
                                        if (t === undefined) {
                                            return;
                                        }
                                        const note = composeNoteFromTemplate(
                                            t,
                                            t.expected_income,
                                        );
                                        const allocLines = t.allocations
                                            .filter((a) => !a.is_unallocated)
                                            .map((a) => ({
                                                key: newKey(),
                                                allocation_id: a.allocation_id,
                                                amount: a.amount,
                                            }));
                                        form.setData({
                                            ...form.data,
                                            template_id: t.id,
                                            name: t.name.slice(0, 255),
                                            note,
                                            expected_income: t.expected_income,
                                            accounts:
                                                t.accounts.length > 0
                                                    ? t.accounts.map((a) => ({
                                                          key: newKey(),
                                                          account_id:
                                                              a.account_id,
                                                          amount: a.amount,
                                                      }))
                                                    : [emptyAccountLine()],
                                            allocations:
                                                allocLines.length > 0
                                                    ? allocLines
                                                    : [emptyAllocationLine()],
                                        });
                                    }}
                                />
                            </div>

                            <div className="grid gap-2">
                                <TransactionDateSelector
                                    id="date"
                                    value={form.data.date}
                                    onChange={(value) =>
                                        form.setData('date', value)
                                    }
                                />
                                <InputError message={form.errors.date} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    value={form.data.name}
                                    onChange={(e) =>
                                        form.setData('name', e.target.value)
                                    }
                                    required
                                    maxLength={255}
                                    placeholder="Short title for this transaction"
                                />
                                <InputError
                                    message={
                                        (
                                            form.errors as {
                                                description?: string;
                                            }
                                        ).description
                                    }
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="expected_income">
                                    Expected income (guide)
                                </Label>
                                <MoneyInput
                                    id="expected_income"
                                    name="expected_income"
                                    value={form.data.expected_income}
                                    onChange={(v) =>
                                        form.setData('expected_income', v)
                                    }
                                />
                                <p className="text-xs text-muted-foreground">
                                    Used for deposit / split hints only; account
                                    and allocation totals decide what you post.
                                </p>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="note">Details (note)</Label>
                                <textarea
                                    id="note"
                                    name="note"
                                    className={cn(
                                        selectClass,
                                        'min-h-[120px] resize-y py-2',
                                    )}
                                    value={form.data.note}
                                    onChange={(e) =>
                                        form.setData('note', e.target.value)
                                    }
                                    rows={5}
                                />
                                <InputError message={form.errors.note} />
                            </div>

                            <div className="grid gap-6 border-t border-border pt-6 md:grid-cols-2 md:gap-8">
                                <div className="space-y-3">
                                    <div>
                                        <h3 className="text-sm font-medium">
                                            Deposit accounts
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            Amounts increase these account
                                            balances (money in).
                                        </p>
                                        {expectedPayout !== null ? (
                                            <p
                                                className={cn(
                                                    'mt-2 text-xs tabular-nums',
                                                    accountDepositTotal -
                                                        expectedPayout >
                                                        0.004
                                                        ? 'font-medium text-destructive'
                                                        : 'text-muted-foreground',
                                                )}
                                            >
                                                {accountDepositTotal -
                                                    expectedPayout >
                                                0.004
                                                    ? `${formatPhpMoney(accountDepositTotal - expectedPayout)} over expected`
                                                    : `${formatPhpMoney(
                                                          Math.max(
                                                              0,
                                                              expectedPayout -
                                                                  accountDepositTotal,
                                                          ),
                                                      )} remaining vs expected`}
                                            </p>
                                        ) : null}
                                    </div>
                                    <ul className="space-y-3">
                                        {form.data.accounts.map((row, i) => (
                                            <li
                                                key={row.key}
                                                className="flex flex-col items-start gap-2 rounded-md border border-border p-3 sm:flex-row sm:flex-wrap"
                                            >
                                                <div className="min-w-0 flex-1 space-y-1">
                                                    <Label
                                                        className="text-xs"
                                                        htmlFor={`acct-${row.key}`}
                                                    >
                                                        Account
                                                    </Label>
                                                    <SearchableCombobox
                                                        ariaLabel="Deposit account"
                                                        value={
                                                            row.account_id ===
                                                            ''
                                                                ? null
                                                                : row.account_id
                                                        }
                                                        options={accounts}
                                                        onChange={(value) => {
                                                            const next = [
                                                                ...form.data
                                                                    .accounts,
                                                            ];
                                                            next[i] = {
                                                                ...row,
                                                                account_id:
                                                                    value ===
                                                                    null
                                                                        ? ''
                                                                        : Number(
                                                                              value,
                                                                          ),
                                                            };
                                                            form.setData(
                                                                'accounts',
                                                                next,
                                                            );
                                                        }}
                                                    />
                                                    <ProjectedBalance
                                                        balance={
                                                            accounts.find(
                                                                (a) =>
                                                                    a.id ===
                                                                    row.account_id,
                                                            )?.balance
                                                        }
                                                        delta={
                                                            row.amount.trim() ===
                                                            ''
                                                                ? null
                                                                : amountOrNull(
                                                                      row.amount,
                                                                  )
                                                        }
                                                    />
                                                </div>
                                                <div className="w-full min-w-[8rem] sm:w-40">
                                                    <Label
                                                        className="text-xs"
                                                        htmlFor={`acct-amt-${row.key}`}
                                                    >
                                                        Amount
                                                    </Label>
                                                    <MoneyInput
                                                        id={`acct-amt-${row.key}`}
                                                        value={row.amount}
                                                        onChange={(v) => {
                                                            const next = [
                                                                ...form.data
                                                                    .accounts,
                                                            ];
                                                            next[i] = {
                                                                ...row,
                                                                amount: v,
                                                            };
                                                            form.setData(
                                                                'accounts',
                                                                next,
                                                            );
                                                        }}
                                                    />
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="shrink-0 text-muted-foreground sm:mt-6"
                                                    onClick={() => {
                                                        const next =
                                                            form.data.accounts.filter(
                                                                (_, j) =>
                                                                    j !== i,
                                                            );
                                                        form.setData(
                                                            'accounts',
                                                            next.length
                                                                ? next
                                                                : [
                                                                      emptyAccountLine(),
                                                                  ],
                                                        );
                                                    }}
                                                    aria-label="Remove account line"
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() =>
                                            form.setData('accounts', [
                                                ...form.data.accounts,
                                                emptyAccountLine(),
                                            ])
                                        }
                                    >
                                        <Plus className="size-4" />
                                        Add account
                                    </Button>
                                    <InputError
                                        message={form.errors.accounts}
                                    />
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <h3 className="text-sm font-medium">
                                            Allocations
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            Must match deposit totals. Extra
                                            goes to Unallocated on save.
                                        </p>
                                        {accountDepositTotal > 0 ||
                                        allocationSplitTotal > 0 ? (
                                            <p
                                                className={cn(
                                                    'mt-2 text-xs tabular-nums',
                                                    allocationGapVsAccounts <
                                                        -0.02
                                                        ? 'font-medium text-destructive'
                                                        : 'text-muted-foreground',
                                                )}
                                            >
                                                {allocationGapVsAccounts < -0.02
                                                    ? `${formatPhpMoney(Math.abs(allocationGapVsAccounts))} over deposit total`
                                                    : allocationGapVsAccounts >
                                                        0.004
                                                      ? unallocatedAllocationId !==
                                                        null
                                                          ? `${formatPhpMoney(allocationGapVsAccounts)} to Unallocated`
                                                          : `${formatPhpMoney(allocationGapVsAccounts)} remaining (set up Unallocated)`
                                                      : 'Balanced with deposits'}
                                            </p>
                                        ) : null}
                                    </div>
                                    <ul className="space-y-3">
                                        {form.data.allocations.map((row, i) => (
                                            <li
                                                key={row.key}
                                                className="flex flex-col items-start gap-2 rounded-md border border-border p-3 sm:flex-row sm:flex-wrap"
                                            >
                                                <div className="min-w-0 flex-1 space-y-1">
                                                    <Label
                                                        className="text-xs"
                                                        htmlFor={`alloc-${row.key}`}
                                                    >
                                                        Allocation
                                                    </Label>
                                                    <SearchableCombobox
                                                        ariaLabel="Income allocation"
                                                        value={
                                                            row.allocation_id ===
                                                            ''
                                                                ? null
                                                                : row.allocation_id
                                                        }
                                                        options={allocations}
                                                        onChange={(value) => {
                                                            const next = [
                                                                ...form.data
                                                                    .allocations,
                                                            ];
                                                            next[i] = {
                                                                ...row,
                                                                allocation_id:
                                                                    value ===
                                                                    null
                                                                        ? ''
                                                                        : Number(
                                                                              value,
                                                                          ),
                                                            };
                                                            form.setData(
                                                                'allocations',
                                                                next,
                                                            );
                                                        }}
                                                    />
                                                    <ProjectedBalance
                                                        balance={
                                                            allocations.find(
                                                                (a) =>
                                                                    a.id ===
                                                                    row.allocation_id,
                                                            )?.balance
                                                        }
                                                        delta={
                                                            row.amount.trim() ===
                                                            ''
                                                                ? null
                                                                : amountOrNull(
                                                                      row.amount,
                                                                  )
                                                        }
                                                    />
                                                </div>
                                                <div className="w-full min-w-[8rem] sm:w-40">
                                                    <Label
                                                        className="text-xs"
                                                        htmlFor={`alloc-amt-${row.key}`}
                                                    >
                                                        Amount
                                                    </Label>
                                                    <MoneyInput
                                                        id={`alloc-amt-${row.key}`}
                                                        value={row.amount}
                                                        onChange={(v) => {
                                                            const next = [
                                                                ...form.data
                                                                    .allocations,
                                                            ];
                                                            next[i] = {
                                                                ...row,
                                                                amount: v,
                                                            };
                                                            form.setData(
                                                                'allocations',
                                                                next,
                                                            );
                                                        }}
                                                    />
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="shrink-0 text-muted-foreground sm:mt-6"
                                                    onClick={() => {
                                                        const next =
                                                            form.data.allocations.filter(
                                                                (_, j) =>
                                                                    j !== i,
                                                            );
                                                        form.setData(
                                                            'allocations',
                                                            next.length
                                                                ? next
                                                                : [
                                                                      emptyAllocationLine(),
                                                                  ],
                                                        );
                                                    }}
                                                    aria-label="Remove allocation line"
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() =>
                                            form.setData('allocations', [
                                                ...form.data.allocations,
                                                emptyAllocationLine(),
                                            ])
                                        }
                                    >
                                        <Plus className="size-4" />
                                        Add allocation
                                    </Button>
                                    <InputError
                                        message={form.errors.allocations}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                                <Button
                                    type="submit"
                                    disabled={form.processing}
                                >
                                    Save transaction
                                </Button>
                                <Button variant="outline" type="button" asChild>
                                    <Link href={dashboard().url}>Cancel</Link>
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
