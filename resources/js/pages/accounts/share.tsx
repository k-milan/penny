import { FlashToasts } from '@/components/flash-toasts';
import { formatDateYmd, formatPhpMoney } from '@/lib/format';
import { Head, InfiniteScroll, usePage } from '@inertiajs/react';
import { TrendingDown, TrendingUp } from 'lucide-react';

type ShareTransaction = {
    id: number;
    date: string;
    description: string;
    note: string | null;
    amount: string | null;
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
    const {
        account,
        owner_name,
        transactions,
    } = usePage<AccountShareProps>().props;

    const balance = Number.parseFloat(account.balance);
    const isPositive = balance > 0;
    const isNegative = balance < 0;

    return (
        <>
            <FlashToasts />
            <Head title={`${account.name} — Balance`} />
            <div className="bg-background text-foreground flex min-h-screen flex-col">
                <header className="border-b">
                    <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-4 py-4">
                        <span className="text-lg font-semibold tracking-tight">
                            Penny
                        </span>
                        <span className="text-sm text-muted-foreground">
                            Shared by {owner_name}
                        </span>
                    </div>
                </header>

                <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
                    <div className="mb-8 rounded-xl border bg-card p-6">
                        <p className="mb-1 text-sm text-muted-foreground">
                            Balance with {owner_name}
                        </p>
                        <h1 className="mb-1 text-3xl font-bold tabular-nums">
                            {formatPhpMoney(account.balance)}
                        </h1>
                        {isPositive ? (
                            <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                <TrendingUp className="size-4" />
                                {account.name} owes you this amount
                            </p>
                        ) : isNegative ? (
                            <p className="flex items-center gap-1.5 text-sm font-medium text-rose-600 dark:text-rose-400">
                                <TrendingDown className="size-4" />
                                You owe {account.name} this amount
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
    const amount = t.amount !== null ? Number.parseFloat(t.amount) : null;
    const isPositive = amount !== null && amount > 0;
    const isNegative = amount !== null && amount < 0;

    return (
        <div className="flex items-start justify-between gap-4 px-4 py-3">
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
            {amount !== null ? (
                <span
                    className={[
                        'shrink-0 tabular-nums font-semibold',
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
        </div>
    );
}
