import { GuidedEntryForm } from '@/components/guided-entry-form';
import {
    type AccountOption,
    type AllocationOption,
} from '@/components/transaction-form-dialog';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: dashboard().url },
    { title: 'Split a bill', href: '/bill-splits/create' },
];

export default function CreateBillSplit({
    accounts,
    allocations,
}: {
    accounts: AccountOption[];
    allocations: AllocationOption[];
}) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Split a bill" />
            <div className="mx-auto w-full max-w-6xl p-4 pb-10">
                <div className="mb-6 flex items-start gap-3">
                    <Button variant="outline" size="icon" asChild>
                        <Link href={dashboard()} aria-label="Back to dashboard">
                            <ArrowLeft className="size-4" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-semibold">Split a bill</h1>
                        <p className="text-sm text-muted-foreground">
                            Itemize a receipt and assign each person’s share.
                        </p>
                    </div>
                </div>
                <GuidedEntryForm
                    presentation="page"
                    mode="bill-split"
                    accounts={accounts}
                    allocations={allocations}
                />
            </div>
        </AppLayout>
    );
}
