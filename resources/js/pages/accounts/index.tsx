import AccountController from '@/actions/App/Http/Controllers/AccountController';
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
import { Head, Link, router } from '@inertiajs/react';
import { formatPhpMoney, formatTypeLabel } from '@/lib/format';
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

export default function AccountsIndex({ accounts }: { accounts: AccountPaginator }) {
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
                        <p className="text-muted-foreground text-sm">
                            Wallets, banks, and other balances you track in Penny.
                        </p>
                    </div>
                    <Button asChild>
                        <Link href={AccountController.create()}>
                            <Plus className="size-4" />
                            New account
                        </Link>
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>All accounts</CardTitle>
                        <CardDescription>
                            Edit or remove an account. Balances change when you
                            record transactions.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {accounts.data.length === 0 ? (
                            <p className="text-muted-foreground px-6 py-8 text-center text-sm">
                                No accounts yet. Create one to get started.
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
                                            {group.items.map((row) => (
                                                <li key={row.id}>
                                                    <div className="hover:bg-muted/50 flex items-start gap-1 px-6 py-4 transition-colors">
                                                        <Link
                                                            href={AccountController.edit(
                                                                {
                                                                    account: row.id,
                                                                },
                                                            )}
                                                            className="focus-visible:ring-ring min-w-0 flex-1 text-left focus-visible:ring-2 focus-visible:outline-none"
                                                        >
                                                            <p className="font-medium">
                                                                {row.name}
                                                            </p>
                                                            <p className="text-muted-foreground text-sm">
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
                                                                        href={AccountController.edit(
                                                                            {
                                                                                account: row.id,
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
                                                                                    account: row.id,
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
                    </CardContent>
                </Card>

                {accounts.last_page > 1 && (
                    <div className="flex flex-wrap items-center justify-center gap-1">
                        {accounts.links.map((link, i) => {
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
