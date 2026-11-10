import TransactionController from '@/actions/App/Http/Controllers/TransactionController';
import InputError from '@/components/input-error';
import { MoneyInput } from '@/components/money-input';
import { SearchableCombobox } from '@/components/searchable-combobox';
import {
    toLocalDateString,
    TransactionDateSelector,
} from '@/components/transaction-date-selector';
import type {
    AccountOption,
    AllocationOption,
} from '@/components/transaction-form-dialog';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatPhpMoney } from '@/lib/format';
import {
    balanceDescription,
    buildComposerTransaction,
    decimalAmount,
    movementLabel,
    movementSign,
    type ComposerEntity,
    type ComposerMovement,
} from '@/lib/transaction-composer';
import { useForm } from '@inertiajs/react';
import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

const newMovement = (amount = ''): ComposerMovement => ({
    key: crypto.randomUUID(),
    entity: '',
    amount,
    reversed: false,
});

export function TransactionComposerDialog({
    open,
    onOpenChange,
    accounts,
    allocations,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    accounts: AccountOption[];
    allocations: AllocationOption[];
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {open && (
                <ComposerForm
                    accounts={accounts}
                    allocations={allocations}
                    onClose={() => onOpenChange(false)}
                />
            )}
        </Dialog>
    );
}

function ComposerForm({
    accounts,
    allocations,
    onClose,
}: {
    accounts: AccountOption[];
    allocations: AllocationOption[];
    onClose: () => void;
}) {
    const entities = useMemo<ComposerEntity[]>(
        () => [
            ...accounts.map((account) => ({
                ...account,
                key: `account:${account.id}`,
                kind: 'account' as const,
            })),
            ...allocations.map((allocation) => ({
                ...allocation,
                key: `allocation:${allocation.id}`,
                kind: 'allocation' as const,
            })),
        ],
        [accounts, allocations],
    );
    const [starting, setStarting] = useState<ComposerMovement[]>(() => [
        newMovement(),
    ]);
    const [other, setOther] = useState<ComposerMovement[]>(() => [
        newMovement(),
    ]);
    const [flow, setFlow] = useState(-1);
    const form = useForm({
        date: toLocalDateString(new Date()),
        description: '',
        note: '',
        accounts: [] as { account_id: number; amount: string }[],
        allocations: [] as { allocation_id: number; amount: string }[],
    });
    const built = buildComposerTransaction(entities, starting, other, flow);
    const canSubmit =
        built.balanced &&
        form.data.description.trim() !== '' &&
        form.data.date !== '';
    const used = new Set([...starting, ...other].map((row) => row.entity));

    const renderMovement = (
        row: ComposerMovement,
        index: number,
        isStarting: boolean,
    ) => {
        const rows = isStarting ? starting : other;
        const setRows = isStarting ? setStarting : setOther;
        const prefix = `composer-${isStarting ? 'start' : 'other'}-${index}`;
        const entity = entities.find((entity) => entity.key === row.entity);
        const sign = entity
            ? movementSign(entity, flow, isStarting, row.reversed)
            : 0;
        const update = (changes: Partial<ComposerMovement>) =>
            setRows(
                rows.map((current) =>
                    current.key === row.key
                        ? { ...current, ...changes }
                        : current,
                ),
            );
        return (
            <li key={row.key} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                        <Label htmlFor={`${prefix}-entity`}>
                            {isStarting ? 'Starting point' : 'Other side'}{' '}
                            {index + 1}
                        </Label>
                        <SearchableCombobox
                            id={`${prefix}-entity`}
                            ariaLabel={`${isStarting ? 'Starting point' : 'Other side'} ${index + 1}`}
                            value={row.entity || null}
                            options={entities
                                .filter(
                                    (option) =>
                                        !used.has(option.key) ||
                                        option.key === row.entity,
                                )
                                .map((option) => ({
                                    ...option,
                                    id: option.key,
                                    name: `${option.name} · ${option.kind === 'allocation' ? 'Budget' : option.type.replaceAll('_', ' ')}`,
                                }))}
                            onChange={(value) => {
                                const selected = entities.find(
                                    (entity) => entity.key === value,
                                );
                                update({
                                    entity: String(value ?? ''),
                                    reversed: false,
                                });
                                if (isStarting && index === 0 && selected) {
                                    setFlow(
                                        selected.kind === 'allocation' ? 1 : -1,
                                    );
                                }
                            }}
                            placeholder="Account, person, or allocation…"
                            disabled={form.processing}
                        />
                    </div>
                    {(!isStarting || index > 0) && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="mt-6 shrink-0"
                            aria-label={`Remove ${isStarting ? 'starting point' : 'other side'} ${index + 1}`}
                            disabled={form.processing}
                            onClick={() =>
                                setRows(
                                    rows.filter(
                                        (current) => current.key !== row.key,
                                    ),
                                )
                            }
                        >
                            <Trash2 className="size-4" />
                        </Button>
                    )}
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]">
                    <div className="space-y-1">
                        <Label htmlFor={`${prefix}-direction`}>Movement</Label>
                        <select
                            id={`${prefix}-direction`}
                            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                            value={sign}
                            disabled={!entity || form.processing}
                            onChange={(event) => {
                                if (!entity) return;
                                const nextSign = Number(event.target.value);
                                if (isStarting && index === 0)
                                    setFlow(
                                        nextSign *
                                            (entity.kind === 'account'
                                                ? 1
                                                : -1),
                                    );
                                else
                                    update({
                                        reversed:
                                            nextSign !==
                                            movementSign(
                                                entity,
                                                flow,
                                                isStarting,
                                                false,
                                            ),
                                    });
                            }}
                        >
                            {!entity && (
                                <option value={0}>
                                    Choose a starting point
                                </option>
                            )}
                            {entity &&
                                [-1, 1].map((direction) => (
                                    <option key={direction} value={direction}>
                                        {movementLabel(entity, direction)}
                                    </option>
                                ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor={`${prefix}-amount`}>Amount</Label>
                        <MoneyInput
                            id={`${prefix}-amount`}
                            value={row.amount}
                            disabled={form.processing}
                            onChange={(amount) => {
                                update({ amount });
                                if (
                                    isStarting &&
                                    index === 0 &&
                                    starting.length === 1 &&
                                    other.length === 1 &&
                                    (other[0].amount === '' ||
                                        other[0].amount === row.amount)
                                )
                                    setOther([{ ...other[0], amount }]);
                            }}
                        />
                    </div>
                </div>
            </li>
        );
    };

    return (
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
                <DialogTitle>Transaction composer</DialogTitle>
                <DialogDescription>
                    Experimental · Start with one change, then explain the other
                    side.
                </DialogDescription>
            </DialogHeader>
            <form
                className="space-y-5"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (!canSubmit || form.processing) return;
                    form.transform((data) => ({
                        ...data,
                        description: data.description.trim(),
                        accounts: built.accounts,
                        allocations: built.allocations,
                    }));
                    form.post(TransactionController.store.url(), {
                        preserveScroll: true,
                        onSuccess: onClose,
                    });
                }}
            >
                <fieldset disabled={form.processing} className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="composer-description">
                            Description
                        </Label>
                        <Input
                            id="composer-description"
                            required
                            maxLength={255}
                            autoFocus
                            value={form.data.description}
                            onChange={(event) =>
                                form.setData('description', event.target.value)
                            }
                        />
                        <InputError message={form.errors.description} />
                    </div>
                    <TransactionDateSelector
                        id="composer-date"
                        value={form.data.date}
                        onChange={(date) => form.setData('date', date)}
                        invalid={!!form.errors.date}
                    />
                    <InputError message={form.errors.date} />
                    <section className="space-y-3">
                        <h3 className="font-medium">Start with</h3>
                        <ul className="space-y-3">
                            {starting.map((row, index) =>
                                renderMovement(row, index, true),
                            )}
                        </ul>
                        <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={() =>
                                setStarting([...starting, newMovement()])
                            }
                        >
                            <Plus className="size-4" />
                            Another starting movement
                        </Button>
                    </section>
                    <section className="space-y-3">
                        <h3 className="font-medium">Explained by</h3>
                        <ul className="space-y-3">
                            {other.map((row, index) =>
                                renderMovement(row, index, false),
                            )}
                        </ul>
                        <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={() =>
                                setOther([
                                    ...other,
                                    newMovement(
                                        built.remaining > 0
                                            ? decimalAmount(built.remaining)
                                            : '',
                                    ),
                                ])
                            }
                        >
                            <Plus className="size-4" />
                            Split / add another
                        </Button>
                    </section>
                    <div className="space-y-2">
                        <Label htmlFor="composer-note">Note (optional)</Label>
                        <Input
                            id="composer-note"
                            value={form.data.note}
                            onChange={(event) =>
                                form.setData('note', event.target.value)
                            }
                        />
                        <InputError message={form.errors.note} />
                    </div>
                </fieldset>
                <section className="space-y-2 border-t pt-4" aria-live="polite">
                    <p className="text-sm font-medium">
                        {built.balanced
                            ? 'Everything is accounted for'
                            : !built.valid
                              ? 'Choose both sides and enter positive amounts (up to two decimal places).'
                              : `${formatPhpMoney(Math.abs(built.remaining) / 100)} ${built.remaining > 0 ? 'left to explain' : 'over-explained'}`}
                    </p>
                    {built.effects.map(({ entity, cents }) => {
                        const balance = Math.round(
                            Number(entity.balance) * 100,
                        );
                        return (
                            <div
                                key={entity.key}
                                className="text-sm text-muted-foreground"
                            >
                                {entity.name}:{' '}
                                {balanceDescription(entity, balance)} →{' '}
                                {balanceDescription(entity, balance + cents)}
                            </div>
                        );
                    })}
                </section>
                {Object.entries(form.errors)
                    .filter(
                        ([key]) =>
                            !['description', 'date', 'note'].includes(key),
                    )
                    .map(([key, message]) => (
                        <InputError key={key} message={message} />
                    ))}
                <DialogFooter>
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={form.processing}
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                    <Button
                        id="composer-save"
                        type="submit"
                        disabled={!canSubmit || form.processing}
                    >
                        {form.processing ? 'Saving…' : 'Save transaction'}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    );
}
