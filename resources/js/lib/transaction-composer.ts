import { formatPhpMoney } from '@/lib/format';

export type ComposerEntity = {
    key: string;
    id: number;
    name: string;
    kind: 'account' | 'allocation';
    type: string;
    balance: string;
    is_pinned?: boolean;
};

export type ComposerMovement = {
    key: string;
    entity: string;
    amount: string;
    reversed: boolean;
};

export function moneyCents(value: string): number | null {
    if (!/^\d{1,13}(\.\d{1,2})?$/.test(value)) {
        return null;
    }
    const [whole, fraction = ''] = value.split('.');
    return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function decimalAmount(cents: number): string {
    return `${cents < 0 ? '-' : ''}${Math.floor(Math.abs(cents) / 100)}.${String(Math.abs(cents) % 100).padStart(2, '0')}`;
}

export function movementSign(
    entity: ComposerEntity,
    flow: number,
    starting: boolean,
    reversed: boolean,
): number {
    return (
        flow *
        (entity.kind === 'account' ? 1 : -1) *
        (starting ? 1 : -1) *
        (reversed ? -1 : 1)
    );
}

export function movementLabel(entity: ComposerEntity, sign: number): string {
    if (entity.kind === 'allocation') {
        return sign > 0 ? 'Add budget' : 'Use / move out of budget';
    }
    if (entity.type === 'credit_card') {
        return sign > 0 ? 'Pay down / receive credit' : 'Charge to card';
    }
    if (entity.type === 'person') {
        return sign > 0
            ? Number(entity.balance) < 0
                ? 'I owe them less'
                : 'They owe me more'
            : Number(entity.balance) > 0
              ? 'They owe me less'
              : 'I owe them more';
    }
    return sign > 0 ? 'Money in' : 'Money out';
}

export function balanceDescription(
    entity: ComposerEntity,
    balance: number,
): string {
    if (entity.kind === 'account' && entity.type === 'person') {
        return balance > 0
            ? `They owe you ${formatPhpMoney(balance / 100)}`
            : balance < 0
              ? `You owe them ${formatPhpMoney(-balance / 100)}`
              : 'Settled';
    }
    if (entity.kind === 'account' && entity.type === 'credit_card') {
        return balance < 0
            ? `Debt ${formatPhpMoney(-balance / 100)}`
            : balance > 0
              ? `Credit ${formatPhpMoney(balance / 100)}`
              : 'Paid off';
    }
    return formatPhpMoney(balance / 100);
}

export function buildComposerTransaction(
    entities: ComposerEntity[],
    starting: ComposerMovement[],
    other: ComposerMovement[],
    flow: number,
) {
    const accounts: { account_id: number; amount: string }[] = [];
    const allocations: { allocation_id: number; amount: string }[] = [];
    const effects: { entity: ComposerEntity; cents: number }[] = [];
    const used = new Set<string>();
    let remaining = 0;
    let valid =
        starting.length > 0 && other.length > 0 && (flow === 1 || flow === -1);

    for (const [rows, isStarting] of [
        [starting, true],
        [other, false],
    ] as const) {
        for (const row of rows) {
            const entity = entities.find((entity) => entity.key === row.entity);
            const amount = moneyCents(row.amount);
            if (
                !entity ||
                amount === null ||
                amount <= 0 ||
                used.has(row.entity)
            ) {
                valid = false;
                continue;
            }
            used.add(row.entity);
            const cents =
                amount * movementSign(entity, flow, isStarting, row.reversed);
            remaining +=
                amount * (isStarting ? 1 : -1) * (row.reversed ? -1 : 1);
            effects.push({ entity, cents });
            if (entity.kind === 'account') {
                accounts.push({
                    account_id: entity.id,
                    amount: decimalAmount(cents),
                });
            } else {
                allocations.push({
                    allocation_id: entity.id,
                    amount: decimalAmount(cents),
                });
            }
        }
    }

    valid = valid && Number.isSafeInteger(remaining);
    return {
        accounts,
        allocations,
        effects,
        remaining,
        valid,
        balanced: valid && remaining === 0,
    };
}
