import AccountController from '@/actions/App/Http/Controllers/AccountController';
import InputError from '@/components/input-error';
import { MoneyInput } from '@/components/money-input';
import { formatPhpMoney } from '@/lib/format';
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
import { Plus, Trash2 } from 'lucide-react';

type AccountProps = {
    id: number;
    name: string;
    type: string;
    balance: string;
    opening_balance: string;
    opening_balance_items: { description: string; amount: string }[];
};

export default function AccountsEdit({
    account,
    types,
}: {
    account: AccountProps;
    types: { value: string; label: string }[];
}) {
    const form = useForm({
        name: account.name,
        type: account.type,
        opening_balance_items: account.opening_balance_items,
    });

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Accounts', href: AccountController.index().url },
        {
            title: account.name,
            href: AccountController.edit({ account: account.id }).url,
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Edit ${account.name}`} />
            <div className="mx-auto flex w-full max-w-lg flex-col gap-6 p-4">
                <div>
                    <p className="text-muted-foreground text-sm">
                        Balance: {formatPhpMoney(account.balance)}
                    </p>
                    <h1 className="text-2xl font-semibold">Edit account</h1>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Details</CardTitle>
                        <CardDescription>
                            Name and type only; balance follows your
                            transactions.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form
                            className="space-y-6"
                            onSubmit={(e) => {
                                e.preventDefault();
                                form.patch(
                                    AccountController.update.url({
                                        account: account.id,
                                    }),
                                );
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
                                    onChange={(e) =>
                                        form.setData('type', e.target.value)
                                    }
                                >
                                    {types.map((t) => (
                                        <option key={t.value} value={t.value}>
                                            {t.label}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={form.errors.type} />
                            </div>
                            {account.type === 'person' &&
                            account.opening_balance !== '0.00' ? (
                                <div className="space-y-3 border-t pt-6">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <Label>Opening balance breakdown</Label>
                                            <p className="text-sm text-muted-foreground">
                                                Itemize {formatPhpMoney(account.opening_balance)} for the shared balance page.
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                form.setData('opening_balance_items', [
                                                    ...form.data.opening_balance_items,
                                                    { description: '', amount: '' },
                                                ])
                                            }
                                        >
                                            <Plus className="size-4" />
                                            Add item
                                        </Button>
                                    </div>
                                    {form.data.opening_balance_items.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            Add items that total the opening balance.
                                        </p>
                                    ) : null}
                                    <div className="space-y-2">
                                        {form.data.opening_balance_items.map((item, index) => (
                                            <div key={index} className="flex items-start gap-2">
                                                <Input
                                                    aria-label={`Opening balance item ${index + 1}`}
                                                    value={item.description}
                                                    placeholder="What it was for"
                                                    onChange={(event) => {
                                                        const next = [...form.data.opening_balance_items];
                                                        next[index] = { ...item, description: event.target.value };
                                                        form.setData('opening_balance_items', next);
                                                    }}
                                                />
                                                <MoneyInput
                                                    aria-label={`Opening balance item ${index + 1} amount`}
                                                    className="w-32 shrink-0"
                                                    value={item.amount}
                                                    onChange={(amount) => {
                                                        const next = [...form.data.opening_balance_items];
                                                        next[index] = { ...item, amount };
                                                        form.setData('opening_balance_items', next);
                                                    }}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="shrink-0"
                                                    aria-label="Remove opening balance item"
                                                    onClick={() =>
                                                        form.setData(
                                                            'opening_balance_items',
                                                            form.data.opening_balance_items.filter((_, itemIndex) => itemIndex !== index),
                                                        )
                                                    }
                                                >
                                                    <Trash2 className="size-4 text-destructive" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                    <InputError message={form.errors.opening_balance_items} />
                                </div>
                            ) : null}
                            <div className="flex gap-2">
                                <Button type="submit" disabled={form.processing}>
                                    Save
                                </Button>
                                <Button variant="secondary" asChild>
                                    <Link href={AccountController.index()}>
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
