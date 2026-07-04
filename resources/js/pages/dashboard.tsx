import AccountController from '@/actions/App/Http/Controllers/AccountController';
import AllocationController from '@/actions/App/Http/Controllers/AllocationController';
import IncomeFromTemplateController from '@/actions/App/Http/Controllers/IncomeFromTemplateController';
import TransactionController from '@/actions/App/Http/Controllers/TransactionController';
import { CreateActionDialog } from '@/components/create-action-dialog';
import { GuidedEntryForm } from '@/components/guided-entry-form';
import {
    formatTransactionGroupDate,
    formatTransactionTime,
    TransactionBreakdown,
} from '@/components/transaction-display';
import {
    TransactionFormDialog,
    type AccountOption,
    type AllocationOption,
    type CreateDialogPreset,
} from '@/components/transaction-form-dialog';
import { TransactionScrollList } from '@/components/transaction-scroll-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from '@/components/ui/chart';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import AppLayout from '@/layouts/app-layout';
import { formatPhpMoney } from '@/lib/format';
import { type DashboardTransactionRow } from '@/lib/transaction-row';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Deferred, Head, Link, router, usePage } from '@inertiajs/react';
import {
    Activity,
    ArrowLeftRight,
    Building2,
    CreditCard,
    Landmark,
    MoreVertical,
    Pencil,
    PiggyBank,
    Plus,
    Receipt,
    ReceiptText,
    Trash2,
    TrendingDown,
    TrendingUp,
    Wallet,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';

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

type CashFlowPeriodKey = 'today' | 'last_7_days' | 'last_30_days';

type CashFlowSlice = {
    income: string;
    expense: string;
};

type DashboardStats = {
    account_balance_total: string;
    allocation_balance_total: string;
    transaction_count: number;
    cash_flow: Record<CashFlowPeriodKey, CashFlowSlice>;
    activity_last_7_days: {
        date: string;
        income: string;
        expense: string;
    }[];
};

type DashboardProps = {
    accounts: AccountOption[];
    allocations: AllocationOption[];
    unallocated: string;
    unallocated_allocation_id: number | null;
    recentTransactions?: PaginatedTransactions;
    stats?: DashboardStats;
};

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: dashboard().url,
    },
];

function parseLocalYmd(dateYmd: string): Date | null {
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
        return null;
    }
    return new Date(y, m - 1, d);
}

function shortWeekdayLabel(dateYmd: string): string {
    const dt = parseLocalYmd(dateYmd);
    if (!dt) {
        return dateYmd;
    }
    return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(dt);
}

/** e.g. "May 5" */
function shortCalendarLabel(dateYmd: string): string {
    const dt = parseLocalYmd(dateYmd);
    if (!dt) {
        return dateYmd;
    }
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
    }).format(dt);
}

function chartMoneyAmount(amountStr: string): number {
    const n = Number.parseFloat(amountStr);
    return Number.isFinite(n) ? n : 0;
}

const incomeExpenseChartConfig = {
    income: {
        label: 'Income',
        color: 'var(--chart-1)',
    },
    expense: {
        label: 'Expense',
        color: 'var(--chart-2)',
    },
} satisfies ChartConfig;

function DashboardActivityChart({
    days,
}: {
    days: { date: string; income: string; expense: string }[];
}) {
    const chartData = useMemo(
        () =>
            days.map((d) => ({
                date: d.date,
                income: chartMoneyAmount(d.income),
                expense: chartMoneyAmount(d.expense),
            })),
        [days],
    );

    return (
        <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="text-sm font-medium">Income & expense</p>
                </div>
                <Activity
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                />
            </div>
            <ChartContainer
                config={incomeExpenseChartConfig}
                className="aspect-auto h-[220px] w-full"
            >
                <AreaChart
                    accessibilityLayer
                    data={chartData}
                    margin={{ left: 12, right: 12, top: 8, bottom: 44 }}
                >
                    <defs>
                        <linearGradient
                            id="activityIncomeFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop
                                offset="0%"
                                stopColor="var(--color-income)"
                                stopOpacity={0.35}
                            />
                            <stop
                                offset="100%"
                                stopColor="var(--color-income)"
                                stopOpacity={0}
                            />
                        </linearGradient>
                        <linearGradient
                            id="activityExpenseFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop
                                offset="0%"
                                stopColor="var(--color-expense)"
                                stopOpacity={0.35}
                            />
                            <stop
                                offset="100%"
                                stopColor="var(--color-expense)"
                                stopOpacity={0}
                            />
                        </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                        minTickGap={0}
                        tickMargin={6}
                        padding={{ left: 12, right: 12 }}
                        tick={(props) => {
                            const { x = 0, y = 0, payload } = props;
                            const dateYmd =
                                typeof payload?.value === 'string'
                                    ? payload.value
                                    : '';
                            return (
                                <g transform={`translate(${x},${y})`}>
                                    <text
                                        textAnchor="middle"
                                        className="fill-muted-foreground"
                                        fontSize={10}
                                    >
                                        <tspan x={0} dy={12}>
                                            {shortWeekdayLabel(dateYmd)}
                                        </tspan>
                                        <tspan
                                            x={0}
                                            dy={12}
                                            className="fill-muted-foreground/90"
                                        >
                                            {shortCalendarLabel(dateYmd)}
                                        </tspan>
                                    </text>
                                </g>
                            );
                        }}
                    />
                    <ChartTooltip
                        cursor={false}
                        content={
                            <ChartTooltipContent
                                hideIndicator
                                labelFormatter={(_, payload) => {
                                    const row = payload?.[0]?.payload as
                                        | { date?: string }
                                        | undefined;
                                    const d = row?.date;
                                    if (d == null || d === '') {
                                        return '';
                                    }
                                    return `${shortWeekdayLabel(d)}, ${shortCalendarLabel(d)}`;
                                }}
                                formatter={(value, _name, item) => {
                                    const key = String(item?.dataKey ?? '');
                                    const isIncome = key === 'income';
                                    const Icon = isIncome
                                        ? TrendingUp
                                        : TrendingDown;
                                    return (
                                        <div className="flex w-full min-w-44 items-center justify-between gap-3">
                                            <span className="flex items-center gap-1.5 text-muted-foreground">
                                                <Icon
                                                    className="size-3.5 shrink-0"
                                                    style={{
                                                        color: isIncome
                                                            ? 'var(--color-income)'
                                                            : 'var(--color-expense)',
                                                    }}
                                                    aria-hidden
                                                />
                                                <span>
                                                    {isIncome
                                                        ? 'Income'
                                                        : 'Expense'}
                                                </span>
                                            </span>
                                            <span className="font-mono font-medium text-foreground tabular-nums">
                                                {formatPhpMoney(Number(value))}
                                            </span>
                                        </div>
                                    );
                                }}
                            />
                        }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Area
                        name="Income"
                        dataKey="income"
                        type="natural"
                        stroke="var(--color-income)"
                        strokeWidth={2}
                        fill="url(#activityIncomeFill)"
                    />
                    <Area
                        name="Expense"
                        dataKey="expense"
                        type="natural"
                        stroke="var(--color-expense)"
                        strokeWidth={2}
                        fill="url(#activityExpenseFill)"
                    />
                </AreaChart>
            </ChartContainer>
        </div>
    );
}

function DashboardDeferredSkeleton() {
    return (
        <div
            className="space-y-6"
            aria-busy="true"
            aria-label="Loading dashboard statistics and activity"
        >
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div
                        key={i}
                        className="space-y-2 rounded-lg border bg-card px-4 py-3 shadow-sm"
                    >
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-7 w-32" />
                        <Skeleton className="h-3 max-w-48" />
                    </div>
                ))}
            </div>
            <div className="w-full min-w-0 lg:w-1/2">
                <Card className="gap-0 py-4 shadow-sm">
                    <CardContent className="space-y-3 px-4 pt-0 pb-4">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-[220px] w-full" />
                    </CardContent>
                </Card>
            </div>
            <Card className="gap-4 py-5 shadow-sm">
                <CardHeader className="pb-2">
                    <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent className="space-y-3 pb-6">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                </CardContent>
            </Card>
        </div>
    );
}

type DashboardDeferredPanelsProps = {
    accounts: AccountOption[];
    allocations: AllocationOption[];
    emptyMessage: string;
    setDetailTransaction: (t: TransactionRow | null) => void;
    setEditing: (t: TransactionRow | null) => void;
    setEditOpen: (open: boolean) => void;
    setDeleting: (t: TransactionRow | null) => void;
    setDeleteOpen: (open: boolean) => void;
};

function DashboardDeferredPanels({
    accounts,
    allocations,
    emptyMessage,
    setDetailTransaction,
    setEditing,
    setEditOpen,
    setDeleting,
    setDeleteOpen,
}: DashboardDeferredPanelsProps) {
    const { stats: statsProp, recentTransactions } =
        usePage<DashboardProps>().props;

    const [cashFlowPeriod, setCashFlowPeriod] =
        useState<CashFlowPeriodKey>('today');

    const stats = statsProp;

    if (stats == null || recentTransactions == null) {
        return null;
    }

    const cashSlice = stats.cash_flow[cashFlowPeriod];

    return (
        <div className="space-y-6">
            <div className="grid gap-4 xl:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.15fr)] xl:items-start">
                <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between xl:flex-col xl:items-start">
                        <p className="text-xs text-muted-foreground">
                            Income & expense on accounts
                        </p>
                        <ToggleGroup
                            type="single"
                            value={cashFlowPeriod}
                            onValueChange={(v) => {
                                if (
                                    v === 'today' ||
                                    v === 'last_7_days' ||
                                    v === 'last_30_days'
                                ) {
                                    setCashFlowPeriod(v);
                                }
                            }}
                            variant="outline"
                            size="sm"
                            className="justify-start sm:justify-end xl:justify-start"
                        >
                            <ToggleGroupItem value="today" aria-label="Today">
                                Today
                            </ToggleGroupItem>
                            <ToggleGroupItem
                                value="last_7_days"
                                aria-label="Last 7 days"
                            >
                                7 days
                            </ToggleGroupItem>
                            <ToggleGroupItem
                                value="last_30_days"
                                aria-label="Last 30 days"
                            >
                                30 days
                            </ToggleGroupItem>
                        </ToggleGroup>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                        <StatTile
                            label="Total in accounts"
                            value={formatPhpMoney(stats.account_balance_total)}
                            icon={Building2}
                        />
                        <StatTile
                            label="In envelopes"
                            value={formatPhpMoney(
                                stats.allocation_balance_total,
                            )}
                            icon={PiggyBank}
                        />
                        <StatTile
                            label="Income"
                            value={formatPhpMoney(cashSlice.income)}
                            icon={TrendingUp}
                            tone="income"
                        />
                        <StatTile
                            label="Expense"
                            value={formatPhpMoney(cashSlice.expense)}
                            icon={TrendingDown}
                            tone="expense"
                        />
                    </div>
                </div>

                <Card className="min-w-0 gap-0 border-primary/15 bg-primary/[0.025] py-4 shadow-sm dark:border-primary/20 dark:bg-primary/[0.07]">
                    <CardContent className="px-4 pt-0 pb-1">
                        <DashboardActivityChart
                            days={stats.activity_last_7_days}
                        />
                    </CardContent>
                </Card>
            </div>

            <Card className="min-h-0 flex-1 gap-4 border-primary/10 bg-primary/[0.02] py-5 shadow-sm dark:border-primary/20 dark:bg-primary/[0.05]">
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-lg">
                        Recent transactions
                    </CardTitle>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0 text-xs"
                        asChild
                    >
                        <Link href={TransactionController.index()} prefetch>
                            View all
                        </Link>
                    </Button>
                </CardHeader>
                <CardContent className="pb-6">
                    <TransactionScrollList
                        dataKey="recentTransactions"
                        accounts={accounts}
                        allocations={allocations}
                        emptyMessage={emptyMessage}
                        onSelectDetail={setDetailTransaction}
                        onEdit={setEditing}
                        setEditOpen={setEditOpen}
                        onDelete={setDeleting}
                        setDeleteOpen={setDeleteOpen}
                    />
                </CardContent>
            </Card>
        </div>
    );
}

function StatTile({
    label,
    value,
    icon: Icon,
    tone = 'neutral',
}: {
    label: string;
    value: string;
    icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
    tone?: 'neutral' | 'income' | 'expense';
}) {
    const toneClass = {
        neutral: {
            tile: 'border-primary/15 bg-primary/[0.025] dark:border-primary/20 dark:bg-primary/[0.06]',
            label: 'text-primary/80 dark:text-primary',
            value: 'text-foreground',
            icon: 'text-primary/70 dark:text-primary',
        },
        income: {
            tile: 'border-emerald-500/25 bg-emerald-500/[0.06] dark:border-emerald-400/25 dark:bg-emerald-400/[0.08]',
            label: 'text-emerald-700 dark:text-emerald-300',
            value: 'text-emerald-800 dark:text-emerald-200',
            icon: 'text-emerald-600 dark:text-emerald-300',
        },
        expense: {
            tile: 'border-rose-500/25 bg-rose-500/[0.06] dark:border-rose-400/25 dark:bg-rose-400/[0.08]',
            label: 'text-rose-700 dark:text-rose-300',
            value: 'text-rose-800 dark:text-rose-200',
            icon: 'text-rose-600 dark:text-rose-300',
        },
    }[tone];

    return (
        <div className={cn('rounded-lg px-4 py-3 shadow-sm', toneClass.tile)}>
            <div className="flex items-start justify-between gap-2">
                <p className={cn('text-xs font-medium', toneClass.label)}>
                    {label}
                </p>
                <Icon
                    className={cn('size-3.5 shrink-0', toneClass.icon)}
                    aria-hidden
                />
            </div>
            <p
                className={cn(
                    'mt-1 font-semibold tabular-nums',
                    toneClass.value,
                )}
            >
                {value}
            </p>
        </div>
    );
}

export default function Dashboard() {
    const {
        accounts: accountsProp,
        allocations: allocationsProp,
        unallocated,
        unallocated_allocation_id: unallocatedAllocationIdProp,
    } = usePage<DashboardProps>().props;

    const accounts = useMemo(
        () => (Array.isArray(accountsProp) ? accountsProp : []),
        [accountsProp],
    );
    const allocations = useMemo(
        () => (Array.isArray(allocationsProp) ? allocationsProp : []),
        [allocationsProp],
    );

    const [createOpen, setCreateOpen] = useState(false);
    const [purchaseOpen, setPurchaseOpen] = useState(false);
    const [createPreset, setCreatePreset] =
        useState<CreateDialogPreset>('default');
    const [createChoiceOpen, setCreateChoiceOpen] = useState(false);
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
    const hasCardPaymentSource = accounts.some((a) => a.type !== 'credit_card');
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

    const openCreatePreset = (preset: CreateDialogPreset) => {
        setCreatePreset(preset);
        setCreateOpen(true);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            <div className="flex h-full min-h-0 flex-1 flex-col gap-6 p-4">
                <div className="flex flex-row items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-semibold">Dashboard</h1>
                        <p className="text-sm text-muted-foreground">
                            Accounts, allocations, and latest activity.
                        </p>
                    </div>
                    <div className="shrink-0">
                        <Button
                            type="button"
                            size="icon"
                            className="size-11 rounded-full shadow-sm"
                            onClick={() => setCreateChoiceOpen(true)}
                            aria-label="Add"
                        >
                            <Plus className="size-5" aria-hidden />
                        </Button>
                    </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    <Card className="gap-3 border-primary/15 bg-primary/[0.025] py-4 shadow-sm dark:border-primary/20 dark:bg-primary/[0.06]">
                        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 px-4 pt-0 pb-2">
                            <div className="min-w-0">
                                <CardTitle className="text-sm leading-snug">
                                    Accounts
                                </CardTitle>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 shrink-0 text-xs"
                                asChild
                            >
                                <Link href={AccountController.index()}>
                                    Manage
                                </Link>
                            </Button>
                        </CardHeader>
                        <CardContent className="px-4 pt-0 pb-3">
                            {accounts.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
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
                                <ul className="max-h-44 divide-y divide-border overflow-y-auto">
                                    {accounts.map((a) => (
                                        <li key={a.id}>
                                            <div className="flex items-center gap-1 px-1 py-1.5 transition-colors first:pt-0 hover:bg-muted/50">
                                                <Link
                                                    href={AccountController.show(
                                                        {
                                                            account: a.id,
                                                        },
                                                    )}
                                                    className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                                >
                                                    <span className="truncate text-sm font-medium">
                                                        {a.name}
                                                    </span>
                                                    <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                                                        {formatPhpMoney(
                                                            a.balance,
                                                        )}
                                                    </span>
                                                </Link>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger
                                                        asChild
                                                    >
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="size-7 shrink-0 text-muted-foreground"
                                                            aria-label={`Actions for ${a.name}`}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                            }}
                                                            onPointerDown={(
                                                                e,
                                                            ) => {
                                                                e.stopPropagation();
                                                            }}
                                                        >
                                                            <MoreVertical className="size-3.5" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem
                                                            asChild
                                                        >
                                                            <Link
                                                                href={AccountController.edit(
                                                                    {
                                                                        account:
                                                                            a.id,
                                                                    },
                                                                )}
                                                            >
                                                                <Pencil className="size-3.5" />
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
                                                                            account:
                                                                                a.id,
                                                                        },
                                                                    ),
                                                                );
                                                            }}
                                                        >
                                                            <Trash2 className="size-3.5" />
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

                    <Card className="gap-3 border-primary/15 bg-primary/[0.025] py-4 shadow-sm dark:border-primary/20 dark:bg-primary/[0.06]">
                        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 px-4 pt-0 pb-2">
                            <div className="min-w-0">
                                <CardTitle className="text-sm leading-snug">
                                    Allocations
                                </CardTitle>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 shrink-0 text-xs"
                                asChild
                            >
                                <Link href={AllocationController.index()}>
                                    Manage
                                </Link>
                            </Button>
                        </CardHeader>
                        <CardContent className="px-4 pt-0 pb-3">
                            {showUnallocated && (
                                <div className="mb-2 flex items-baseline justify-between gap-2 border-b border-dashed border-border pb-2 text-[11px] text-muted-foreground">
                                    <span>Unallocated</span>
                                    <span className="font-medium text-foreground tabular-nums">
                                        {formatPhpMoney(unallocated)}
                                    </span>
                                </div>
                            )}
                            {allocations.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
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
                                <ul className="max-h-44 divide-y divide-border overflow-y-auto">
                                    {allocations.map((a) => (
                                        <li key={a.id}>
                                            <div className="flex items-center gap-1 px-1 py-1.5 transition-colors first:pt-0 hover:bg-muted/50">
                                                <Link
                                                    href={AllocationController.show(
                                                        {
                                                            allocation: a.id,
                                                        },
                                                    )}
                                                    className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                                >
                                                    <span className="truncate text-sm font-medium">
                                                        {a.name}
                                                    </span>
                                                    <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                                                        {formatPhpMoney(
                                                            a.balance,
                                                        )}
                                                    </span>
                                                </Link>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger
                                                        asChild
                                                    >
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="size-7 shrink-0 text-muted-foreground"
                                                            aria-label={`Actions for ${a.name}`}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                            }}
                                                            onPointerDown={(
                                                                e,
                                                            ) => {
                                                                e.stopPropagation();
                                                            }}
                                                        >
                                                            <MoreVertical className="size-3.5" />
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
                                                                <Pencil className="size-3.5" />
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
                                                            <Trash2 className="size-3.5" />
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

                <Deferred
                    data={['stats', 'recentTransactions']}
                    fallback={<DashboardDeferredSkeleton />}
                >
                    {({ reloading }) => (
                        <div
                            className={cn(
                                'transition-opacity',
                                reloading ? 'opacity-70' : '',
                            )}
                        >
                            <DashboardDeferredPanels
                                accounts={accounts}
                                allocations={allocations}
                                emptyMessage={emptyMessage}
                                setDetailTransaction={setDetailTransaction}
                                setEditing={setEditing}
                                setEditOpen={setEditOpen}
                                setDeleting={setDeleting}
                                setDeleteOpen={setDeleteOpen}
                            />
                        </div>
                    )}
                </Deferred>
            </div>

            <CreateActionDialog
                open={createChoiceOpen}
                onOpenChange={setCreateChoiceOpen}
                title="What do you want to create?"
                description="Choose the workflow that matches what you want to add."
                items={[
                    {
                        id: 'purchase',
                        title: 'Purchase',
                        description: 'Record spending.',
                        icon: Receipt,
                        disabled:
                            !accounts.some((a) => a.type !== 'person') ||
                            allocations.length === 0,
                        onSelect: () => setPurchaseOpen(true),
                    },
                    {
                        id: 'bill-split',
                        title: 'Split a bill',
                        description:
                            'Itemize a receipt and assign each person’s share.',
                        icon: ReceiptText,
                        disabled:
                            !accounts.some((a) => a.type !== 'person') ||
                            allocations.length === 0,
                        href: '/bill-splits/create',
                    },
                    {
                        id: 'income',
                        title: 'Income',
                        description:
                            'Record income, with an optional template.',
                        icon: Wallet,
                        href: IncomeFromTemplateController.create().url,
                    },
                    {
                        id: 'transfer',
                        title: 'Transfer',
                        description:
                            'Move money between accounts or envelopes.',
                        icon: ArrowLeftRight,
                        disabled: !canCreateTransfer,
                        onSelect: () => openCreatePreset('transfer'),
                    },
                    {
                        id: 'payment',
                        title: 'Credit Card',
                        description: 'Pay down a credit card.',
                        icon: CreditCard,
                        disabled: !canCreateCreditCardTx,
                        onSelect: () => openCreatePreset('credit_card'),
                    },
                    {
                        id: 'loan',
                        title: 'Loan',
                        description: 'Track money owed with a person.',
                        icon: Landmark,
                        disabled: !canCreateLoan,
                        onSelect: () => openCreatePreset('loan'),
                    },
                    {
                        id: 'account',
                        title: 'Account',
                        description: 'Add a wallet, bank, card, or person.',
                        icon: Building2,
                        href: AccountController.create().url,
                    },
                    {
                        id: 'allocation',
                        title: 'Allocation',
                        description: 'Add an envelope, bill, or savings goal.',
                        icon: PiggyBank,
                        href: AllocationController.create().url,
                    },
                ]}
            />

            <Dialog
                open={detailTransaction !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setDetailTransaction(null);
                    }
                }}
            >
                <DialogContent className="max-h-[min(90vh,40rem)] overflow-y-auto">
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
                                <p className="border-l-2 border-primary/30 py-1 pl-3 text-sm text-muted-foreground">
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
                onBackToCreateChoice={() => {
                    setCreateOpen(false);
                    setCreateChoiceOpen(true);
                }}
            />

            <GuidedEntryForm
                open={purchaseOpen}
                onOpenChange={setPurchaseOpen}
                accounts={accounts}
                allocations={allocations}
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
