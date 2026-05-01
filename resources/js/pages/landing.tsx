import { FlashToasts } from '@/components/flash-toasts';
import { login, register } from '@/routes';
import { Head, Link } from '@inertiajs/react';

import { Button } from '@/components/ui/button';

export default function Landing() {
    return (
        <>
            <FlashToasts />
            <Head title="Home" />
            <div className="bg-background text-foreground flex min-h-screen flex-col">
                <header className="border-b">
                    <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4">
                        <span className="text-lg font-semibold tracking-tight">
                            Penny
                        </span>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" asChild>
                                <Link href={login()}>Log in</Link>
                            </Button>
                            <Button asChild>
                                <Link href={register()}>Register</Link>
                            </Button>
                        </div>
                    </div>
                </header>
                <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-16">
                    <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                        Your money, organized.
                    </h1>
                    <p className="text-muted-foreground mt-4 text-lg">
                        Log in to manage accounts and allocations, or create an
                        account to get started.
                    </p>
                </main>
            </div>
        </>
    );
}
