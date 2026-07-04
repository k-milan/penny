import { formatPhpMoney, formatTypeLabel } from '@/lib/format';

const ACCOUNT_TYPE_ORDER = ['bank', 'cash', 'credit_card', 'person'];
const ALLOCATION_TYPE_ORDER = ['normal', 'bill', 'savings', 'unallocated'];

type TypedOption = {
    id: number;
    name: string;
    type: string;
    balance?: string;
    is_pinned?: boolean;
};

function optionLabel(option: TypedOption): string {
    return `${option.is_pinned ? '📌 ' : ''}${option.name}${
        option.balance !== undefined
            ? ` (${formatPhpMoney(option.balance)})`
            : ''
    }`;
}

function sortOptions<T extends TypedOption>(options: T[]): T[] {
    return [...options].sort(
        (a, b) =>
            Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned)) ||
            a.name.localeCompare(b.name),
    );
}

function renderGrouped<T extends TypedOption>(
    options: T[],
    typeOrder: string[],
): React.ReactNode {
    const types = [...new Set(options.map((o) => o.type))];

    if (types.length <= 1) {
        return sortOptions(options).map((a) => (
            <option key={a.id} value={a.id}>
                {optionLabel(a)}
            </option>
        ));
    }

    const grouped = new Map<string, T[]>();
    for (const o of options) {
        const group = grouped.get(o.type) ?? [];
        group.push(o);
        grouped.set(o.type, group);
    }

    const ordered = [
        ...typeOrder.filter((t) => grouped.has(t)),
        ...[...grouped.keys()].filter((t) => !typeOrder.includes(t)).sort(),
    ];

    return ordered.map((type) => {
        const items = sortOptions(grouped.get(type) ?? []);
        return (
            <optgroup key={type} label={formatTypeLabel(type)}>
                {items.map((a) => (
                    <option key={a.id} value={a.id}>
                        {optionLabel(a)}
                    </option>
                ))}
            </optgroup>
        );
    });
}

export function renderGroupedAccountOptions(
    options: TypedOption[],
): React.ReactNode {
    return renderGrouped(options, ACCOUNT_TYPE_ORDER);
}

export function renderGroupedAllocationOptions(
    options: TypedOption[],
): React.ReactNode {
    return renderGrouped(options, ALLOCATION_TYPE_ORDER);
}
