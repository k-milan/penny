import IncomeTemplateController from '@/actions/App/Http/Controllers/IncomeTemplateController';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { IncomeTemplateFormFields } from '@/pages/incomes/income-template-form';
import { type BreadcrumbItem } from '@/types';
import { Link, router } from '@inertiajs/react';
import { CopyPlus } from 'lucide-react';

export default function IncomesEdit({
    incomeTemplate,
    seriesVersions,
    accounts,
    allocations,
    payoutFrequencies,
    unallocated_allocation_id: unallocatedAllocationId,
}: {
    incomeTemplate: {
        id: number;
        series_id: number;
        version: number;
        name: string;
        description: string;
        company_name: string;
        payout_frequency: string;
        expected_income: string;
        accounts: { account_id: number; amount: string }[];
        allocations: { allocation_id: number; amount: string }[];
    };
    seriesVersions: { id: number; version: number; name: string }[];
    accounts: { id: number; name: string }[];
    allocations: { id: number; name: string }[];
    payoutFrequencies: { value: string; label: string }[];
    unallocated_allocation_id: number | null;
}) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Incomes', href: IncomeTemplateController.index().url },
        {
            title: incomeTemplate.name,
            href: IncomeTemplateController.edit({
                income_template: incomeTemplate.id,
            }).url,
        },
    ];

    const createVersionHref = `${IncomeTemplateController.create.url()}?version_of=${incomeTemplate.id}`;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="mx-auto w-full max-w-5xl px-4 pt-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                    <div className="min-w-0 space-y-1 sm:max-w-[280px]">
                        <label
                            htmlFor="income-template-version"
                            className="text-muted-foreground block text-xs font-medium"
                        >
                            Version
                        </label>
                        <Select
                            value={String(incomeTemplate.id)}
                            onValueChange={(id) => {
                                if (id === String(incomeTemplate.id)) {
                                    return;
                                }
                                router.visit(
                                    IncomeTemplateController.edit({
                                        income_template: Number(id),
                                    }).url,
                                );
                            }}
                        >
                            <SelectTrigger
                                id="income-template-version"
                                className="h-9 w-full"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {seriesVersions.map((v) => (
                                    <SelectItem
                                        key={v.id}
                                        value={String(v.id)}
                                    >
                                        v{v.version} — {v.name}
                                        {v.id === incomeTemplate.id
                                            ? ' (current)'
                                            : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2" asChild>
                        <Link href={createVersionHref}>
                            <CopyPlus className="size-3.5" />
                            New version
                        </Link>
                    </Button>
                </div>
            </div>
            <IncomeTemplateFormFields
                mode="edit"
                incomeTemplateId={incomeTemplate.id}
                initial={incomeTemplate}
                accounts={accounts}
                allocations={allocations}
                payoutFrequencies={payoutFrequencies}
                unallocatedAllocationId={unallocatedAllocationId}
                heading={`${incomeTemplate.name} (v${incomeTemplate.version})`}
                headTitle={`${incomeTemplate.name} (v${incomeTemplate.version})`}
            />
        </AppLayout>
    );
}
