import AccountController from '@/actions/App/Http/Controllers/AccountController';
import { Button } from '@/components/ui/button';
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
import { Pencil, Plus, Trash2 } from 'lucide-react';

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

export default function AccountsIndex({ accounts }: { accounts: AccountPaginator }) {
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
                        <ul className="divide-y">
                            {accounts.data.length === 0 && (
                                <li className="text-muted-foreground px-6 py-8 text-center text-sm">
                                    No accounts yet. Create one to get started.
                                </li>
                            )}
                            {accounts.data.map((row) => (
                                <li
                                    key={row.id}
                                    className="hover:bg-muted/50 flex flex-wrap items-center justify-between gap-3 px-6 py-4"
                                >
                                    <div>
                                        <p className="font-medium">{row.name}</p>
                                        <p className="text-muted-foreground text-sm">
                                            {formatTypeLabel(row.type)} ·{' '}
                                            {formatPhpMoney(row.balance)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="icon" asChild>
                                            <Link
                                                href={AccountController.edit({
                                                    account: row.id,
                                                })}
                                            >
                                                <Pencil className="size-4" />
                                            </Link>
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:text-destructive"
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
                                                        { account: row.id },
                                                    ),
                                                );
                                            }}
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
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
