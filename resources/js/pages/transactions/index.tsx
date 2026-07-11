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
import {
    TransactionCreateResultDialog,
    type TransactionCreateKind,
} from '@/components/transaction-create-result-dialog';
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
import { type DashboardTransactionRow } from '@/lib/transaction-row';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import {
    ArrowLeftRight,
    CreditCard,
    Landmark,
    Plus,
    Receipt,
    ReceiptText,
    Wallet,
} from 'lucide-react';
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
    const [purchaseOpen, setPurchaseOpen] = useState(false);
    const [createChoiceOpen, setCreateChoiceOpen] = useState(false);
    const [createPreset, setCreatePreset] =
        useState<CreateDialogPreset>('default');
    const [initialCreditCardTab, setInitialCreditCardTab] = useState<
        'payment' | 'purchase'
    >('purchase');
    const [createResult, setCreateResult] = useState<{
        open: boolean;
        status: 'success' | 'failure';
        kind: TransactionCreateKind;
    }>({ open: false, status: 'success', kind: 'transaction' });
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

    const nonUnallocatedAllocs = useMemo(
        () => allocations.filter((a) => !a.is_unallocated),
        [allocations],
    );
    const canAddTransaction = accounts.length > 0 || allocations.length > 0;
    const canCreateTransfer =
        accounts.length >= 2 || nonUnallocatedAllocs.length >= 2;
    const hasCreditCard = accounts.some((a) => a.type === 'credit_card');
    const hasCardPaymentSource = accounts.some((a) => a.type !== 'credit_card');
    const canCreatePayment = hasCreditCard && hasCardPaymentSource;
    const hasPersonAccount = accounts.some((a) => a.type === 'person');
    const hasLoanFundingOrAlloc =
        accounts.some((a) => a.type !== 'person') ||
        nonUnallocatedAllocs.length > 0;
    const canCreateLoan = hasPersonAccount && hasLoanFundingOrAlloc;

    const openCreatePreset = (preset: CreateDialogPreset) => {
        setInitialCreditCardTab('purchase');
        setCreatePreset(preset);
        setCreateOpen(true);
    };

    const openCreateKind = (kind: TransactionCreateKind) => {
        setCreateResult((current) => ({ ...current, open: false }));
        setCreateChoiceOpen(false);
        if (kind === 'purchase') {
            setPurchaseOpen(true);
            return;
        }
        if (
            kind === 'credit_card_payment' ||
            kind === 'credit_card_purchase'
        ) {
            setInitialCreditCardTab(
                kind === 'credit_card_payment' ? 'payment' : 'purchase',
            );
            setCreatePreset('credit_card');
            setCreateOpen(true);
            return;
        }
        if (kind === 'transfer' || kind === 'loan') {
            setInitialCreditCardTab('purchase');
            setCreatePreset(kind);
            setCreateOpen(true);
            return;
        }
        setInitialCreditCardTab('purchase');
        setCreatePreset('default');
        setCreateOpen(true);
    };

    const showCreateResult = (
        status: 'success' | 'failure',
        kind: TransactionCreateKind,
    ) => {
        setCreateResult({ open: true, status, kind });
    };

    return (
        <AppLayout breadcrumbs={transactionsBreadcrumbs}>
            <Head title="Transactions" />
            <div className="flex h-full min-h-0 flex-1 flex-col gap-4 p-4">
                <div className="flex flex-row items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-semibold">Transactions</h1>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        className="shrink-0 gap-1.5"
                        disabled={!canAddTransaction}
                        onClick={() => setCreateChoiceOpen(true)}
                    >
                        <Plus className="size-4" aria-hidden />
                        New transaction
                    </Button>
                </div>

                <div className="min-h-0 flex-1 overflow-hidden pb-6">
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
                </div>
            </div>

            <CreateActionDialog
                open={createChoiceOpen}
                onOpenChange={setCreateChoiceOpen}
                title="What kind of transaction?"
                description="Choose how you want to record this activity."
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
                        disabled: !canCreatePayment,
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
                initialCreditCardTab={initialCreditCardTab}
                transaction={null}
                accounts={accounts}
                allocations={allocations}
                unallocatedAllocationId={unallocated_allocation_id}
                onCreateSuccess={(kind) => showCreateResult('success', kind)}
                onCreateFailure={(kind) => showCreateResult('failure', kind)}
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
                onCreateSuccess={(kind) => showCreateResult('success', kind)}
                onCreateFailure={(kind) => showCreateResult('failure', kind)}
            />

            <TransactionCreateResultDialog
                open={createResult.open}
                onOpenChange={(open) =>
                    setCreateResult((current) => ({ ...current, open }))
                }
                status={createResult.status}
                kind={createResult.kind}
                onCreateSame={() => openCreateKind(createResult.kind)}
                onCreateTransaction={() => {
                    setCreateResult((current) => ({
                        ...current,
                        open: false,
                    }));
                    setCreateChoiceOpen(true);
                }}
                onDone={() =>
                    setCreateResult((current) => ({ ...current, open: false }))
                }
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
