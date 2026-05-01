import type { TransactionFormModel } from '@/components/transaction-form-dialog';

type AccountLine = TransactionFormModel['accounts'][number];
type AllocationLine = TransactionFormModel['allocations'][number];

/**
 * Laravel JsonResource::collection() often serializes as `{ data: [ ... ] }`.
 * `Object.values` on that would yield `[ [ ...lines ] ]` (wrong). Unwrap `data` first.
 */
function unwrapResourceLines<T>(v: unknown): T[] {
    if (v === null || v === undefined) {
        return [];
    }
    if (Array.isArray(v)) {
        return v as T[];
    }
    if (typeof v === 'object') {
        const o = v as Record<string, unknown>;
        if (Array.isArray(o.data)) {
            return o.data as T[];
        }
        return Object.values(o) as T[];
    }
    return [];
}

function toLineArray(v: unknown): AccountLine[] {
    return unwrapResourceLines<AccountLine>(v);
}

function toAllocLineArray(v: unknown): AllocationLine[] {
    return unwrapResourceLines<AllocationLine>(v);
}

/**
 * Build a safe transaction for the transaction form and dashboard summaries.
 */
export type DashboardTransactionRow = TransactionFormModel & {
    /** ISO datetime from API (for ordering / time-of-day in lists). */
    created_at?: string;
};

export function ensureTransactionRow(
    t: unknown,
): DashboardTransactionRow {
    if (!t || typeof t !== 'object') {
        return {
            id: 0,
            date: '',
            description: '—',
            note: null,
            accounts: [],
            allocations: [],
        };
    }
    const o = t as Record<string, unknown>;
    const createdAtRaw = o.created_at;
    return {
        id: typeof o.id === 'number' ? o.id : Number(o.id) || 0,
        date: String(o.date ?? ''),
        description: String(o.description ?? ''),
        note: o.note == null || o.note === '' ? null : String(o.note),
        accounts: toLineArray(o.accounts) as TransactionFormModel['accounts'],
        allocations: toAllocLineArray(
            o.allocations,
        ) as TransactionFormModel['allocations'],
        ...(createdAtRaw != null && createdAtRaw !== ''
            ? { created_at: String(createdAtRaw) }
            : {}),
    };
}
