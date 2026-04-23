import AllocationController from '@/actions/App/Http/Controllers/AllocationController';
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
import { Pencil, Plus, Trash2 } from 'lucide-react';

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

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Allocations', href: AllocationController.index().url },
];

function formatType(t: string): string {
    return t.replaceAll('_', ' ');
}

export default function AllocationsIndex({
    allocations,
}: {
    allocations: AllocationPaginator;
}) {
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

                <Card>
                    <CardHeader>
                        <CardTitle>All allocations</CardTitle>
                        <CardDescription>
                            Edit or remove. Balances change when you record
                            transactions.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ul className="divide-y">
                            {allocations.data.length === 0 && (
                                <li className="text-muted-foreground px-6 py-8 text-center text-sm">
                                    No allocations yet. Create one to get
                                    started.
                                </li>
                            )}
                            {allocations.data.map((row) => (
                                <li
                                    key={row.id}
                                    className="hover:bg-muted/50 flex flex-wrap items-center justify-between gap-3 px-6 py-4"
                                >
                                    <div>
                                        <p className="font-medium">{row.name}</p>
                                        <p className="text-muted-foreground text-sm">
                                            {formatType(row.type)}
                                            {row.due_date
                                                ? ` · due ${row.due_date}`
                                                : ''}
                                            {row.goal_amount
                                                ? ` · goal ${row.goal_amount}`
                                                : ''}
                                            {' · balance '}
                                            {row.balance}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="icon" asChild>
                                            <Link
                                                href={AllocationController.edit({
                                                    allocation: row.id,
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
                                                        'Delete this allocation? This is only allowed when it has no transaction lines.',
                                                    )
                                                ) {
                                                    return;
                                                }
                                                router.delete(
                                                    AllocationController.destroy.url(
                                                        {
                                                            allocation: row.id,
                                                        },
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
