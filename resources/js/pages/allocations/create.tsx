import AllocationController from '@/actions/App/Http/Controllers/AllocationController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';

/** Matches `App\Enums\AllocationType` string values. */
const TYPE_BILL = 'bill';
const TYPE_SAVINGS = 'savings';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Allocations', href: AllocationController.index().url },
    { title: 'New', href: AllocationController.create().url },
];

export default function AllocationsCreate({
    types,
}: {
    types: { value: string; label: string }[];
}) {
    const form = useForm({
        name: '',
        type: types[0]?.value ?? 'normal',
        due_date: '',
        goal_amount: '',
    });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="New allocation" />
            <div className="mx-auto flex w-full max-w-lg flex-col gap-6 p-4">
                <div>
                    <h1 className="text-2xl font-semibold">New allocation</h1>
                    <p className="text-muted-foreground text-sm">
                        A bucket for bills, savings, or day-to-day spending.
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Details</CardTitle>
                        <CardDescription>
                            You can change these later. Due date is for bills;
                            goal is for savings.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form
                            className="space-y-6"
                            onSubmit={(e) => {
                                e.preventDefault();
                                form.post(AllocationController.store.url());
                            }}
                        >
                            <div className="grid gap-2">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    value={form.data.name}
                                    onChange={(e) =>
                                        form.setData('name', e.target.value)
                                    }
                                    required
                                    autoFocus
                                />
                                <InputError message={form.errors.name} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="type">Type</Label>
                                <select
                                    id="type"
                                    name="type"
                                    className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                                    value={form.data.type}
                                    onChange={(e) => {
                                        const t = e.target.value;
                                        form.setData('type', t);
                                        if (t !== TYPE_BILL) {
                                            form.setData('due_date', '');
                                        }
                                        if (t !== TYPE_SAVINGS) {
                                            form.setData('goal_amount', '');
                                        }
                                    }}
                                >
                                    {types.map((t) => (
                                        <option key={t.value} value={t.value}>
                                            {t.label}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={form.errors.type} />
                            </div>
                            {form.data.type === TYPE_BILL && (
                                <div className="grid gap-2">
                                    <Label htmlFor="due_date">Due date</Label>
                                    <Input
                                        id="due_date"
                                        name="due_date"
                                        type="date"
                                        value={form.data.due_date}
                                        onChange={(e) =>
                                            form.setData(
                                                'due_date',
                                                e.target.value,
                                            )
                                        }
                                    />
                                    <InputError
                                        message={form.errors.due_date}
                                    />
                                </div>
                            )}
                            {form.data.type === TYPE_SAVINGS && (
                                <div className="grid gap-2">
                                    <Label htmlFor="goal_amount">
                                        Goal amount
                                    </Label>
                                    <Input
                                        id="goal_amount"
                                        name="goal_amount"
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="Optional"
                                        value={form.data.goal_amount}
                                        onChange={(e) =>
                                            form.setData(
                                                'goal_amount',
                                                e.target.value,
                                            )
                                        }
                                    />
                                    <InputError
                                        message={form.errors.goal_amount}
                                    />
                                </div>
                            )}
                            <div className="flex gap-2">
                                <Button type="submit" disabled={form.processing}>
                                    Create allocation
                                </Button>
                                <Button variant="secondary" asChild>
                                    <Link href={AllocationController.index()}>
                                        Cancel
                                    </Link>
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
