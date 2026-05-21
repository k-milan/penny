import AccountController from '@/actions/App/Http/Controllers/AccountController';
import PublicAccountShareController from '@/actions/App/Http/Controllers/PublicAccountShareController';
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
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { formatPhpMoney, formatTypeLabel } from '@/lib/format';
import { type DashboardTransactionRow } from '@/lib/transaction-row';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Check, Copy, Pencil, Share2 } from 'lucide-react';
import { useMemo, useState } from 'react';

type TransactionRow = DashboardTransactionRow;

type AccountShowProps = {
    account: {
        id: number;
        name: string;
        type: string;
        balance: string;
        share_token: string | null;
    };
    accounts: AccountOption[];
    allocations: AllocationOption[];
    unallocated_allocation_id: number | null;
};

export default function AccountShow({
    account,
    accounts: accountsProp,
    allocations: allocationsProp,
    unallocated_allocation_id,
}: AccountShowProps) {
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
    const [shareOpen, setShareOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const shareUrl =
        account.share_token !== null && account.share_token !== undefined
            ? window.location.origin +
              PublicAccountShareController.url({ token: account.share_token })
            : null;

    function handleCopyLink(): void {
        if (!shareUrl) {
            return;
        }
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(shareUrl).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            });
        } else {
            const el = document.createElement('textarea');
            el.value = shareUrl;
            el.style.position = 'fixed';
            el.style.opacity = '0';
            document.body.appendChild(el);
            el.focus();
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Accounts', href: AccountController.index().url },
        {
            title: account.name,
            href: AccountController.show({ account: account.id }).url,
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={account.name} />
            <div className="flex h-full min-h-0 flex-1 flex-col gap-4 p-4">
                <div className="flex flex-row items-start justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">
                            {formatTypeLabel(account.type)}
                        </p>
                        <h1 className="text-2xl font-semibold">{account.name}</h1>
                        <p className="mt-0.5 tabular-nums text-sm text-muted-foreground">
                            {formatPhpMoney(account.balance)}
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        {account.type === 'person' && shareUrl ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShareOpen(true)}
                            >
                                <Share2 className="size-4" />
                                Share
                            </Button>
                        ) : null}
                        <Button
                            asChild
                            variant="outline"
                            size="sm"
                        >
                            <Link
                                href={AccountController.edit({
                                    account: account.id,
                                })}
                            >
                                <Pencil className="size-4" />
                                Edit
                            </Link>
                        </Button>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-hidden pb-6">
                    <TransactionScrollList
                        dataKey="transactions"
                        accounts={accounts}
                        allocations={allocations}
                        emptyMessage="No transactions for this account yet."
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

            <Dialog open={shareOpen} onOpenChange={setShareOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Share link</DialogTitle>
                        <DialogDescription>
                            Anyone with this link can view{' '}
                            <strong>{account.name}</strong>'s balance and
                            transactions.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex items-center gap-2">
                        <Input
                            readOnly
                            value={shareUrl ?? ''}
                            className="font-mono text-xs"
                            onFocus={(e) => e.currentTarget.select()}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={handleCopyLink}
                            aria-label="Copy link"
                        >
                            {copied ? (
                                <Check className="size-4 text-green-600" />
                            ) : (
                                <Copy className="size-4" />
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

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
