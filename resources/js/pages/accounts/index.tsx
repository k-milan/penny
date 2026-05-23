import AccountController from '@/actions/App/Http/Controllers/AccountController';
import PublicAccountShareController from '@/actions/App/Http/Controllers/PublicAccountShareController';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { formatPhpMoney, formatTypeLabel } from '@/lib/format';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Pencil, Plus, Share2, Trash2 } from 'lucide-react';
import { useMemo } from 'react';

type AccountRow = {
    id: number;
    name: string;
    type: string;
    balance: string;
    share_token: string | null;
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
    accounts: AccountRow[];
}) {
    const grouped = useMemo(
        () => groupAccountsByType(accounts),
        [accounts],
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Accounts" />
            <TooltipProvider>
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

                    {accounts.length === 0 ? (
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
                                    <div className="border-y border-primary/10 bg-primary/[0.06] px-3 py-2 text-xs font-semibold tracking-wide text-primary/80 dark:border-primary/20 dark:bg-primary/[0.1] dark:text-primary">
                                        {formatTypeLabel(group.type)}
                                    </div>
                                    <ul className="divide-y divide-border">
                                        {group.items.map((row) => (
                                            <li key={row.id}>
                                                <div className="flex items-center gap-1 px-3 py-2 transition-colors hover:bg-muted/50">
                                                    <Link
                                                        href={AccountController.show(
                                                            { account: row.id },
                                                        )}
                                                        className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                                    >
                                                        <p className="min-w-0 truncate text-sm font-medium">
                                                            {row.name}
                                                        </p>
                                                        <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
                                                            {formatPhpMoney(
                                                                row.balance,
                                                            )}
                                                        </p>
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
                                                                Create transaction with this account, TBD
                                                            </TooltipContent>
                                                        </Tooltip>

                                                        {row.type === 'person' &&
                                                        row.share_token ? (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="size-8 text-muted-foreground"
                                                                aria-label={`Share ${row.name}`}
                                                                onClick={() => {
                                                                    const url =
                                                                        window
                                                                            .location
                                                                            .origin +
                                                                        PublicAccountShareController.url(
                                                                            {
                                                                                token: row.share_token!,
                                                                            },
                                                                        );
                                                                    if (
                                                                        navigator
                                                                            .clipboard
                                                                            ?.writeText
                                                                    ) {
                                                                        navigator.clipboard.writeText(
                                                                            url,
                                                                        );
                                                                    } else {
                                                                        const el =
                                                                            document.createElement(
                                                                                'textarea',
                                                                            );
                                                                        el.value =
                                                                            url;
                                                                        el.style.position =
                                                                            'fixed';
                                                                        el.style.opacity =
                                                                            '0';
                                                                        document.body.appendChild(
                                                                            el,
                                                                        );
                                                                        el.focus();
                                                                        el.select();
                                                                        document.execCommand(
                                                                            'copy',
                                                                        );
                                                                        document.body.removeChild(
                                                                            el,
                                                                        );
                                                                    }
                                                                }}
                                                            >
                                                                <Share2 className="size-3.5" />
                                                            </Button>
                                                        ) : null}

                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="size-8 text-muted-foreground"
                                                            aria-label={`Edit ${row.name}`}
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
                                                            <Trash2 className="size-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
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
