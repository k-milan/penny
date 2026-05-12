import IncomeTemplateController from '@/actions/App/Http/Controllers/IncomeTemplateController';
import InputError from '@/components/input-error';
import { MoneyInput } from '@/components/money-input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatPhpMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, Info, Plus, Trash2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { useMemo } from 'react';

const selectClass =
    'border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]';

export type IncomeAccountOption = { id: number; name: string };
export type IncomeAllocationOption = { id: number; name: string };
export type PayoutFrequencyOption = { value: string; label: string };

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

/** Parsed payout target, or null when the field is empty / not yet a number. */
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

function SectionInfoTooltip({ children }: { children: React.ReactNode }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    aria-label="Show details"
                >
                    <Info className="size-4" aria-hidden />
                </button>
            </TooltipTrigger>
            <TooltipContent side="top" align="start" className="max-w-xs">
                <p>{children}</p>
            </TooltipContent>
        </Tooltip>
    );
}

type FormState = {
    name: string;
    description: string;
    company_name: string;
    payout_frequency: string;
    expected_income: string;
    accounts: AccountLine[];
    allocations: AllocationLine[];
};

type IncomeTemplateFormProps = {
    mode: 'create' | 'edit';
    incomeTemplateId?: number;
    initial?: {
        name: string;
        description: string;
        company_name: string;
        payout_frequency: string;
        expected_income: string;
        accounts: { account_id: number; amount: string }[];
        allocations: { allocation_id: number; amount: string }[];
    };
    seriesIdForNewVersion?: number;
    accounts: IncomeAccountOption[];
    allocations: IncomeAllocationOption[];
    payoutFrequencies: PayoutFrequencyOption[];
    unallocatedAllocationId?: number | null;
    heading: string;
    headTitle: string;
};

export function IncomeTemplateFormFields({
    mode,
    incomeTemplateId,
    initial,
    seriesIdForNewVersion,
    accounts,
    allocations,
    payoutFrequencies,
    unallocatedAllocationId,
    heading,
    headTitle,
}: IncomeTemplateFormProps): ReactElement {
    const defaultFrequency =
        initial?.payout_frequency ?? payoutFrequencies[0]?.value ?? 'monthly';

    const form = useForm<FormState>({
        name: initial?.name ?? '',
        description: initial?.description ?? '',
        company_name: initial?.company_name ?? '',
        payout_frequency: defaultFrequency,
        expected_income: initial?.expected_income ?? '',
        accounts:
            initial?.accounts?.length && initial.accounts.length > 0
                ? initial.accounts.map((a) => ({
                      key: newKey(),
                      account_id: a.account_id,
                      amount: a.amount,
                  }))
                : [emptyAccountLine()],
        allocations:
            initial?.allocations?.length && initial.allocations.length > 0
                ? initial.allocations.map((a) => ({
                      key: newKey(),
                      allocation_id: a.allocation_id,
                      amount: a.amount,
                  }))
                : [emptyAllocationLine()],
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

    const applyTransform = () => {
        form.transform((data) => {
            const uid =
                unallocatedAllocationId !== undefined &&
                unallocatedAllocationId !== null &&
                unallocatedAllocationId > 0
                    ? unallocatedAllocationId
                    : null;

            const userAllocationRows = data.allocations
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

            const expectedForAlloc = parseExpectedIncomePayout(
                data.expected_income,
            );
            let allocationPayload = userAllocationRows;
            if (uid !== null && expectedForAlloc !== null) {
                const userSum = sumUserAllocationAmounts(data.allocations, uid);
                const remainder = expectedForAlloc - userSum;
                if (remainder > 0.004) {
                    allocationPayload = [
                        ...userAllocationRows,
                        {
                            allocation_id: uid,
                            amount: remainder.toFixed(2),
                        },
                    ];
                }
            }

            const payload = {
                name: data.name,
                description: data.description === '' ? null : data.description,
                company_name:
                    data.company_name === '' ? null : data.company_name,
                payout_frequency: data.payout_frequency,
                expected_income: data.expected_income,
                accounts: data.accounts
                    .filter(
                        (r) =>
                            r.account_id !== '' &&
                            String(r.amount).trim() !== '',
                    )
                    .map((r) => ({
                        account_id: Number(r.account_id),
                        amount: r.amount,
                    })),
                allocations: allocationPayload,
            };
            if (
                mode === 'create' &&
                seriesIdForNewVersion !== undefined &&
                seriesIdForNewVersion !== null
            ) {
                return {
                    ...payload,
                    series_id: seriesIdForNewVersion,
                };
            }
            return payload;
        });
    };

    return (
        <>
            <Head title={headTitle} />
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <Button
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        asChild
                    >
                        <Link
                            href={IncomeTemplateController.index().url}
                            aria-label="Back to income templates"
                        >
                            <ArrowLeft className="size-4" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-semibold">{heading}</h1>
                        <p className="text-sm text-muted-foreground">
                            Plan expected payouts, deposit accounts, and how
                            much goes to each allocation.
                        </p>
                    </div>
                </div>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle>Template</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form
                            className="space-y-5"
                            onSubmit={(e) => {
                                e.preventDefault();
                                applyTransform();
                                if (mode === 'create') {
                                    form.post(
                                        IncomeTemplateController.store.url(),
                                    );
                                } else if (
                                    incomeTemplateId !== undefined &&
                                    incomeTemplateId !== null
                                ) {
                                    form.put(
                                        IncomeTemplateController.update.url({
                                            income_template: incomeTemplateId,
                                        }),
                                    );
                                }
                            }}
                        >
                            <div className="grid gap-4 md:grid-cols-2">
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
                                        autoFocus
                                    />
                                    <InputError message={form.errors.name} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="company_name">
                                        Company name (optional)
                                    </Label>
                                    <Input
                                        id="company_name"
                                        name="company_name"
                                        value={form.data.company_name}
                                        onChange={(e) =>
                                            form.setData(
                                                'company_name',
                                                e.target.value,
                                            )
                                        }
                                    />
                                    <InputError
                                        message={form.errors.company_name}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="payout_frequency">
                                        Payout frequency
                                    </Label>
                                    <select
                                        id="payout_frequency"
                                        name="payout_frequency"
                                        className={selectClass}
                                        value={form.data.payout_frequency}
                                        onChange={(e) =>
                                            form.setData(
                                                'payout_frequency',
                                                e.target.value,
                                            )
                                        }
                                    >
                                        {payoutFrequencies.map((p) => (
                                            <option
                                                key={p.value}
                                                value={p.value}
                                            >
                                                {p.label}
                                            </option>
                                        ))}
                                    </select>
                                    <InputError
                                        message={form.errors.payout_frequency}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="expected_income">
                                        Expected income (per payout)
                                    </Label>
                                    <MoneyInput
                                        id="expected_income"
                                        name="expected_income"
                                        value={form.data.expected_income}
                                        onChange={(v) =>
                                            form.setData('expected_income', v)
                                        }
                                    />
                                    <InputError
                                        message={form.errors.expected_income}
                                    />
                                </div>
                                <div className="grid gap-2 md:col-span-2">
                                    <Label htmlFor="description">
                                        Description (optional)
                                    </Label>
                                    <textarea
                                        id="description"
                                        name="description"
                                        className={cn(
                                            selectClass,
                                            'min-h-[4.5rem] resize-y py-2',
                                        )}
                                        value={form.data.description}
                                        onChange={(e) =>
                                            form.setData(
                                                'description',
                                                e.target.value,
                                            )
                                        }
                                        rows={2}
                                    />
                                    <InputError
                                        message={form.errors.description}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-6 border-t border-border pt-5 md:grid-cols-2 md:gap-8">
                                <div className="space-y-3">
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <h3 className="text-sm font-medium">
                                                Deposit accounts
                                            </h3>
                                            <SectionInfoTooltip>
                                                Where this income usually lands.
                                                Amounts are per payout per
                                                account.
                                            </SectionInfoTooltip>
                                        </div>
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
                                                    ? `${formatPhpMoney(accountDepositTotal - expectedPayout)} over`
                                                    : `${formatPhpMoney(
                                                          Math.max(
                                                              0,
                                                              expectedPayout -
                                                                  accountDepositTotal,
                                                          ),
                                                      )} remaining`}
                                            </p>
                                        ) : null}
                                    </div>
                                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(7rem,10rem)_2.25rem] gap-2 px-1 text-xs font-medium text-muted-foreground">
                                        <span>Account</span>
                                        <span>Amount</span>
                                        <span className="sr-only">Remove</span>
                                    </div>
                                    <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
                                        {form.data.accounts.map((row, i) => (
                                            <li
                                                key={row.key}
                                                className="grid grid-cols-[minmax(0,1fr)_minmax(7rem,10rem)_2.25rem] items-start gap-2 p-2"
                                            >
                                                <select
                                                    id={`acct-${row.key}`}
                                                    className={selectClass}
                                                    value={
                                                        row.account_id === ''
                                                            ? ''
                                                            : String(
                                                                  row.account_id,
                                                              )
                                                    }
                                                    onChange={(e) => {
                                                        const v =
                                                            e.target.value;
                                                        const next = [
                                                            ...form.data
                                                                .accounts,
                                                        ];
                                                        next[i] = {
                                                            ...row,
                                                            account_id:
                                                                v === ''
                                                                    ? ''
                                                                    : Number(v),
                                                        };
                                                        form.setData(
                                                            'accounts',
                                                            next,
                                                        );
                                                    }}
                                                    aria-label="Account"
                                                >
                                                    <option value="">
                                                        Select account
                                                    </option>
                                                    {accounts.map((a) => (
                                                        <option
                                                            key={a.id}
                                                            value={a.id}
                                                        >
                                                            {a.name}
                                                        </option>
                                                    ))}
                                                </select>
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
                                                    aria-label="Amount"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="shrink-0 self-center text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-300 dark:hover:bg-rose-400/10 dark:hover:text-rose-200"
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
                                        <div className="flex items-center gap-1.5">
                                            <h3 className="text-sm font-medium">
                                                Allocation split (optional)
                                            </h3>
                                            <SectionInfoTooltip>
                                                Planned amounts per payout.
                                                Unallocated is not listed here;
                                                any gap vs expected income is
                                                added to Unallocated when you
                                                save.
                                            </SectionInfoTooltip>
                                        </div>
                                        {expectedPayout !== null ? (
                                            <p
                                                className={cn(
                                                    'mt-2 text-xs tabular-nums',
                                                    allocationSplitTotal -
                                                        expectedPayout >
                                                        0.004
                                                        ? 'font-medium text-destructive'
                                                        : 'text-muted-foreground',
                                                )}
                                            >
                                                {allocationSplitTotal -
                                                    expectedPayout >
                                                0.004
                                                    ? `${formatPhpMoney(allocationSplitTotal - expectedPayout)} over`
                                                    : unallocatedAllocationId !==
                                                            undefined &&
                                                        unallocatedAllocationId !==
                                                            null &&
                                                        unallocatedAllocationId >
                                                            0
                                                      ? `${formatPhpMoney(
                                                            Math.max(
                                                                0,
                                                                expectedPayout -
                                                                    allocationSplitTotal,
                                                            ),
                                                        )} to Unallocated`
                                                      : `${formatPhpMoney(
                                                            Math.max(
                                                                0,
                                                                expectedPayout -
                                                                    allocationSplitTotal,
                                                            ),
                                                        )} remaining`}
                                            </p>
                                        ) : null}
                                    </div>
                                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(7rem,10rem)_2.25rem] gap-2 px-1 text-xs font-medium text-muted-foreground">
                                        <span>Allocation</span>
                                        <span>Amount</span>
                                        <span className="sr-only">Remove</span>
                                    </div>
                                    <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
                                        {form.data.allocations.map((row, i) => (
                                            <li
                                                key={row.key}
                                                className="grid grid-cols-[minmax(0,1fr)_minmax(7rem,10rem)_2.25rem] items-start gap-2 p-2"
                                            >
                                                <select
                                                    id={`alloc-${row.key}`}
                                                    className={selectClass}
                                                    value={
                                                        row.allocation_id === ''
                                                            ? ''
                                                            : String(
                                                                  row.allocation_id,
                                                              )
                                                    }
                                                    onChange={(e) => {
                                                        const v =
                                                            e.target.value;
                                                        const next = [
                                                            ...form.data
                                                                .allocations,
                                                        ];
                                                        next[i] = {
                                                            ...row,
                                                            allocation_id:
                                                                v === ''
                                                                    ? ''
                                                                    : Number(v),
                                                        };
                                                        form.setData(
                                                            'allocations',
                                                            next,
                                                        );
                                                    }}
                                                    aria-label="Allocation"
                                                >
                                                    <option value="">
                                                        Select allocation
                                                    </option>
                                                    {allocations.map((a) => (
                                                        <option
                                                            key={a.id}
                                                            value={a.id}
                                                        >
                                                            {a.name}
                                                        </option>
                                                    ))}
                                                </select>
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
                                                    aria-label="Amount"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="shrink-0 self-center text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-300 dark:hover:bg-rose-400/10 dark:hover:text-rose-200"
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
                                    {mode === 'create'
                                        ? 'Create'
                                        : 'Save changes'}
                                </Button>
                                <Button variant="outline" type="button" asChild>
                                    <Link
                                        href={
                                            IncomeTemplateController.index().url
                                        }
                                    >
                                        Cancel
                                    </Link>
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
