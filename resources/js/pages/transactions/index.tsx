import TransactionController from '@/actions/App/Http/Controllers/TransactionController';
import {
    TransactionFormDialog,
    type AccountOption,
    type AllocationOption,
    type CreateDialogPreset,
} from '@/components/transaction-form-dialog';
import {
    formatTransactionGroupDate,
    formatTransactionTime,
    TransactionBreakdown,
} from '@/components/transaction-display';
import { TransactionScrollList } from '@/components/transaction-scroll-list';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { type DashboardTransactionRow } from '@/lib/transaction-row';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

type TransactionRow = DashboardTransactionRow;

type TransactionsPageProps = {
    accounts: AccountOption[];
    allocations: AllocationOption[];
    unallocated_allocation_id: number | null;
};

const transactionsBreadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: dashboard().url },
    { title: 'Transactions', href: TransactionController.index().url },
];

export default function TransactionsIndex({
    accounts: accountsProp,
    allocations: allocationsProp,
    unallocated_allocation_id,
}: TransactionsPageProps) {
    const accounts = useMemo(
        () => (Array.isArray(accountsProp) ? accountsProp : []),
        [accountsProp],
    );
    const allocations = useMemo(
        () => (Array.isArray(allocationsProp) ? allocationsProp : []),
        [allocationsProp],
    );

    const [createOpen, setCreateOpen] = useState(false);
    const [createPreset, setCreatePreset] =
        useState<CreateDialogPreset>('default');
    const [editOpen, setEditOpen] = useState(false);
    const [editing, setEditing] = useState<TransactionRow | null>(null);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState<TransactionRow | null>(null);
    const [detailTransaction, setDetailTransaction] =
        useState<TransactionRow | null>(null);

    const emptyMessage = useMemo(() => {
        if (accounts.length === 0 && allocations.length === 0) {
            return 'Create an account or allocation first.';
        }
        return 'No transactions yet. Add one to get started.';
    }, [accounts.length, allocations.length]);

    const canAddTransaction =
        accounts.length > 0 || allocations.length > 0;

    return (
        <AppLayout breadcrumbs={transactionsBreadcrumbs}>
            <Head title="Transactions" />
            <div className="flex h-full min-h-0 flex-1 flex-col gap-4 p-4">
                <div className="flex flex-row items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-semibold">
                            Transactions
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Full history · scroll down to load more
                        </p>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        className="shrink-0 gap-1.5"
                        disabled={!canAddTransaction}
                        onClick={() => {
                            setCreatePreset('default');
                            setCreateOpen(true);
                        }}
                    >
                        <Plus className="size-4" aria-hidden />
                        New transaction
                    </Button>
                </div>

                <Card className="flex min-h-0 flex-1 flex-col overflow-hidden shadow-sm">
                    <CardHeader className="shrink-0 space-y-1 pb-2">
                        <CardTitle className="text-lg">All transactions</CardTitle>
                        <CardDescription>
                            Newest first. Additional pages load as you scroll.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="min-h-0 flex-1 overflow-hidden pb-6">
                        <TransactionScrollList
                            dataKey="transactions"
                            accounts={accounts}
                            allocations={allocations}
                            emptyMessage={emptyMessage}
                            scrollClassName="h-[min(65vh,calc(100dvh-13rem))] min-h-[18rem] overflow-y-auto rounded-md border"
                            onSelectDetail={setDetailTransaction}
                            onEdit={setEditing}
                            setEditOpen={setEditOpen}
                            onDelete={setDeleting}
                            setDeleteOpen={setDeleteOpen}
                        />
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
                unallocatedAllocationId={unallocated_allocation_id}
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
