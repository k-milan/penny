import { formatPhpMoney } from '@/lib/format';
import type { DashboardTransactionRow } from '@/lib/transaction-row';
import { cn } from '@/lib/utils';

export function formatTransactionGroupDate(dateYmd: string): string {
    const parts = dateYmd.split('-').map((p) => Number.parseInt(p, 10));
    const y = parts[0];
    const m = parts[1];
    const d = parts[2];
    if (
        !Number.isFinite(y) ||
        !Number.isFinite(m) ||
        !Number.isFinite(d) ||
        m === undefined ||
        d === undefined
    ) {
        return dateYmd;
    }
    const dt = new Date(y, m - 1, d);
    const month = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(
        dt,
    );
    const weekday = new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
    }).format(dt);
    return `${month} ${d}, ${y} (${weekday})`;
}

export function formatTransactionTime(iso: string | undefined): string | null {
    if (iso == null || iso === '') {
        return null;
    }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
        return null;
    }
    return new Intl.DateTimeFormat('en-PH', {
        timeStyle: 'short',
    }).format(d);
}

function lineAmountDisplay(amountStr: string | undefined): string {
    if (amountStr == null || String(amountStr).trim() === '') {
        return '—';
    }
    const n = Number.parseFloat(String(amountStr));
    return Number.isFinite(n) ? formatPhpMoney(n) : '—';
}

/** List preview: first account and first allocation (if any), one line; … if more lines exist. */
export function TransactionListInlineSummary({
    t,
    accountOptions,
    allocationOptions,
    compact = false,
}: {
    t: DashboardTransactionRow;
    accountOptions: { id: number; name: string }[];
    allocationOptions: { id: number; name: string }[];
    compact?: boolean;
}) {
    const accountNameById = new Map(
        accountOptions.map((a) => [a.id, a.name] as const),
    );
    const allocationNameById = new Map(
        allocationOptions.map((a) => [a.id, a.name] as const),
    );
    const accountLines = Array.isArray(t.accounts) ? t.accounts : [];
    const allocationLines = Array.isArray(t.allocations) ? t.allocations : [];

    if (accountLines.length === 0 && allocationLines.length === 0) {
        return (
            <p
                className={cn(
                    'wrap-break-word text-muted-foreground',
                    compact ? 'text-xs' : 'text-sm',
                )}
            >
                —
            </p>
        );
    }

    const accountBits: { name: string; amt: string }[] = [];
    for (const a of accountLines) {
        const acc = a.account;
        const nestedName =
            acc && typeof acc === 'object' && acc !== null && 'name' in acc
                ? String((acc as { name: string }).name)
                : null;
        const id = Number((a as { account_id?: unknown }).account_id);
        const name =
            nestedName ||
            (Number.isFinite(id) ? accountNameById.get(id) : undefined) ||
            (Number.isFinite(id) ? `Account #${id}` : 'Account');
        accountBits.push({
            name,
            amt: lineAmountDisplay(
                a.amount != null ? String(a.amount) : undefined,
            ),
        });
    }

    const allocBits: { name: string; amt: string }[] = [];
    for (const al of allocationLines) {
        const all = al.allocation;
        const nestedName =
            all && typeof all === 'object' && all !== null && 'name' in all
                ? String((all as { name: string }).name)
                : null;
        const id = Number((al as { allocation_id?: unknown }).allocation_id);
        const name =
            nestedName ||
            (Number.isFinite(id) ? allocationNameById.get(id) : undefined) ||
            (Number.isFinite(id) ? `Allocation #${id}` : 'Allocation');
        allocBits.push({
            name,
            amt: lineAmountDisplay(
                al.amount != null ? String(al.amount) : undefined,
            ),
        });
    }

    const showEllipsis = accountBits.length > 1 || allocBits.length > 1;
    const firstAcct = accountBits[0];
    const firstAlloc = allocBits[0];

    return (
        <p
            className={cn(
                'wrap-break-word text-muted-foreground',
                compact ? 'text-xs leading-snug' : 'text-sm leading-relaxed',
            )}
        >
            {firstAcct != null ? (
                <>
                    <span className="font-medium text-foreground">
                        {firstAcct.name}
                    </span>{' '}
                    <span className="tabular-nums">{firstAcct.amt}</span>
                </>
            ) : null}
            {firstAcct != null && firstAlloc != null ? (
                <span className="text-muted-foreground"> · </span>
            ) : null}
            {firstAlloc != null ? (
                <>
                    <span className="font-medium text-foreground">
                        {firstAlloc.name}
                    </span>{' '}
                    <span className="tabular-nums">{firstAlloc.amt}</span>
                </>
            ) : null}
            {showEllipsis ? (
                <span className="text-muted-foreground"> …</span>
            ) : null}
        </p>
    );
}

export function TransactionBreakdown({
    t,
    accountOptions,
    allocationOptions,
    variant = 'inline',
}: {
    t: DashboardTransactionRow;
    accountOptions: { id: number; name: string }[];
    allocationOptions: { id: number; name: string }[];
    variant?: 'inline' | 'detail';
}) {
    const accountNameById = new Map(
        accountOptions.map((a) => [a.id, a.name] as const),
    );
    const allocationNameById = new Map(
        allocationOptions.map((a) => [a.id, a.name] as const),
    );
    const accountLines = Array.isArray(t.accounts) ? t.accounts : [];
    const allocationLines = Array.isArray(t.allocations) ? t.allocations : [];
    if (accountLines.length === 0 && allocationLines.length === 0) {
        return <p className="text-sm text-muted-foreground">—</p>;
    }
    const isDetail = variant === 'detail';
    const outerClass = isDetail ? 'space-y-4' : 'space-y-2 text-sm';
    const rowClass = isDetail
        ? 'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-border border-b py-2.5 last:border-0'
        : 'flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5';
    const nameClass = isDetail
        ? 'min-w-0 font-medium break-words text-base'
        : 'min-w-0 font-medium break-words';
    const amountClass = isDetail
        ? 'shrink-0 tabular-nums text-base text-foreground'
        : 'shrink-0 tabular-nums text-muted-foreground';

    return (
        <div className={outerClass}>
            {accountLines.length > 0 ? (
                <div
                    className={
                        isDetail ? 'rounded-lg border bg-muted/20 p-3' : ''
                    }
                >
                    {isDetail ? (
                        <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                            Accounts
                        </p>
                    ) : null}
                    <ul className={cn(isDetail ? 'space-y-0' : 'space-y-1.5')}>
                        {accountLines.map((a, i) => {
                            const acc = a.account;
                            const nestedName =
                                acc &&
                                typeof acc === 'object' &&
                                acc !== null &&
                                'name' in acc
                                    ? String((acc as { name: string }).name)
                                    : null;
                            const id = Number(
                                (a as { account_id?: unknown }).account_id,
                            );
                            const name =
                                nestedName ||
                                (Number.isFinite(id)
                                    ? accountNameById.get(id)
                                    : undefined) ||
                                (Number.isFinite(id)
                                    ? `Account #${id}`
                                    : 'Account');
                            return (
                                <li
                                    key={`acct-${t.id}-${id}-${i}`}
                                    className={rowClass}
                                >
                                    <span className={nameClass}>{name}</span>
                                    <span className={amountClass}>
                                        {lineAmountDisplay(
                                            a.amount != null
                                                ? String(a.amount)
                                                : undefined,
                                        )}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ) : null}
            {allocationLines.length > 0 ? (
                <div
                    className={cn(
                        isDetail ? 'rounded-lg border bg-muted/20 p-3' : '',
                        !isDetail &&
                            accountLines.length > 0 &&
                            'mt-2 border-t border-border pt-2',
                    )}
                >
                    {isDetail ? (
                        <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                            Allocations
                        </p>
                    ) : null}
                    <ul className={cn(isDetail ? 'space-y-0' : 'space-y-1.5')}>
                        {allocationLines.map((al, i) => {
                            const all = al.allocation;
                            const nestedName =
                                all &&
                                typeof all === 'object' &&
                                all !== null &&
                                'name' in all
                                    ? String((all as { name: string }).name)
                                    : null;
                            const id = Number(
                                (al as { allocation_id?: unknown })
                                    .allocation_id,
                            );
                            const name =
                                nestedName ||
                                (Number.isFinite(id)
                                    ? allocationNameById.get(id)
                                    : undefined) ||
                                (Number.isFinite(id)
                                    ? `Allocation #${id}`
                                    : 'Allocation');
                            return (
                                <li
                                    key={`alloc-${t.id}-${id}-${i}`}
                                    className={rowClass}
                                >
                                    <span className={nameClass}>{name}</span>
                                    <span className={amountClass}>
                                        {lineAmountDisplay(
                                            al.amount != null
                                                ? String(al.amount)
                                                : undefined,
                                        )}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}
