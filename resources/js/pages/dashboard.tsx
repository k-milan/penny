import IncomeFromTemplateController from '@/actions/App/Http/Controllers/IncomeFromTemplateController';
import TransactionController from '@/actions/App/Http/Controllers/TransactionController';
import {
    type AccountOption,
    type AllocationOption,
    type CreateDialogPreset,
    TransactionFormDialog,
} from '@/components/transaction-form-dialog';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RadialBubbleMenu } from '@/components/radial-bubble-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import AccountController from '@/actions/App/Http/Controllers/AccountController';
import AllocationController from '@/actions/App/Http/Controllers/AllocationController';
import { type BreadcrumbItem } from '@/types';
import { InfiniteScroll, Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowLeftRight,
    Building2,
    CreditCard,
    Landmark,
    MoreVertical,
    Pencil,
    PiggyBank,
    Receipt,
    Trash2,
    Wallet,
} from 'lucide-react';
import { formatPhpMoney, formatTypeLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
    ensureTransactionRow,
    type DashboardTransactionRow,
} from '@/lib/transaction-row';
import { useMemo, useState } from 'react';

type TransactionRow = DashboardTransactionRow;

type PaginatedTransactions = {
    data: TransactionRow[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    next_page_url: string | null;
    prev_page_url: string | null;
};

type DashboardProps = {
    accounts: AccountOption[];
    allocations: AllocationOption[];
    unallocated: string;
    unallocated_allocation_id: number | null;
    recentTransactions: PaginatedTransactions;
};

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: dashboard().url,
    },
];

function formatTransactionGroupDate(dateYmd: string): string {
    const parts = dateYmd.split('-').map((p) => Number.parseInt(p, 10));
    const y = parts[0];
    const m = parts[1];
    const d = parts[2];
    if (
        !Number.isFinite(y) ||
        !Number.isFinite(m) ||
        !Number.isFinite(d) ||
        m === undefined ||
        d === undefined
    ) {
        return dateYmd;
    }
    const dt = new Date(y, m - 1, d);
    const month = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(
        dt,
    );
    const weekday = new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
    }).format(dt);
    return `${month} ${d}, ${y} (${weekday})`;
}

function formatTransactionTime(iso: string | undefined): string | null {
    if (iso == null || iso === '') {
        return null;
    }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
        return null;
    }
    return new Intl.DateTimeFormat('en-PH', {
        timeStyle: 'short',
    }).format(d);
}

function lineAmountDisplay(amountStr: string | undefined): string {
    if (amountStr == null || String(amountStr).trim() === '') {
        return '—';
    }
    const n = Number.parseFloat(String(amountStr));
    return Number.isFinite(n) ? formatPhpMoney(n) : '—';
}

/** List preview: first account and first allocation (if any), one line; … if more lines exist. */
function TransactionListInlineSummary({
    t,
    accountOptions,
    allocationOptions,
}: {
    t: TransactionRow;
    accountOptions: { id: number; name: string }[];
    allocationOptions: { id: number; name: string }[];
}) {
    const accountNameById = new Map(
        accountOptions.map((a) => [a.id, a.name] as const),
    );
    const allocationNameById = new Map(
        allocationOptions.map((a) => [a.id, a.name] as const),
    );
    const accountLines = Array.isArray(t.accounts) ? t.accounts : [];
    const allocationLines = Array.isArray(t.allocations) ? t.allocations : [];

    if (accountLines.length === 0 && allocationLines.length === 0) {
        return <p className="text-muted-foreground text-sm">—</p>;
    }

    const accountBits: { name: string; amt: string }[] = [];
    for (const a of accountLines) {
        const acc = a.account;
        const nestedName =
            acc &&
            typeof acc === 'object' &&
            acc !== null &&
            'name' in acc
                ? String((acc as { name: string }).name)
                : null;
        const id = Number((a as { account_id?: unknown }).account_id);
        const name =
            nestedName ||
            (Number.isFinite(id) ? accountNameById.get(id) : undefined) ||
            (Number.isFinite(id) ? `Account #${id}` : 'Account');
        accountBits.push({
            name,
            amt: lineAmountDisplay(
                a.amount != null ? String(a.amount) : undefined,
            ),
        });
    }

    const allocBits: { name: string; amt: string }[] = [];
    for (const al of allocationLines) {
        const all = al.allocation;
        const nestedName =
            all &&
            typeof all === 'object' &&
            all !== null &&
            'name' in all
                ? String((all as { name: string }).name)
                : null;
        const id = Number((al as { allocation_id?: unknown }).allocation_id);
        const name =
            nestedName ||
            (Number.isFinite(id) ? allocationNameById.get(id) : undefined) ||
            (Number.isFinite(id) ? `Allocation #${id}` : 'Allocation');
        allocBits.push({
            name,
            amt: lineAmountDisplay(
                al.amount != null ? String(al.amount) : undefined,
            ),
        });
    }

    const showEllipsis =
        accountBits.length > 1 || allocBits.length > 1;
    const firstAcct = accountBits[0];
    const firstAlloc = allocBits[0];

    return (
        <p className="text-muted-foreground leading-relaxed text-sm wrap-break-word">
            {firstAcct != null ? (
                <>
                    <span className="font-medium text-foreground">
                        {firstAcct.name}
                    </span>{' '}
                    <span className="tabular-nums">{firstAcct.amt}</span>
                </>
            ) : null}
            {firstAcct != null && firstAlloc != null ? (
                <span className="text-muted-foreground"> · </span>
            ) : null}
            {firstAlloc != null ? (
                <>
                    <span className="font-medium text-foreground">
                        {firstAlloc.name}
                    </span>{' '}
                    <span className="tabular-nums">{firstAlloc.amt}</span>
                </>
            ) : null}
            {showEllipsis ? (
                <span className="text-muted-foreground"> …</span>
            ) : null}
        </p>
    );
}

function TransactionBreakdown({
    t,
    accountOptions,
    allocationOptions,
    variant = 'inline',
}: {
    t: TransactionRow;
    accountOptions: { id: number; name: string }[];
    allocationOptions: { id: number; name: string }[];
    variant?: 'inline' | 'detail';
}) {
    const accountNameById = new Map(
        accountOptions.map((a) => [a.id, a.name] as const),
    );
    const allocationNameById = new Map(
        allocationOptions.map((a) => [a.id, a.name] as const),
    );
    const accountLines = Array.isArray(t.accounts) ? t.accounts : [];
    const allocationLines = Array.isArray(t.allocations) ? t.allocations : [];
    if (accountLines.length === 0 && allocationLines.length === 0) {
        return <p className="text-muted-foreground text-sm">—</p>;
    }
    const isDetail = variant === 'detail';
    const outerClass = isDetail ? 'space-y-4' : 'space-y-2 text-sm';
    const rowClass = isDetail
        ? 'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-border border-b py-2.5 last:border-0'
        : 'flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5';
    const nameClass = isDetail
        ? 'min-w-0 font-medium break-words text-base'
        : 'min-w-0 font-medium break-words';
    const amountClass = isDetail
        ? 'shrink-0 tabular-nums text-base text-foreground'
        : 'shrink-0 tabular-nums text-muted-foreground';

    return (
        <div className={outerClass}>
            {accountLines.length > 0 ? (
                <div className={isDetail ? 'rounded-lg border bg-muted/20 p-3' : ''}>
                    {isDetail ? (
                        <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                            Accounts
                        </p>
                    ) : null}
                    <ul className={cn(isDetail ? 'space-y-0' : 'space-y-1.5')}>
                        {accountLines.map((a, i) => {
                            const acc = a.account;
                            const nestedName =
                                acc &&
                                typeof acc === 'object' &&
                                acc !== null &&
                                'name' in acc
                                    ? String((acc as { name: string }).name)
                                    : null;
                            const id = Number(
                                (a as { account_id?: unknown }).account_id,
                            );
                            const name =
                                nestedName ||
                                (Number.isFinite(id)
                                    ? accountNameById.get(id)
                                    : undefined) ||
                                (Number.isFinite(id)
                                    ? `Account #${id}`
                                    : 'Account');
                            return (
                                <li
                                    key={`acct-${t.id}-${id}-${i}`}
                                    className={rowClass}
                                >
                                    <span className={nameClass}>{name}</span>
                                    <span className={amountClass}>
                                        {lineAmountDisplay(
                                            a.amount != null
                                                ? String(a.amount)
                                                : undefined,
                                        )}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ) : null}
            {allocationLines.length > 0 ? (
                <div
                    className={cn(
                        isDetail
                            ? 'rounded-lg border bg-muted/20 p-3'
                            : '',
                        !isDetail &&
                            accountLines.length > 0 &&
                            'mt-2 border-border border-t pt-2',
                    )}
                >
                    {isDetail ? (
                        <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                            Allocations
                        </p>
                    ) : null}
                    <ul className={cn(isDetail ? 'space-y-0' : 'space-y-1.5')}>
                        {allocationLines.map((al, i) => {
                            const all = al.allocation;
                            const nestedName =
                                all &&
                                typeof all === 'object' &&
                                all !== null &&
                                'name' in all
                                    ? String((all as { name: string }).name)
                                    : null;
                            const id = Number(
                                (al as { allocation_id?: unknown })
                                    .allocation_id,
                            );
                            const name =
                                nestedName ||
                                (Number.isFinite(id)
                                    ? allocationNameById.get(id)
                                    : undefined) ||
                                (Number.isFinite(id)
                                    ? `Allocation #${id}`
                                    : 'Allocation');
                            return (
                                <li
                                    key={`alloc-${t.id}-${id}-${i}`}
                                    className={rowClass}
                                >
                                    <span className={nameClass}>{name}</span>
                                    <span className={amountClass}>
                                        {lineAmountDisplay(
                                            al.amount != null
                                                ? String(al.amount)
                                                : undefined,
                                        )}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}

export default function Dashboard() {
    const {
        accounts: accountsProp,
        allocations: allocationsProp,
        unallocated,
        unallocated_allocation_id: unallocatedAllocationIdProp,
        recentTransactions,
    } = usePage<DashboardProps>().props;
    const accounts = useMemo(
        () => (Array.isArray(accountsProp) ? accountsProp : []),
        [accountsProp],
    );
    const allocations = useMemo(
        () => (Array.isArray(allocationsProp) ? allocationsProp : []),
        [allocationsProp],
    );
    const transactionRows: TransactionRow[] = useMemo(
        () =>
            Array.isArray(recentTransactions?.data)
                ? recentTransactions.data.map((raw) => ensureTransactionRow(raw))
                : [],
        [recentTransactions?.data],
    );

    const sortedTransactionRows = useMemo(() => {
        return [...transactionRows].sort((a, b) => {
            const byDate = b.date.localeCompare(a.date);
            if (byDate !== 0) {
                return byDate;
            }
            const ta = a.created_at ?? '';
            const tb = b.created_at ?? '';
            const byCreated = tb.localeCompare(ta);
            if (byCreated !== 0) {
                return byCreated;
            }
            return b.id - a.id;
        });
    }, [transactionRows]);

    const transactionGroups = useMemo(() => {
        const groups: { date: string; items: TransactionRow[] }[] = [];
        for (const t of sortedTransactionRows) {
            const prev = groups[groups.length - 1];
            if (prev?.date === t.date) {
                prev.items.push(t);
            } else {
                groups.push({ date: t.date, items: [t] });
            }
        }
        return groups;
    }, [sortedTransactionRows]);

    const [createOpen, setCreateOpen] = useState(false);
    const [createPreset, setCreatePreset] =
        useState<CreateDialogPreset>('default');
    const [radialOpen, setRadialOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editing, setEditing] = useState<TransactionRow | null>(null);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState<TransactionRow | null>(null);
    const [detailTransaction, setDetailTransaction] =
        useState<TransactionRow | null>(null);

    const nonUnallocatedAllocs = useMemo(
        () => allocations.filter((a) => !a.is_unallocated),
        [allocations],
    );
    const canCreateTransfer =
        accounts.length >= 2 || nonUnallocatedAllocs.length >= 2;
    const hasCreditCard = accounts.some((a) => a.type === 'credit_card');
    const hasCardPaymentSource = accounts.some(
        (a) => a.type !== 'credit_card',
    );
    const canCreateCreditCardTx = hasCreditCard && hasCardPaymentSource;
    const hasPersonAccount = accounts.some((a) => a.type === 'person');
    const hasLoanFundingOrAlloc =
        accounts.some((a) => a.type !== 'person') ||
        nonUnallocatedAllocs.length > 0;
    const canCreateLoan = hasPersonAccount && hasLoanFundingOrAlloc;

    const emptyMessage = useMemo(() => {
        if (accounts.length === 0 && allocations.length === 0) {
            return 'Create an account or allocation first.';
        }
        return 'No transactions yet. Add one to get started.';
    }, [accounts.length, allocations.length]);

    const unallocatedNum = Number.parseFloat(unallocated);
    const showUnallocated =
        Number.isFinite(unallocatedNum) && unallocatedNum !== 0;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            <div className="flex h-full min-h-0 flex-1 flex-col gap-6 p-4">
                <div className="flex flex-row items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-semibold">Dashboard</h1>
                        <p className="text-muted-foreground text-sm">
                            Accounts, allocations, and latest activity.
                        </p>
                    </div>
                    <div className="shrink-0">
                        <RadialBubbleMenu
                            className="drop-shadow-sm"
                            open={radialOpen}
                            onOpenChange={setRadialOpen}
                            placement="bottom-end"
                            triggerLabel="Add"
                            items={[
                                {
                                    id: 'transaction',
                                    label: 'New transaction',
                                    caption: 'Transaction',
                                    icon: Receipt,
                                    disabled:
                                        accounts.length === 0 &&
                                        allocations.length === 0,
                                    onSelect: () => {
                                        setCreatePreset('default');
                                        setCreateOpen(true);
                                    },
                                },
                                {
                                    id: 'income',
                                    label: 'Record income',
                                    caption: 'Income',
                                    icon: Wallet,
                                    href: IncomeFromTemplateController.create()
                                        .url,
                                },
                                {
                                    id: 'transfer',
                                    label: 'New transfer',
                                    caption: 'Transfer',
                                    icon: ArrowLeftRight,
                                    disabled: !canCreateTransfer,
                                    onSelect: () => {
                                        setCreatePreset('transfer');
                                        setCreateOpen(true);
                                    },
                                },
                                {
                                    id: 'credit_card',
                                    label: 'Card',
                                    caption: 'Payment',
                                    icon: CreditCard,
                                    disabled: !canCreateCreditCardTx,
                                    onSelect: () => {
                                        setCreatePreset('credit_card');
                                        setCreateOpen(true);
                                    },
                                },
                                {
                                    id: 'loan',
                                    label: 'Loan',
                                    caption: 'Loan',
                                    icon: Landmark,
                                    disabled: !canCreateLoan,
                                    onSelect: () => {
                                        setCreatePreset('loan');
                                        setCreateOpen(true);
                                    },
                                },
                                {
                                    id: 'account',
                                    label: 'New account',
                                    caption: 'Account',
                                    icon: Building2,
                                    href: AccountController.create().url,
                                },
                                {
                                    id: 'allocation',
                                    label: 'New allocation',
                                    caption: 'Allocation',
                                    icon: PiggyBank,
                                    href: AllocationController.create().url,
                                },
                            ]}
                        />
                    </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    <Card>
                        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                            <div>
                                <CardTitle>Accounts</CardTitle>
                                <CardDescription>Balances in Penny</CardDescription>
                            </div>
                            <Button variant="outline" size="sm" asChild>
                                <Link href={AccountController.index()}>
                                    Manage
                                </Link>
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {accounts.length === 0 ? (
                                <p className="text-muted-foreground text-sm">
                                    No accounts yet.{' '}
                                    <Link
                                        className="text-primary underline"
                                        href={AccountController.index()}
                                    >
                                        Create one
                                    </Link>
                                    .
                                </p>
                            ) : (
                                <ul className="divide-y divide-border">
                                    {accounts.map((a) => (
                                        <li key={a.id}>
                                            <div className="hover:bg-muted/50 flex items-start gap-1 px-1 py-2 transition-colors first:pt-0">
                                                <Link
                                                    href={AccountController.edit(
                                                        {
                                                            account: a.id,
                                                        },
                                                    )}
                                                    className="focus-visible:ring-ring min-w-0 flex-1 text-left focus-visible:ring-2 focus-visible:outline-none"
                                                >
                                                    <p className="font-medium">
                                                        {a.name}
                                                    </p>
                                                    <p className="text-muted-foreground text-xs">
                                                        {formatTypeLabel(
                                                            String(a.type),
                                                        )}{' '}
                                                        ·{' '}
                                                        {formatPhpMoney(
                                                            a.balance,
                                                        )}
                                                    </p>
                                                </Link>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger
                                                        asChild
                                                    >
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-muted-foreground size-8 shrink-0"
                                                            aria-label={`Actions for ${a.name}`}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                            }}
                                                            onPointerDown={(e) => {
                                                                e.stopPropagation();
                                                            }}
                                                        >
                                                            <MoreVertical className="size-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem
                                                            asChild
                                                        >
                                                            <Link
                                                                href={AccountController.edit(
                                                                    {
                                                                        account: a.id,
                                                                    },
                                                                )}
                                                            >
                                                                <Pencil className="size-4" />
                                                                Edit
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            variant="destructive"
                                                            onClick={() => {
                                                                if (
                                                                    !confirm(
                                                                        'Delete this account? This is only allowed when it has no transaction lines.',
                                                                    )
                                                                ) {
                                                                    return;
                                                                }
                                                                router.delete(
                                                                    AccountController.destroy.url(
                                                                        {
                                                                            account: a.id,
                                                                        },
                                                                    ),
                                                                );
                                                            }}
                                                        >
                                                            <Trash2 className="size-4" />
                                                            Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                            <div>
                                <CardTitle>Allocations</CardTitle>
                                <CardDescription>
                                    Envelopes and savings
                                </CardDescription>
                            </div>
                            <Button variant="outline" size="sm" asChild>
                                <Link href={AllocationController.index()}>
                                    Manage
                                </Link>
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {showUnallocated && (
                                <div className="text-muted-foreground mb-3 flex items-baseline justify-between gap-2 border-b border-dashed border-border pb-2.5 text-sm">
                                    <span>Unallocated</span>
                                    <span className="text-foreground font-medium tabular-nums">
                                        {formatPhpMoney(unallocated)}
                                    </span>
                                </div>
                            )}
                            {allocations.length === 0 ? (
                                <p className="text-muted-foreground text-sm">
                                    No allocations yet.{' '}
                                    <Link
                                        className="text-primary underline"
                                        href={AllocationController.index()}
                                    >
                                        Create one
                                    </Link>
                                    .
                                </p>
                            ) : (
                                <ul className="divide-y divide-border">
                                    {allocations.map((a) => (
                                        <li key={a.id}>
                                            <div className="hover:bg-muted/50 flex items-start gap-1 px-1 py-2 transition-colors first:pt-0">
                                                <Link
                                                    href={AllocationController.edit(
                                                        {
                                                            allocation: a.id,
                                                        },
                                                    )}
                                                    className="focus-visible:ring-ring min-w-0 flex-1 text-left focus-visible:ring-2 focus-visible:outline-none"
                                                >
                                                    <p className="font-medium">
                                                        {a.name}
                                                    </p>
                                                    <p className="text-muted-foreground mt-0.5 text-xs">
                                                        {formatTypeLabel(
                                                            String(a.type),
                                                        )}{' '}
                                                        ·{' '}
                                                        {formatPhpMoney(
                                                            a.balance,
                                                        )}
                                                    </p>
                                                </Link>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger
                                                        asChild
                                                    >
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-muted-foreground size-8 shrink-0"
                                                            aria-label={`Actions for ${a.name}`}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                            }}
                                                            onPointerDown={(e) => {
                                                                e.stopPropagation();
                                                            }}
                                                        >
                                                            <MoreVertical className="size-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem
                                                            asChild
                                                        >
                                                            <Link
                                                                href={AllocationController.edit(
                                                                    {
                                                                        allocation:
                                                                            a.id,
                                                                    },
                                                                )}
                                                            >
                                                                <Pencil className="size-4" />
                                                                Edit
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            variant="destructive"
                                                            onClick={() => {
                                                                if (
                                                                    !confirm(
                                                                        'Delete this allocation? This is only allowed when it has no transaction lines.',
                                                                    )
                                                                ) {
                                                                    return;
                                                                }
                                                                router.delete(
                                                                    AllocationController.destroy.url(
                                                                        {
                                                                            allocation:
                                                                                a.id,
                                                                        },
                                                                    ),
                                                                );
                                                            }}
                                                        >
                                                            <Trash2 className="size-4" />
                                                            Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <Card className="min-h-0 flex-1">
                    <CardHeader>
                        <CardTitle>Recent transactions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {sortedTransactionRows.length === 0 ? (
                            <p className="text-muted-foreground text-sm">
                                {emptyMessage}
                            </p>
                        ) : (
                            <div className="max-h-[min(50vh,28rem)] overflow-y-auto rounded-md border">
                                <InfiniteScroll
                                    as="div"
                                    className="divide-y divide-border"
                                    data="recentTransactions"
                                    onlyNext
                                >
                                    {({ loadingNext }) => (
                                        <>
                                            {transactionGroups.map((group) => (
                                                <div key={group.date}>
                                                    <div className="bg-muted/50 px-3 py-2">
                                                        <p className="text-muted-foreground text-xs font-semibold">
                                                            {formatTransactionGroupDate(
                                                                group.date,
                                                            )}
                                                        </p>
                                                    </div>
                                                    <ul className="divide-y divide-border">
                                                        {group.items.map((t) => {
                                                            const timeLabel =
                                                                formatTransactionTime(
                                                                    t.created_at,
                                                                );
                                                            return (
                                                                <li key={t.id}>
                                                                    <div className="hover:bg-muted/50 flex items-start gap-1 px-3 py-3 transition-colors">
                                                                        <button
                                                                            type="button"
                                                                            className="focus-visible:ring-ring min-w-0 flex-1 cursor-pointer text-left focus-visible:ring-2 focus-visible:outline-none"
                                                                            aria-label={`View details: ${t.description}${timeLabel ? `, ${timeLabel}` : ''}`}
                                                                            onClick={() =>
                                                                                setDetailTransaction(
                                                                                    t,
                                                                                )
                                                                            }
                                                                        >
                                                                            <div className="space-y-2">
                                                                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                                                                    <span className="font-medium">
                                                                                        {
                                                                                            t.description
                                                                                        }
                                                                                    </span>
                                                                                    {timeLabel ? (
                                                                                        <span className="text-muted-foreground text-xs tabular-nums">
                                                                                            {
                                                                                                timeLabel
                                                                                            }
                                                                                        </span>
                                                                                    ) : null}
                                                                                </div>
                                                                                <TransactionListInlineSummary
                                                                                    t={
                                                                                        t
                                                                                    }
                                                                                    accountOptions={
                                                                                        accounts
                                                                                    }
                                                                                    allocationOptions={
                                                                                        allocations
                                                                                    }
                                                                                />
                                                                            </div>
                                                                        </button>
                                                                        <DropdownMenu>
                                                                            <DropdownMenuTrigger
                                                                                asChild
                                                                            >
                                                                                <Button
                                                                                    type="button"
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="text-muted-foreground shrink-0"
                                                                                    aria-label="Transaction actions"
                                                                                    onClick={(
                                                                                        e,
                                                                                    ) => {
                                                                                        e.preventDefault();
                                                                                        e.stopPropagation();
                                                                                    }}
                                                                                    onPointerDown={(
                                                                                        e,
                                                                                    ) => {
                                                                                        e.stopPropagation();
                                                                                    }}
                                                                                >
                                                                                    <MoreVertical className="size-4" />
                                                                                </Button>
                                                                            </DropdownMenuTrigger>
                                                                            <DropdownMenuContent align="end">
                                                                                <DropdownMenuItem
                                                                                    onClick={() => {
                                                                                        setDetailTransaction(
                                                                                            null,
                                                                                        );
                                                                                        setEditing(
                                                                                            t,
                                                                                        );
                                                                                        setEditOpen(
                                                                                            true,
                                                                                        );
                                                                                    }}
                                                                                >
                                                                                    <Pencil className="size-4" />
                                                                                    Edit
                                                                                </DropdownMenuItem>
                                                                                <DropdownMenuItem
                                                                                    variant="destructive"
                                                                                    onClick={() => {
                                                                                        setDetailTransaction(
                                                                                            null,
                                                                                        );
                                                                                        setDeleting(
                                                                                            t,
                                                                                        );
                                                                                        setDeleteOpen(
                                                                                            true,
                                                                                        );
                                                                                    }}
                                                                                >
                                                                                    <Trash2 className="size-4" />
                                                                                    Delete
                                                                                </DropdownMenuItem>
                                                                            </DropdownMenuContent>
                                                                        </DropdownMenu>
                                                                    </div>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                </div>
                                            ))}
                                            {loadingNext && (
                                                <div className="text-muted-foreground px-3 py-4 text-center text-sm">
                                                    Loading…
                                                </div>
                                            )}
                                        </>
                                    )}
                                </InfiniteScroll>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog
                open={detailTransaction !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setDetailTransaction(null);
                    }
                }}
            >
                <DialogContent className="max-h-[min(90vh,40rem)] max-w-lg overflow-y-auto">
                    {detailTransaction ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>
                                    {detailTransaction.description}
                                </DialogTitle>
                                <DialogDescription className="space-y-1">
                                    <span className="block">
                                        {formatTransactionGroupDate(
                                            detailTransaction.date,
                                        )}
                                    </span>
                                    {formatTransactionTime(
                                        detailTransaction.created_at,
                                    ) ? (
                                        <span className="block">
                                            {formatTransactionTime(
                                                detailTransaction.created_at,
                                            )}
                                        </span>
                                    ) : null}
                                </DialogDescription>
                            </DialogHeader>
                            {detailTransaction.note ? (
                                <p className="text-muted-foreground border-primary/30 border-l-2 py-1 pl-3 text-sm">
                                    {detailTransaction.note}
                                </p>
                            ) : null}
                            <TransactionBreakdown
                                t={detailTransaction}
                                accountOptions={accounts}
                                allocationOptions={allocations}
                                variant="detail"
                            />
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>

            <TransactionFormDialog
                open={createOpen}
                onOpenChange={(open) => {
                    setCreateOpen(open);
                    if (!open) {
                        setCreatePreset('default');
                    }
                }}
                mode="create"
                createPreset={createPreset}
                transaction={null}
                accounts={accounts}
                allocations={allocations}
                unallocatedAllocationId={unallocatedAllocationIdProp}
            />

            <TransactionFormDialog
                key={editing?.id ?? 'edit'}
                open={editOpen}
                onOpenChange={(o) => {
                    setEditOpen(o);
                    if (!o) {
                        setEditing(null);
                    }
                }}
                mode="edit"
                transaction={editing}
                accounts={accounts}
                allocations={allocations}
                unallocatedAllocationId={null}
            />

            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete transaction</DialogTitle>
                        <DialogDescription>
                            {deleting
                                ? `Remove “${deleting.description}” (${deleting.date})? This cannot be undone.`
                                : null}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setDeleteOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => {
                                if (!deleting) {
                                    return;
                                }
                                router.delete(
                                    TransactionController.destroy.url({
                                        transaction: deleting.id,
                                    }),
                                    { preserveScroll: true },
                                );
                                setDeleteOpen(false);
                                setDeleting(null);
                            }}
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
