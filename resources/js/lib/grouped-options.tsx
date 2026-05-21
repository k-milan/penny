import { formatTypeLabel } from '@/lib/format';

const ACCOUNT_TYPE_ORDER = ['bank', 'cash', 'credit_card', 'person'];
const ALLOCATION_TYPE_ORDER = ['normal', 'bill', 'savings', 'unallocated'];

type TypedOption = { id: number; name: string; type: string };

function renderGrouped<T extends TypedOption>(
    options: T[],
    typeOrder: string[],
): React.ReactNode {
    const types = [...new Set(options.map((o) => o.type))];

    if (types.length <= 1) {
        return options.map((a) => (
            <option key={a.id} value={a.id}>
                {a.name}
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
        const items = [...(grouped.get(type) ?? [])].sort((a, b) =>
            a.name.localeCompare(b.name),
        );
        return (
            <optgroup key={type} label={formatTypeLabel(type)}>
                {items.map((a) => (
                    <option key={a.id} value={a.id}>
                        {a.name}
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
