import AppLogoIcon from '@/components/app-logo-icon';
import { FlashToasts } from '@/components/flash-toasts';
import { formatDateYmd, formatPhpMoney } from '@/lib/format';
import { Head, InfiniteScroll, usePage } from '@inertiajs/react';
import { ChevronDown, TrendingDown, TrendingUp } from 'lucide-react';
import { useState } from 'react';

type ShareTransaction = {
    id: number;
    date: string;
    description: string;
    note: string | null;
    amount: string | null;
    bill: {
        items: { description: string; amount: string }[];
        item_subtotal: string;
        service_charge: string;
        discount: string;
        total: string;
    } | null;
};

type PaginatedTransactions = {
    data: ShareTransaction[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    next_page_url: string | null;
    prev_page_url: string | null;
};

type AccountShareProps = {
    account: {
        name: string;
        balance: string;
    };
    owner_name: string;
    transactions: PaginatedTransactions;
};

export default function AccountShare() {
    const { account, owner_name, transactions } =
        usePage<AccountShareProps>().props;

    const balance = Number.parseFloat(account.balance);
    const isPositive = balance > 0;
    const isNegative = balance < 0;

    return (
        <>
            <FlashToasts />
            <Head title={`Your balance with ${owner_name}`} />
            <div className="flex min-h-screen flex-col bg-background text-foreground">
                <header className="border-b">
                    <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-4 py-4">
                        <div className="flex items-center gap-2">
                            <div className="flex size-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                                <AppLogoIcon className="size-4 stroke-[2.25px] text-white dark:text-black" />
                            </div>
                            <span className="text-lg font-semibold tracking-tight">
                                Penny
                            </span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                            Shared by {owner_name}
                        </span>
                    </div>
                </header>

                <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
                    <h1 className="mb-4 text-2xl font-semibold">
                        Hi, {account.name}
                    </h1>
                    <div className="mb-8 rounded-xl border bg-card p-6">
                        <p className="mb-1 text-sm text-muted-foreground">
                            Your balance with {owner_name}
                        </p>
                        <p className="mb-1 text-3xl font-bold tabular-nums">
                            {formatPhpMoney(account.balance)}
                        </p>
                        {isPositive ? (
                            <p className="flex items-center gap-1.5 text-sm font-medium text-rose-600 dark:text-rose-400">
                                <TrendingDown className="size-4" />
                                You owe {owner_name} this amount
                            </p>
                        ) : isNegative ? (
                            <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                <TrendingUp className="size-4" />
                                {owner_name} owes you this amount
                            </p>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                All settled up
                            </p>
                        )}
                    </div>

                    <h2 className="mb-3 text-base font-semibold">
                        Transactions
                    </h2>

                    {transactions.data.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                            No transactions yet.
                        </p>
                    ) : (
                        <div className="rounded-xl border">
                            <InfiniteScroll
                                as="div"
                                className="divide-y"
                                data="transactions"
                                onlyNext
                            >
                                {({ loadingNext }) => (
                                    <>
                                        {transactions.data.map((t) => (
                                            <TransactionShareRow
                                                key={t.id}
                                                transaction={t}
                                            />
                                        ))}
                                        {loadingNext ? (
                                            <div className="py-4 text-center text-sm text-muted-foreground">
                                                Loading more…
                                            </div>
                                        ) : null}
                                    </>
                                )}
                            </InfiniteScroll>
                        </div>
                    )}
                </main>
            </div>
        </>
    );
}

function TransactionShareRow({
    transaction: t,
}: {
    transaction: ShareTransaction;
}) {
    const [expanded, setExpanded] = useState(false);
    const amount = t.amount !== null ? Number.parseFloat(t.amount) : null;
    const isPositive = amount !== null && amount > 0;
    const isNegative = amount !== null && amount < 0;

    return (
        <div className="px-4 py-3">
            <button
                type="button"
                disabled={!t.bill}
                className="flex w-full items-start justify-between gap-4 text-left disabled:cursor-default"
                aria-expanded={t.bill ? expanded : undefined}
                onClick={() => t.bill && setExpanded((value) => !value)}
            >
                <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{t.description}</p>
                    {t.note ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {t.note}
                        </p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDateYmd(t.date)}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {amount !== null ? (
                        <span
                            className={[
                                'shrink-0 font-semibold tabular-nums',
                                isPositive
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : isNegative
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : '',
                            ].join(' ')}
                        >
                            {isPositive ? '+' : ''}
                            {formatPhpMoney(t.amount ?? '0')}
                        </span>
                    ) : null}
                    {t.bill ? (
                        <ChevronDown
                            className={`size-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
                        />
                    ) : null}
                </div>
            </button>
            {expanded && t.bill ? (
                <div className="mt-3 space-y-2 border-t pt-3 text-sm">
                    {t.bill.items.map((item, index) => (
                        <div
                            key={`${item.description}-${index}`}
                            className="flex justify-between gap-3"
                        >
                            <span>{item.description}</span>
                            <span className="tabular-nums">
                                {formatPhpMoney(item.amount)}
                            </span>
                        </div>
                    ))}
                    <div className="space-y-1 border-t pt-2 text-muted-foreground">
                        <div className="flex justify-between">
                            <span>Items</span>
                            <span>{formatPhpMoney(t.bill.item_subtotal)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Service charge</span>
                            <span>{formatPhpMoney(t.bill.service_charge)}</span>
                        </div>
                        <div className="flex justify-between font-semibold text-foreground">
                            <span>Total you owe</span>
                            <span>{formatPhpMoney(t.bill.total)}</span>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
