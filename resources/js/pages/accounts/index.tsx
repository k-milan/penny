import AccountController from '@/actions/App/Http/Controllers/AccountController';
import { Pagination } from '@/components/pagination';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AppLayout from '@/layouts/app-layout';
import { formatPhpMoney, formatTypeLabel } from '@/lib/format';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';

type AccountRow = {
    id: number;
    name: string;
    type: string;
    balance: string;
};

type LinkItem = { url: string | null; label: string; active: boolean };

type AccountPaginator = {
    data: AccountRow[];
    links: LinkItem[];
    current_page: number;
    last_page: number;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Accounts', href: AccountController.index().url },
];

const ACCOUNT_TYPE_ORDER = ['bank', 'cash', 'credit_card', 'person'] as const;

function groupAccountsByType(rows: AccountRow[]): {
    type: string;
    items: AccountRow[];
}[] {
    const byType = new Map<string, AccountRow[]>();
    for (const row of rows) {
        const list = byType.get(row.type) ?? [];
        list.push(row);
        byType.set(row.type, list);
    }
    const out: { type: string; items: AccountRow[] }[] = [];
    for (const t of ACCOUNT_TYPE_ORDER) {
        const items = byType.get(t);
        if (items?.length) {
            out.push({ type: t, items });
        }
    }
    const rest = [...byType.keys()]
        .filter((k) => !(ACCOUNT_TYPE_ORDER as readonly string[]).includes(k))
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

export default function AccountsIndex({
    accounts,
}: {
    accounts: AccountPaginator;
}) {
    const grouped = useMemo(
        () => groupAccountsByType(accounts.data),
        [accounts.data],
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Accounts" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">Accounts</h1>
                        <p className="text-sm text-muted-foreground">
                            Wallets, banks, and other balances you track in
                            Penny.
                        </p>
                    </div>
                    <Button asChild>
                        <Link href={AccountController.create()}>
                            <Plus className="size-4" />
                            New account
                        </Link>
                    </Button>
                </div>

                {accounts.data.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                        No accounts yet. Create one to get started.
                    </p>
                ) : (
                    <div className="divide-y divide-border overflow-hidden">
                        {grouped.map((group) => (
                            <section
                                key={group.type}
                                aria-label={formatTypeLabel(group.type)}
                            >
                                <div className="border-y border-primary/10 bg-primary/[0.06] px-3 py-2.5 text-xs font-semibold tracking-wide text-primary/80 dark:border-primary/20 dark:bg-primary/[0.1] dark:text-primary">
                                    {formatTypeLabel(group.type)}
                                </div>
                                <ul className="divide-y divide-border">
                                    {group.items.map((row) => (
                                        <li key={row.id}>
                                            <div className="flex items-start gap-1 px-3 py-4 transition-colors hover:bg-muted/50">
                                                <Link
                                                    href={AccountController.show(
                                                        {
                                                            account: row.id,
                                                        },
                                                    )}
                                                    className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                                >
                                                    <p className="min-w-0 truncate font-medium">
                                                        {row.name}
                                                    </p>
                                                    <p className="shrink-0 text-sm text-muted-foreground tabular-nums">
                                                        {formatPhpMoney(
                                                            row.balance,
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
                                                            className="shrink-0 text-muted-foreground"
                                                            aria-label={`Actions for ${row.name}`}
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
                                                                        account:
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
                                                                        'Delete this account? This is only allowed when it has no transaction lines.',
                                                                    )
                                                                ) {
                                                                    return;
                                                                }
                                                                router.delete(
                                                                    AccountController.destroy.url(
                                                                        {
                                                                            account:
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
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </div>
                )}

                {accounts.last_page > 1 && (
                    <Pagination links={accounts.links} />
                )}
            </div>
        </AppLayout>
    );
}
