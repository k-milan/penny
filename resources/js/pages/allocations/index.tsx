import AllocationController from '@/actions/App/Http/Controllers/AllocationController';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { formatPhpMoney, formatTypeLabel } from '@/lib/format';
import { Head, Link, router } from '@inertiajs/react';
import { MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
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

type LinkItem = { url: string | null; label: string; active: boolean };

type AllocationPaginator = {
    data: AllocationRow[];
    links: LinkItem[];
    current_page: number;
    last_page: number;
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
    if (
        !Number.isFinite(current) ||
        !Number.isFinite(goal) ||
        goal <= 0
    ) {
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
        .filter((k) => !(ALLOCATION_TYPE_ORDER as readonly string[]).includes(k))
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
    allocations: AllocationPaginator;
    defaultUnallocated: DefaultUnallocated | null;
}) {
    const grouped = useMemo(
        () => groupAllocationsByType(allocations.data),
        [allocations.data],
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Allocations" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">Allocations</h1>
                        <p className="text-muted-foreground text-sm">
                            Envelopes, bills, and savings you assign money to.
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
                        <div className="text-muted-foreground flex w-full items-baseline justify-between gap-2 border-b border-dashed border-border pb-2.5 text-sm">
                            <span className="min-w-0">
                                {defaultUnallocated.name}{' '}
                                <Link
                                    className="text-primary text-xs font-normal underline"
                                    href={AllocationController.edit({
                                        allocation: defaultUnallocated.id,
                                    })}
                                >
                                    (default)
                                </Link>
                            </span>
                            <span className="text-foreground font-medium tabular-nums">
                                {formatPhpMoney(defaultUnallocated.balance)}
                            </span>
                        </div>
                    )}

                <Card>
                    <CardHeader>
                        <CardTitle>All allocations</CardTitle>
                        <CardDescription>
                            Edit or remove. Balances change when you record
                            transactions.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {allocations.data.length === 0 ? (
                            <p className="text-muted-foreground px-6 py-8 text-center text-sm">
                                No allocations yet. Create one to get started.
                            </p>
                        ) : (
                            <div className="divide-y divide-border">
                                {grouped.map((group) => (
                                    <section
                                        key={group.type}
                                        aria-label={formatTypeLabel(group.type)}
                                    >
                                        <div className="bg-muted/50 px-6 py-2.5 text-xs font-semibold tracking-wide text-muted-foreground">
                                            {formatTypeLabel(group.type)}
                                        </div>
                                        <ul className="divide-y divide-border">
                                            {group.items.map((row) => {
                                                const isSavings =
                                                    row.type === TYPE_SAVINGS;
                                                const hasSavingsGoal =
                                                    isSavings &&
                                                    savingsHasGoal(
                                                        row.goal_amount,
                                                    );
                                                const savingsPct =
                                                    isSavings
                                                        ? savingsProgressPercent(
                                                              row.balance,
                                                              row.goal_amount,
                                                          )
                                                        : 0;
                                                return (
                                                    <li key={row.id}>
                                                        <div className="hover:bg-muted/50 flex items-start gap-1 px-6 py-4 transition-colors">
                                                            <Link
                                                                href={AllocationController.edit(
                                                                    {
                                                                        allocation:
                                                                            row.id,
                                                                    },
                                                                )}
                                                                className="focus-visible:ring-ring min-w-0 flex-1 text-left focus-visible:ring-2 focus-visible:outline-none"
                                                            >
                                                                <p className="font-medium">
                                                                    {row.name}
                                                                </p>
                                                                {isSavings ? (
                                                                    <>
                                                                        <p className="mt-0.5 text-sm">
                                                                            <span className="text-foreground font-medium tabular-nums">
                                                                                {formatPhpMoney(
                                                                                    row.balance,
                                                                                )}
                                                                            </span>
                                                                            <span className="text-muted-foreground">
                                                                                {' '}
                                                                                /{' '}
                                                                            </span>
                                                                            <span className="text-muted-foreground tabular-nums">
                                                                                {hasSavingsGoal &&
                                                                                row.goal_amount
                                                                                    ? formatPhpMoney(
                                                                                          row.goal_amount,
                                                                                      )
                                                                                    : '—'}
                                                                            </span>
                                                                        </p>
                                                                        <div
                                                                            className="bg-muted mt-2 h-2 w-full max-w-md overflow-hidden rounded-full"
                                                                            role="progressbar"
                                                                            aria-valuenow={
                                                                                hasSavingsGoal
                                                                                    ? Math.round(
                                                                                          savingsPct,
                                                                                      )
                                                                                    : 0
                                                                            }
                                                                            aria-valuemin={0}
                                                                            aria-valuemax={100}
                                                                            aria-label={
                                                                                hasSavingsGoal
                                                                                    ? `Savings progress for ${row.name}`
                                                                                    : `No savings goal set for ${row.name}`
                                                                            }
                                                                        >
                                                                            <div
                                                                                className="bg-primary h-full rounded-full transition-[width]"
                                                                                style={{
                                                                                    width: `${savingsPct}%`,
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <p className="text-muted-foreground mt-0.5 text-sm">
                                                                        {[
                                                                            row.due_date
                                                                                ? `Due ${row.due_date}`
                                                                                : null,
                                                                            formatTypeLabel(
                                                                                String(
                                                                                    row.type,
                                                                                ),
                                                                            ),
                                                                            formatPhpMoney(
                                                                                row.balance,
                                                                            ),
                                                                        ]
                                                                            .filter(
                                                                                (
                                                                                    s,
                                                                                ): s is string =>
                                                                                    Boolean(
                                                                                        s,
                                                                                    ),
                                                                            )
                                                                            .join(
                                                                                ' · ',
                                                                            )}
                                                                    </p>
                                                                )}
                                                            </Link>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger
                                                                    asChild
                                                                >
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="text-muted-foreground shrink-0"
                                                                        aria-label={`Actions for ${row.name}`}
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
                                                                                            row.id,
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
                                                );
                                            })}
                                        </ul>
                                    </section>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {allocations.last_page > 1 && (
                    <div className="flex flex-wrap items-center justify-center gap-1">
                        {allocations.links.map((link, i) => {
                            if (link.url === null) {
                                return (
                                    <span
                                        key={i}
                                        className="text-muted-foreground flex size-9 items-center justify-center text-sm"
                                    >
                                        <span
                                            dangerouslySetInnerHTML={{
                                                __html: link.label,
                                            }}
                                        />
                                    </span>
                                );
                            }
                            return (
                                <Button
                                    key={i}
                                    asChild
                                    size="icon"
                                    variant={link.active ? 'default' : 'outline'}
                                >
                                    <Link href={link.url} preserveState>
                                        <span
                                            dangerouslySetInnerHTML={{
                                                __html: link.label,
                                            }}
                                        />
                                    </Link>
                                </Button>
                            );
                        })}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
