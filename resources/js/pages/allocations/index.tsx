import AllocationController from '@/actions/App/Http/Controllers/AllocationController';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { formatDateYmd, formatPhpMoney, formatTypeLabel } from '@/lib/format';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';

type DefaultUnallocated = {
    id: number;
    name: string;
    type: string;
    due_date: string | null;
    goal_amount: string | null;
    balance: string;
    is_unallocated: boolean;
};

type AllocationRow = {
    id: number;
    name: string;
    type: string;
    due_date: string | null;
    goal_amount: string | null;
    balance: string;
};

const TYPE_SAVINGS = 'savings';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Allocations', href: AllocationController.index().url },
];

const ALLOCATION_TYPE_ORDER = [
    'normal',
    'bill',
    'savings',
    'unallocated',
] as const;

function showUnallocatedRow(balance: string): boolean {
    const n = Number.parseFloat(balance);
    return Number.isFinite(n) && n !== 0;
}

function savingsProgressPercent(
    balance: string,
    goalAmount: string | null,
): number {
    const current = Number.parseFloat(balance);
    const goal =
        goalAmount != null && String(goalAmount).trim() !== ''
            ? Number.parseFloat(String(goalAmount))
            : NaN;
    if (!Number.isFinite(current) || !Number.isFinite(goal) || goal <= 0) {
        return 0;
    }
    return Math.min(100, Math.max(0, (current / goal) * 100));
}

function savingsHasGoal(goalAmount: string | null): boolean {
    if (goalAmount == null || String(goalAmount).trim() === '') {
        return false;
    }
    const goal = Number.parseFloat(String(goalAmount));
    return Number.isFinite(goal) && goal > 0;
}

function groupAllocationsByType(rows: AllocationRow[]): {
    type: string;
    items: AllocationRow[];
}[] {
    const byType = new Map<string, AllocationRow[]>();
    for (const row of rows) {
        const list = byType.get(row.type) ?? [];
        list.push(row);
        byType.set(row.type, list);
    }
    const out: { type: string; items: AllocationRow[] }[] = [];
    for (const t of ALLOCATION_TYPE_ORDER) {
        const items = byType.get(t);
        if (items?.length) {
            out.push({ type: t, items });
        }
    }
    const rest = [...byType.keys()]
        .filter(
            (k) => !(ALLOCATION_TYPE_ORDER as readonly string[]).includes(k),
        )
        .sort();
    for (const t of rest) {
        const items = byType.get(t);
        if (items?.length) {
            out.push({ type: t, items });
        }
    }
    return out.map((g) => ({
        ...g,
        items: [...g.items].sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

export default function AllocationsIndex({
    allocations,
    defaultUnallocated,
}: {
    allocations: AllocationRow[];
    defaultUnallocated: DefaultUnallocated | null;
}) {
    const grouped = useMemo(
        () => groupAllocationsByType(allocations),
        [allocations],
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Allocations" />
            <TooltipProvider>
                <div className="flex h-full flex-1 flex-col gap-4 p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold">
                                Allocations
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Envelopes, bills, and savings you assign money
                                to.
                            </p>
                        </div>
                        <Button asChild>
                            <Link href={AllocationController.create()}>
                                <Plus className="size-4" />
                                New allocation
                            </Link>
                        </Button>
                    </div>

                    {defaultUnallocated &&
                        showUnallocatedRow(defaultUnallocated.balance) && (
                            <div className="flex w-full items-baseline justify-between gap-2 border-b border-dashed border-border pb-2.5 text-sm text-muted-foreground">
                                <span className="min-w-0">
                                    {defaultUnallocated.name}{' '}
                                    <Link
                                        className="text-xs font-normal text-primary underline"
                                        href={AllocationController.show({
                                            allocation: defaultUnallocated.id,
                                        })}
                                    >
                                        (default)
                                    </Link>
                                </span>
                                <span className="font-medium text-foreground tabular-nums">
                                    {formatPhpMoney(defaultUnallocated.balance)}
                                </span>
                            </div>
                        )}

                    {allocations.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                            No allocations yet. Create one to get started.
                        </p>
                    ) : (
                        <div className="divide-y divide-border overflow-hidden">
                            {grouped.map((group) => (
                                <section
                                    key={group.type}
                                    aria-label={formatTypeLabel(group.type)}
                                >
                                    <div className="border-y border-primary/10 bg-primary/[0.06] px-3 py-2 text-xs font-semibold tracking-wide text-primary/80 dark:border-primary/20 dark:bg-primary/[0.1] dark:text-primary">
                                        {formatTypeLabel(group.type)}
                                    </div>
                                    <ul className="divide-y divide-border">
                                        {group.items.map((row) => {
                                            const isSavings =
                                                row.type === TYPE_SAVINGS;
                                            const hasSavingsGoal =
                                                isSavings &&
                                                savingsHasGoal(row.goal_amount);
                                            const savingsPct = isSavings
                                                ? savingsProgressPercent(
                                                      row.balance,
                                                      row.goal_amount,
                                                  )
                                                : 0;
                                            return (
                                                <li key={row.id}>
                                                    <div className="px-3 py-2 transition-colors hover:bg-muted/50">
                                                        <div className="flex items-center gap-1">
                                                        <Link
                                                            href={AllocationController.show(
                                                                {
                                                                    allocation:
                                                                        row.id,
                                                                },
                                                            )}
                                                            className="min-w-0 flex-1 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                                        >
                                                            <div className="flex items-center justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <p className="truncate text-sm font-medium">
                                                                        {
                                                                            row.name
                                                                        }
                                                                    </p>
                                                                    {!isSavings &&
                                                                    row.due_date ? (
                                                                        <p className="text-xs text-muted-foreground">
                                                                            Due{' '}
                                                                            {formatDateYmd(
                                                                                row.due_date,
                                                                            )}
                                                                        </p>
                                                                    ) : null}
                                                                </div>
                                                                <div className="shrink-0 text-right text-sm tabular-nums">
                                                                    {isSavings ? (
                                                                        <p>
                                                                            <span className="font-medium text-foreground">
                                                                                {formatPhpMoney(
                                                                                    row.balance,
                                                                                )}
                                                                            </span>
                                                                            <span className="text-muted-foreground">
                                                                                {' '}
                                                                                /{' '}
                                                                            </span>
                                                                            <span className="text-muted-foreground">
                                                                                {hasSavingsGoal &&
                                                                                row.goal_amount
                                                                                    ? formatPhpMoney(
                                                                                          row.goal_amount,
                                                                                      )
                                                                                    : '—'}
                                                                            </span>
                                                                        </p>
                                                                    ) : (
                                                                        <p className="text-muted-foreground">
                                                                            {formatPhpMoney(
                                                                                row.balance,
                                                                            )}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </Link>

                                                        <div className="flex shrink-0 items-center">
                                                            <Tooltip>
                                                                <TooltipTrigger
                                                                    asChild
                                                                >
                                                                    <span>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="size-8 text-muted-foreground"
                                                                            disabled
                                                                            aria-label="Create transaction"
                                                                        >
                                                                            <Plus className="size-3.5" />
                                                                        </Button>
                                                                    </span>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    Create transaction with this allocation, TBD
                                                                </TooltipContent>
                                                            </Tooltip>

                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="size-8 text-muted-foreground"
                                                                aria-label={`Edit ${row.name}`}
                                                                asChild
                                                            >
                                                                <Link
                                                                    href={AllocationController.edit(
                                                                        {
                                                                            allocation:
                                                                                row.id,
                                                                        },
                                                                    )}
                                                                >
                                                                    <Pencil className="size-3.5" />
                                                                </Link>
                                                            </Button>

                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="size-8 text-muted-foreground hover:text-destructive"
                                                                aria-label={`Delete ${row.name}`}
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
                                                                                    row.id,
                                                                            },
                                                                        ),
                                                                    );
                                                                }}
                                                            >
                                                                <Trash2 className="size-3.5" />
                                                            </Button>
                                                        </div>
                                                        </div>{/* end top row */}
                                                        {isSavings ? (
                                                            <div
                                                                className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                                                                role="progressbar"
                                                                aria-valuenow={hasSavingsGoal ? Math.round(savingsPct) : 0}
                                                                aria-valuemin={0}
                                                                aria-valuemax={100}
                                                                aria-label={hasSavingsGoal ? `Savings progress for ${row.name}` : `No savings goal set for ${row.name}`}
                                                            >
                                                                <div
                                                                    className="h-full rounded-full bg-primary transition-[width]"
                                                                    style={{ width: `${savingsPct}%` }}
                                                                />
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </section>
                            ))}
                        </div>
                    )}
                </div>
            </TooltipProvider>
        </AppLayout>
    );
}
