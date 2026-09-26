import BillTrackerController from '@/actions/App/Http/Controllers/BillTrackerController';
import InputError from '@/components/input-error';
import { MoneyInput } from '@/components/money-input';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { formatPhpMoney } from '@/lib/format';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { CheckCircle2 } from 'lucide-react';

type Bill = {
    key: string;
    source_type: 'allocation' | 'account';
    source_id: number;
    name: string;
};
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

function BillMonthCells({
    bill,
    month,
    cell,
}: {
    bill: Bill;
    month: Month;
    cell: BillCell;
}) {
    const form = useForm({
        due_date: cell.due_date,
        due_amount: cell.due_amount ?? '',
    });
    const due = Number.parseFloat(cell.due_amount ?? '');
    const paid = Number.parseFloat(cell.paid_amount);
    const isPaid = Number.isFinite(due) && paid >= due;
    const formId = `bill-period-${cell.id}`;
    const cellClassName = month.is_current
        ? 'border-l bg-primary/5 px-3 py-3 align-top'
        : 'border-l px-3 py-3 align-top';

    if (!cell.confirmed || cell.needs_confirmation) {
        return (
            <>
                <td className={`${cellClassName} min-w-40`}>
                    <form
                        id={formId}
                        className="space-y-2"
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
                        <Input
                            type="date"
                            value={form.data.due_date}
                            onChange={(event) =>
                                form.setData('due_date', event.target.value)
                            }
                            aria-label={`${bill.name} ${month.label} due date`}
                        />
                        <InputError message={form.errors.due_date} />
                    </form>
                </td>
                <td className={`${cellClassName} min-w-40`}>
                    <MoneyInput
                        form={formId}
                        value={form.data.due_amount}
                        onChange={(value) => form.setData('due_amount', value)}
                        aria-label={`${bill.name} ${month.label} due amount`}
                        placeholder="Amount due"
                    />
                    <InputError message={form.errors.due_amount} />
                </td>
                <td className={`${cellClassName} min-w-36`}>
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-muted-foreground">
                            {formatPhpMoney(paid)}
                        </span>
                        <Checkbox
                            aria-label={`Confirm ${bill.name} for ${month.label}`}
                            checked={false}
                            disabled={form.processing}
                            onCheckedChange={(checked) => {
                                if (checked !== true) {
                                    return;
                                }

                                form.patch(
                                    BillTrackerController.update.url({
                                        billPeriod: cell.id,
                                    }),
                                    { preserveScroll: true },
                                );
                            }}
                        />
                    </div>
                </td>
            </>
        );
    }

    return (
        <>
            <td className={`${cellClassName} min-w-40 text-sm`}>
                {new Date(`${cell.due_date}T00:00:00`).toLocaleDateString()}
            </td>
            <td className={`${cellClassName} min-w-40 text-sm`}>
                {formatPhpMoney(due)}
            </td>
            <td className={`${cellClassName} min-w-36 text-sm`}>
                <div
                    className={
                        isPaid
                            ? 'flex items-center gap-1 font-medium text-emerald-600'
                            : 'text-muted-foreground'
                    }
                >
                    {isPaid ? <CheckCircle2 className="size-4" /> : null}
                    {formatPhpMoney(paid)}
                </div>
            </td>
        </>
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
                                    <th
                                        rowSpan={2}
                                        className="sticky left-0 z-20 min-w-44 border-b bg-muted px-4 py-3 text-sm font-medium"
                                    >
                                        Bill
                                    </th>
                                    {months.map((month) => (
                                        <th
                                            key={month.key}
                                            colSpan={3}
                                            className={
                                                month.is_current
                                                    ? 'border-b border-l bg-primary/10 px-3 py-2 text-center text-sm font-semibold text-primary'
                                                    : 'border-b border-l px-3 py-2 text-center text-sm font-semibold'
                                            }
                                        >
                                            {month.label}
                                        </th>
                                    ))}
                                </tr>
                                <tr>
                                    {months.flatMap((month) =>
                                        ['Due date', 'Due amount', 'Paid'].map(
                                            (label) => (
                                                <th
                                                    key={`${month.key}-${label}`}
                                                    className={
                                                        month.is_current
                                                            ? 'min-w-36 border-b border-l bg-primary/5 px-3 py-2 text-xs font-medium'
                                                            : 'min-w-36 border-b border-l px-3 py-2 text-xs font-medium'
                                                    }
                                                >
                                                    {label}
                                                </th>
                                            ),
                                        ),
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {bills.map((bill) => (
                                    <tr key={bill.key} className="border-t">
                                        <th className="sticky left-0 z-10 bg-background px-4 py-3 align-top text-sm font-medium">
                                            {bill.name}
                                        </th>
                                        {months.map((month) => (
                                            <BillMonthCells
                                                key={month.key}
                                                bill={bill}
                                                month={month}
                                                cell={month.bills[bill.key]}
                                            />
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
