import IncomeTemplateController from '@/actions/App/Http/Controllers/IncomeTemplateController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AppLayout from '@/layouts/app-layout';
import { formatPhpMoney } from '@/lib/format';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { CopyPlus, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { Fragment } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Incomes', href: IncomeTemplateController.index().url },
];

type IncomeTemplateVersionRow = {
    id: number;
    version: number;
    name: string;
    company_name: string | null;
    description: string | null;
    payout_frequency: string;
    payout_frequency_label: string;
    expected_income: string;
    accounts_count: number;
    allocations_count: number;
};

type IncomeTemplateSeriesGroup = {
    id: number;
    versions: IncomeTemplateVersionRow[];
};

function versionRowActions(row: IncomeTemplateVersionRow) {
    const newVersionHref = `${IncomeTemplateController.create.url()}?version_of=${row.id}`;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground shrink-0"
                    aria-label={`Actions for ${row.name} v${row.version}`}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                    onPointerDown={(e) => {
                        e.stopPropagation();
                    }}
                >
                    <MoreVertical className="size-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                    <Link
                        href={IncomeTemplateController.edit({
                            income_template: row.id,
                        }).url}
                    >
                        <Pencil className="size-4" />
                        Edit
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link href={newVersionHref}>
                        <CopyPlus className="size-4" />
                        New version from this
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                        if (
                            !confirm(
                                `Delete “${row.name}” (v${row.version})? This cannot be undone.`,
                            )
                        ) {
                            return;
                        }
                        router.delete(
                            IncomeTemplateController.destroy.url({
                                income_template: row.id,
                            }),
                        );
                    }}
                >
                    <Trash2 className="size-4" />
                    Delete
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default function IncomesIndex({
    incomeTemplateSeries,
}: {
    incomeTemplateSeries: IncomeTemplateSeriesGroup[];
}) {
    const totalTemplates = incomeTemplateSeries.reduce(
        (n, s) => n + s.versions.length,
        0,
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Incomes" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">Incomes</h1>
                        <p className="text-muted-foreground text-sm">
                            Expected pay and how you split it across accounts
                            and allocations. Each line is one saved version; new
                            versions stay grouped with the rest.
                        </p>
                    </div>
                    <Button asChild>
                        <Link href={IncomeTemplateController.create().url}>
                            <Plus className="size-4" />
                            New income template
                        </Link>
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Templates</CardTitle>
                        <CardDescription>
                            Payroll, freelancing, or other recurring income
                            patterns. Multiple versions of the same template
                            appear together.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {totalTemplates === 0 ? (
                            <p className="text-muted-foreground px-6 py-8 text-center text-sm">
                                No income templates yet. Create one to record
                                expected payouts and splits.
                            </p>
                        ) : (
                            <ul className="divide-y divide-border">
                                {incomeTemplateSeries.map((series) => (
                                    <Fragment key={series.id}>
                                        {series.versions.length > 1 ? (
                                            <li className="bg-muted/40 px-6 py-2">
                                                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                                                    Same template ·{' '}
                                                    {series.versions.length}{' '}
                                                    versions
                                                </p>
                                            </li>
                                        ) : null}
                                        {series.versions.map((row) => (
                                            <li key={row.id}>
                                                <div className="hover:bg-muted/50 flex items-start gap-1 px-6 py-4 transition-colors">
                                                    <Link
                                                        href={
                                                            IncomeTemplateController.edit(
                                                                {
                                                                    income_template:
                                                                        row.id,
                                                                },
                                                            ).url
                                                        }
                                                        className="focus-visible:ring-ring min-w-0 flex-1 text-left focus-visible:ring-2 focus-visible:outline-none"
                                                    >
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="font-medium">
                                                                {row.name}
                                                            </p>
                                                            <Badge
                                                                variant="secondary"
                                                                className="tabular-nums"
                                                            >
                                                                v
                                                                {row.version}
                                                            </Badge>
                                                        </div>
                                                        {row.company_name ? (
                                                            <p className="text-muted-foreground mt-0.5 text-sm">
                                                                {
                                                                    row.company_name
                                                                }
                                                            </p>
                                                        ) : null}
                                                        {row.description ? (
                                                            <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                                                                {
                                                                    row.description
                                                                }
                                                            </p>
                                                        ) : null}
                                                        <p className="text-muted-foreground mt-1.5 text-sm">
                                                            {
                                                                row.payout_frequency_label
                                                            }
                                                            {' · '}
                                                            <span className="text-foreground font-medium tabular-nums">
                                                                {formatPhpMoney(
                                                                    row.expected_income,
                                                                )}
                                                            </span>
                                                            {' · '}
                                                            {row.accounts_count}{' '}
                                                            account
                                                            {row.accounts_count ===
                                                            1
                                                                ? ''
                                                                : 's'}
                                                            {', '}
                                                            {
                                                                row.allocations_count
                                                            }{' '}
                                                            allocation
                                                            {row.allocations_count ===
                                                            1
                                                                ? ''
                                                                : 's'}
                                                        </p>
                                                    </Link>
                                                    {versionRowActions(row)}
                                                </div>
                                            </li>
                                        ))}
                                    </Fragment>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
