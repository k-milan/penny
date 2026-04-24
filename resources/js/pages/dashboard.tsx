import TransactionController from '@/actions/App/Http/Controllers/TransactionController';
import {
    type AccountOption,
    type AllocationOption,
    type CreateDialogPreset,
    type TransactionFormModel,
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
    Pencil,
    PiggyBank,
    Receipt,
    Trash2,
} from 'lucide-react';
import { formatPhpMoney, formatTypeLabel } from '@/lib/format';
import { ensureTransactionRow } from '@/lib/transaction-row';
import { useMemo, useState } from 'react';

type TransactionRow = TransactionFormModel;

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
    recentTransactions: PaginatedTransactions;
};

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: dashboard().url,
    },
];

function summarizeTransaction(
    t: TransactionRow,
    accountOptions: { id: number; name: string }[],
    allocationOptions: { id: number; name: string }[],
): string {
    const accountNameById = new Map(
        accountOptions.map((a) => [a.id, a.name] as const),
    );
    const allocationNameById = new Map(
        allocationOptions.map((a) => [a.id, a.name] as const),
    );
    const accountLines = Array.isArray(t.accounts) ? t.accounts : [];
    const allocationLines = Array.isArray(t.allocations) ? t.allocations : [];
    const parts: string[] = [];
    for (const a of accountLines) {
        const acc = a.account;
        const nestedName =
            acc && typeof acc === 'object' && acc !== null && 'name' in acc
                ? String((acc as { name: string }).name)
                : null;
        const id = Number((a as { account_id?: unknown }).account_id);
        const name =
            nestedName ||
            (Number.isFinite(id) ? accountNameById.get(id) : undefined) ||
            (Number.isFinite(id) ? `Account #${id}` : 'Account');
        const amount =
            a.amount != null && String(a.amount) !== ''
                ? String(a.amount)
                : '—';
        parts.push(`${name} ${amount}`);
    }
    for (const al of allocationLines) {
        const all = al.allocation;
        const nestedName =
            all && typeof all === 'object' && all !== null && 'name' in all
                ? String((all as { name: string }).name)
                : null;
        const id = Number((al as { allocation_id?: unknown }).allocation_id);
        const name =
            nestedName ||
            (Number.isFinite(id) ? allocationNameById.get(id) : undefined) ||
            (Number.isFinite(id) ? `Allocation #${id}` : 'Allocation');
        const amount =
            al.amount != null && String(al.amount) !== ''
                ? String(al.amount)
                : '—';
        parts.push(`${name} ${amount}`);
    }
    return parts.length > 0 ? parts.join(' · ') : '—';
}

export default function Dashboard() {
    const {
        accounts: accountsProp,
        allocations: allocationsProp,
        unallocated,
        recentTransactions,
    } = usePage<DashboardProps>().props;
    const accounts = Array.isArray(accountsProp) ? accountsProp : [];
    const allocations = Array.isArray(allocationsProp) ? allocationsProp : [];
    const transactionRows: TransactionRow[] = Array.isArray(
        recentTransactions?.data,
    )
        ? recentTransactions.data.map((raw) => ensureTransactionRow(raw))
        : [];

    const [createOpen, setCreateOpen] = useState(false);
    const [createPreset, setCreatePreset] =
        useState<CreateDialogPreset>('default');
    const [radialOpen, setRadialOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editing, setEditing] = useState<TransactionRow | null>(null);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState<TransactionRow | null>(null);

    const nonUnallocatedAllocs = useMemo(
        () => allocations.filter((a) => !a.is_unallocated),
        [allocations],
    );
    const canCreateTransfer =
        accounts.length >= 2 || nonUnallocatedAllocs.length >= 2;
    const hasCreditCard = accounts.some((a) => a.type === 'credit_card');
    const hasPersonAccount = accounts.some((a) => a.type === 'person');
    const canCreateCreditCardTx =
        hasCreditCard &&
        (nonUnallocatedAllocs.length > 0 || hasPersonAccount);

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
                                    label: 'Credit card transaction',
                                    caption: 'Card',
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
                                    disabled:
                                        accounts.length === 0 &&
                                        allocations.length === 0,
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
                                <ul className="divide-y">
                                    {accounts.map((a) => (
                                        <li
                                            key={a.id}
                                            className="py-2 first:pt-0"
                                        >
                                            <p className="font-medium">
                                                {a.name}
                                            </p>
                                            <p className="text-muted-foreground text-xs">
                                                {formatTypeLabel(String(a.type))}{' '}
                                                · {formatPhpMoney(a.balance)}
                                            </p>
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
                                <ul className="divide-y">
                                    {allocations.map((a) => (
                                        <li
                                            key={a.id}
                                            className="py-2 first:pt-0"
                                        >
                                            <p className="font-medium">
                                                {a.name}
                                            </p>
                                            <p className="text-muted-foreground text-xs">
                                                {formatTypeLabel(String(a.type))}{' '}
                                                · {formatPhpMoney(a.balance)}
                                            </p>
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
                        {transactionRows.length === 0 ? (
                            <p className="text-muted-foreground text-sm">
                                {emptyMessage}
                            </p>
                        ) : (
                            <div className="max-h-[min(50vh,28rem)] overflow-y-auto rounded-md border">
                                <InfiniteScroll
                                    as="ul"
                                    className="divide-y"
                                    data="recentTransactions"
                                    onlyNext
                                >
                                    {({ loadingNext }) => (
                                        <>
                                            {transactionRows.map((t) => (
                                                <li
                                                    key={t.id}
                                                    className="flex flex-wrap items-start justify-between gap-2 px-3 py-3"
                                                >
                                                    <div className="min-w-0 space-y-1">
                                                        <p className="font-medium">
                                                            {t.description}
                                                        </p>
                                                        <p className="text-muted-foreground text-xs">
                                                            {t.date}
                                                        </p>
                                                        <p className="text-muted-foreground text-sm break-words">
                                                            {summarizeTransaction(
                                                                t,
                                                                accounts,
                                                                allocations,
                                                            )}
                                                        </p>
                                                    </div>
                                                    <div className="flex shrink-0 gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            type="button"
                                                            onClick={() => {
                                                                setEditing(
                                                                    t,
                                                                );
                                                                setEditOpen(
                                                                    true,
                                                                );
                                                            }}
                                                        >
                                                            <Pencil className="size-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            type="button"
                                                            className="text-destructive hover:text-destructive"
                                                            onClick={() => {
                                                                setDeleting(
                                                                    t,
                                                                );
                                                                setDeleteOpen(
                                                                    true,
                                                                );
                                                            }}
                                                        >
                                                            <Trash2 className="size-4" />
                                                        </Button>
                                                    </div>
                                                </li>
                                            ))}
                                            {loadingNext && (
                                                <li className="text-muted-foreground px-3 py-4 text-center text-sm">
                                                    Loading…
                                                </li>
                                            )}
                                        </>
                                    )}
                                </InfiniteScroll>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

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
