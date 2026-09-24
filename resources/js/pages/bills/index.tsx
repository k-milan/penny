import BillTrackerController from '@/actions/App/Http/Controllers/BillTrackerController';
import InputError from '@/components/input-error';
import { MoneyInput } from '@/components/money-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { formatPhpMoney } from '@/lib/format';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { CheckCircle2, Clock3 } from 'lucide-react';

type Bill = { id: number; name: string };
type BillCell = {
    id: number;
    due_date: string;
    due_amount: string | null;
    paid_amount: string;
    confirmed: boolean;
    needs_confirmation: boolean;
};
type Month = {
    key: string;
    label: string;
    is_current: boolean;
    bills: Record<string, BillCell>;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: dashboard().url },
    { title: 'Bill tracker', href: BillTrackerController.index().url },
];

function BillPeriodCell({ cell }: { cell: BillCell }) {
    const form = useForm({
        due_date: cell.due_date,
        due_amount: cell.due_amount ?? '',
    });
    const due = Number.parseFloat(cell.due_amount ?? '');
    const paid = Number.parseFloat(cell.paid_amount);
    const isPaid = Number.isFinite(due) && paid >= due;

    if (!cell.confirmed || cell.needs_confirmation) {
        return (
            <form
                className="min-w-48 space-y-2"
                onSubmit={(event) => {
                    event.preventDefault();
                    form.patch(
                        BillTrackerController.update.url({
                            billPeriod: cell.id,
                        }),
                        { preserveScroll: true },
                    );
                }}
            >
                {cell.needs_confirmation ? (
                    <div className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                        <Clock3 className="size-3.5" /> Confirm upcoming bill
                    </div>
                ) : (
                    <p className="text-xs text-muted-foreground">
                        Add this month&apos;s bill
                    </p>
                )}
                <Input
                    type="date"
                    value={form.data.due_date}
                    onChange={(event) =>
                        form.setData('due_date', event.target.value)
                    }
                    aria-label="Due date"
                />
                <MoneyInput
                    value={form.data.due_amount}
                    onChange={(value) => form.setData('due_amount', value)}
                    aria-label="Amount due"
                    placeholder="Amount due"
                />
                <InputError
                    message={form.errors.due_date ?? form.errors.due_amount}
                />
                <Button size="sm" disabled={form.processing}>
                    Confirm
                </Button>
            </form>
        );
    }

    return (
        <div className="min-w-40 space-y-1.5 text-sm">
            <div className="font-medium">
                Due {new Date(`${cell.due_date}T00:00:00`).toLocaleDateString()}
            </div>
            <div className="text-muted-foreground">
                {formatPhpMoney(due)} due
            </div>
            <div
                className={
                    isPaid
                        ? 'flex items-center gap-1 font-medium text-emerald-600'
                        : 'text-muted-foreground'
                }
            >
                {isPaid ? <CheckCircle2 className="size-4" /> : null}
                {formatPhpMoney(paid)} paid
            </div>
        </div>
    );
}

export default function BillsIndex({
    bills,
    months,
}: {
    bills: Bill[];
    months: Month[];
}) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Bill tracker" />
            <div className="flex flex-1 flex-col gap-4 p-4">
                <div>
                    <h1 className="text-2xl font-semibold">Bill tracker</h1>
                    <p className="text-sm text-muted-foreground">
                        Confirm what is due, then see payments by month.
                    </p>
                </div>

                {bills.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                        Create an allocation with the Bill type and a due date
                        to start tracking it here.
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full border-collapse text-left">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="sticky left-0 z-10 min-w-36 border-b bg-muted px-4 py-3 text-sm font-medium">
                                        Month
                                    </th>
                                    {bills.map((bill) => (
                                        <th
                                            key={bill.id}
                                            className="min-w-52 border-b px-4 py-3 text-sm font-medium"
                                        >
                                            {bill.name}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {months.map((month) => (
                                    <tr
                                        key={month.key}
                                        className={
                                            month.is_current
                                                ? 'bg-primary/5'
                                                : 'border-t'
                                        }
                                    >
                                        <th className="sticky left-0 z-10 bg-background px-4 py-4 align-top text-sm font-medium">
                                            {month.label}
                                            {month.is_current ? (
                                                <span className="mt-1 block text-xs font-normal text-primary">
                                                    Current month
                                                </span>
                                            ) : null}
                                        </th>
                                        {bills.map((bill) => (
                                            <td
                                                key={bill.id}
                                                className="px-4 py-4 align-top"
                                            >
                                                <BillPeriodCell
                                                    cell={
                                                        month.bills[
                                                            String(bill.id)
                                                        ]
                                                    }
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
