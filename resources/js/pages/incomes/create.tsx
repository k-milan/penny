import IncomeTemplateController from '@/actions/App/Http/Controllers/IncomeTemplateController';
import AppLayout from '@/layouts/app-layout';
import { IncomeTemplateFormFields } from '@/pages/incomes/income-template-form';
import { type BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Incomes', href: IncomeTemplateController.index().url },
    { title: 'New', href: IncomeTemplateController.create().url },
];

export default function IncomesCreate({
    accounts,
    allocations,
    payoutFrequencies,
    prefill,
    seriesIdForNewVersion,
    unallocated_allocation_id: unallocatedAllocationId,
}: {
    accounts: { id: number; name: string }[];
    allocations: { id: number; name: string }[];
    payoutFrequencies: { value: string; label: string }[];
    prefill: {
        name: string;
        description: string;
        company_name: string;
        payout_frequency: string;
        expected_income: string;
        accounts: { account_id: number; amount: string }[];
        allocations: { allocation_id: number; amount: string }[];
    } | null;
    seriesIdForNewVersion: number | null;
    unallocated_allocation_id: number | null;
}) {
    const isNewVersion =
        prefill != null && seriesIdForNewVersion != null;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <IncomeTemplateFormFields
                mode="create"
                accounts={accounts}
                allocations={allocations}
                payoutFrequencies={payoutFrequencies}
                initial={prefill ?? undefined}
                seriesIdForNewVersion={seriesIdForNewVersion ?? undefined}
                unallocatedAllocationId={unallocatedAllocationId}
                heading={
                    isNewVersion
                        ? 'New income template version'
                        : 'New income template'
                }
                headTitle={isNewVersion ? 'New income version' : 'New income'}
            />
        </AppLayout>
    );
}
