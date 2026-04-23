import AccountController from '@/actions/App/Http/Controllers/AccountController';
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

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Accounts', href: AccountController.index().url },
    { title: 'New', href: AccountController.create().url },
];

export default function AccountsCreate({
    types,
}: {
    types: { value: string; label: string }[];
}) {
    const form = useForm({
        name: '',
        type: types[0]?.value ?? 'cash',
    });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="New account" />
            <div className="mx-auto flex w-full max-w-lg flex-col gap-6 p-4">
                <div>
                    <h1 className="text-2xl font-semibold">New account</h1>
                    <p className="text-muted-foreground text-sm">
                        Add a wallet, bank account, or person you track money
                        with.
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Details</CardTitle>
                        <CardDescription>
                            You can record transactions against this account
                            later.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form
                            className="space-y-6"
                            onSubmit={(e) => {
                                e.preventDefault();
                                form.post(AccountController.store.url());
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
                            <div className="flex gap-2">
                                <Button type="submit" disabled={form.processing}>
                                    Create account
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
