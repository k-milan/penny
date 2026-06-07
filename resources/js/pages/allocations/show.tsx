import AllocationController from '@/actions/App/Http/Controllers/AllocationController';
import TransactionController from '@/actions/App/Http/Controllers/TransactionController';
import {
    formatTransactionGroupDate,
    formatTransactionTime,
    TransactionBreakdown,
} from '@/components/transaction-display';
import {
    TransactionFormDialog,
    type AccountOption,
    type AllocationOption,
} from '@/components/transaction-form-dialog';
import { TransactionScrollList } from '@/components/transaction-scroll-list';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { formatPhpMoney, formatTypeLabel } from '@/lib/format';
import { type DashboardTransactionRow } from '@/lib/transaction-row';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';

type TransactionRow = DashboardTransactionRow;

type AllocationShowProps = {
    allocation: {
        id: number;
        name: string;
        type: string;
        balance: string;
        is_unallocated: boolean;
    };
    accounts: AccountOption[];
    allocations: AllocationOption[];
    unallocated_allocation_id: number | null;
};

export default function AllocationShow({
    allocation,
    accounts: accountsProp,
    allocations: allocationsProp,
    unallocated_allocation_id,
}: AllocationShowProps) {
    const accounts = useMemo(
        () => (Array.isArray(accountsProp) ? accountsProp : []),
        [accountsProp],
    );
    const allocations = useMemo(
        () => (Array.isArray(allocationsProp) ? allocationsProp : []),
        [allocationsProp],
    );

    const [editOpen, setEditOpen] = useState(false);
    const [editing, setEditing] = useState<TransactionRow | null>(null);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState<TransactionRow | null>(null);
    const [detailTransaction, setDetailTransaction] =
        useState<TransactionRow | null>(null);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Allocations', href: AllocationController.index().url },
        {
            title: allocation.name,
            href: AllocationController.show({ allocation: allocation.id }).url,
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={allocation.name} />
            <div className="flex h-full min-h-0 flex-1 flex-col gap-4 p-4">
                <div className="flex flex-row items-start justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">
                            {allocation.is_unallocated
                                ? 'Default allocation'
                                : formatTypeLabel(allocation.type)}
                        </p>
                        <h1 className="text-2xl font-semibold">
                            {allocation.name}
                        </h1>
                        <p className="mt-0.5 tabular-nums text-sm text-muted-foreground">
                            {formatPhpMoney(allocation.balance)}
                        </p>
                    </div>
                    <Button asChild variant="outline" size="sm" className="shrink-0">
                        <Link
                            href={AllocationController.edit({
                                allocation: allocation.id,
                            })}
                        >
                            <Pencil className="size-4" />
                            Edit
                        </Link>
                    </Button>
                </div>

                <div className="min-h-0 flex-1 overflow-hidden pb-6">
                    <TransactionScrollList
                        dataKey="transactions"
                        accounts={accounts}
                        allocations={allocations}
                        emptyMessage="No transactions for this allocation yet."
                        scrollClassName="h-[min(65vh,calc(100dvh-13rem))] min-h-[18rem] overflow-y-auto rounded-md border"
                        onSelectDetail={setDetailTransaction}
                        onEdit={setEditing}
                        setEditOpen={setEditOpen}
                        onDelete={setDeleting}
                        setDeleteOpen={setDeleteOpen}
                    />
                </div>
            </div>

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
                                ? `Remove "${deleting.description}" (${deleting.date})? This cannot be undone.`
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
