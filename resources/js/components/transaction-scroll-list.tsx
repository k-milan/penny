import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    formatTransactionGroupDate,
    formatTransactionTime,
    TransactionListInlineSummary,
} from '@/components/transaction-display';
import {
    type AccountOption,
    type AllocationOption,
} from '@/components/transaction-form-dialog';
import {
    ensureTransactionRow,
    type DashboardTransactionRow,
} from '@/lib/transaction-row';
import { InfiniteScroll, usePage } from '@inertiajs/react';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useMemo } from 'react';

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

export type TransactionScrollDataKey = 'recentTransactions' | 'transactions';

type PageWithScroll = {
    recentTransactions?: PaginatedTransactions;
    transactions?: PaginatedTransactions;
};

export function TransactionScrollList({
    dataKey,
    accounts,
    allocations,
    emptyMessage,
    scrollClassName,
    onSelectDetail,
    onEdit,
    setEditOpen,
    onDelete,
    setDeleteOpen,
}: {
    dataKey: TransactionScrollDataKey;
    accounts: AccountOption[];
    allocations: AllocationOption[];
    emptyMessage: string;
    /** Outer scroll container; default matches dashboard recent list */
    scrollClassName?: string;
    onSelectDetail: (t: TransactionRow | null) => void;
    onEdit: (t: TransactionRow | null) => void;
    setEditOpen: (open: boolean) => void;
    onDelete: (t: TransactionRow | null) => void;
    setDeleteOpen: (open: boolean) => void;
}) {
    const paginated = usePage<PageWithScroll>().props[dataKey];

    const transactionRows: TransactionRow[] = useMemo(
        () =>
            Array.isArray(paginated?.data)
                ? paginated.data.map((raw) => ensureTransactionRow(raw))
                : [],
        [paginated?.data],
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

    if (sortedTransactionRows.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        );
    }

    return (
        <div
            className={
                scrollClassName ??
                'max-h-[min(50vh,28rem)] overflow-y-auto rounded-md border'
            }
        >
            <InfiniteScroll
                as="div"
                className="divide-y divide-border"
                data={dataKey}
                onlyNext
            >
                {({ loadingNext }) => (
                    <>
                        {transactionGroups.map((group) => (
                            <div key={group.date}>
                                <div className="bg-muted/50 px-3 py-1.5">
                                    <p className="text-xs font-semibold text-muted-foreground">
                                        {formatTransactionGroupDate(
                                            group.date,
                                        )}
                                    </p>
                                </div>
                                <ul className="divide-y divide-border">
                                    {group.items.map((t) => {
                                        const timeLabel = formatTransactionTime(
                                            t.created_at,
                                        );
                                        return (
                                            <li key={t.id}>
                                                <div className="flex items-start gap-1 px-3 py-2.5 transition-colors hover:bg-muted/50">
                                                    <button
                                                        type="button"
                                                        className="min-w-0 flex-1 cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                                        aria-label={`View details: ${t.description}${timeLabel ? `, ${timeLabel}` : ''}`}
                                                        onClick={() =>
                                                            onSelectDetail(t)
                                                        }
                                                    >
                                                        <div className="space-y-1.5">
                                                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                                                <span className="text-sm font-medium">
                                                                    {
                                                                        t.description
                                                                    }
                                                                </span>
                                                                {timeLabel ? (
                                                                    <span className="text-xs tabular-nums text-muted-foreground">
                                                                        {
                                                                            timeLabel
                                                                        }
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                            <TransactionListInlineSummary
                                                                compact
                                                                t={t}
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
                                                                className="size-8 shrink-0 text-muted-foreground"
                                                                aria-label="Transaction actions"
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
                                                                onClick={() => {
                                                                    onSelectDetail(
                                                                        null,
                                                                    );
                                                                    onEdit(t);
                                                                    setEditOpen(
                                                                        true,
                                                                    );
                                                                }}
                                                            >
                                                                <Pencil className="size-3.5" />
                                                                Edit
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                variant="destructive"
                                                                onClick={() => {
                                                                    onSelectDetail(
                                                                        null,
                                                                    );
                                                                    onDelete(t);
                                                                    setDeleteOpen(
                                                                        true,
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
                                        );
                                    })}
                                </ul>
                            </div>
                        ))}
                        {loadingNext ? (
                            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                                Loading…
                            </div>
                        ) : null}
                    </>
                )}
            </InfiniteScroll>
        </div>
    );
}
