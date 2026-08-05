import { MoneyInput } from '@/components/money-input';
import {
    ProjectedBalance,
    SearchableCombobox,
} from '@/components/searchable-combobox';
import type { TransactionCreateKind } from '@/components/transaction-create-result-dialog';
import {
    toLocalDateString,
    TransactionDateSelector,
} from '@/components/transaction-date-selector';
import {
    type AccountOption,
    type AllocationOption,
} from '@/components/transaction-form-dialog';
import { Badge } from '@/components/ui/badge';
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
import { useForm } from '@inertiajs/react';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type Assignee =
    | {
          type: 'account' | 'allocation';
          id: number;
          label: string;
          shares?: number;
      }
    | {
          type: 'new_person';
          name: string;
          label: string;
          shares?: number;
      };
type Item = {
    key: string;
    description: string;
    quantity: string;
    unitPrice: string;
    assignees: Assignee[];
};
type PurchaseAllocationLine = {
    key: string;
    allocation_id: number;
    amount: string;
};
type AssignmentFocus = {
    type: 'item' | 'person';
    key: string;
} | null;

const key = () =>
    typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
const newItem = (): Item => ({
    key: key(),
    description: '',
    quantity: '1',
    unitPrice: '',
    assignees: [],
});
const newPurchaseAllocationLine = (
    allocation_id = 0,
): PurchaseAllocationLine => ({
    key: key(),
    allocation_id,
    amount: '',
});
const amount = (value: string): number => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
};
export function GuidedEntryForm({
    open,
    onOpenChange,
    accounts,
    allocations,
    mode = 'purchase',
    presentation = 'dialog',
    onCreateSuccess,
    onCreateFailure,
}: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    accounts: AccountOption[];
    allocations: AllocationOption[];
    mode?: 'purchase' | 'bill-split';
    presentation?: 'dialog' | 'page';
    onCreateSuccess?: (kind: TransactionCreateKind) => void;
    onCreateFailure?: (kind: TransactionCreateKind) => void;
}) {
    const splitBill = mode === 'bill-split';
    const defaultOwnerAllocation =
        allocations.find((allocation) => allocation.is_unallocated) ??
        allocations[0];
    const [participants, setParticipants] = useState<Assignee[]>(() =>
        splitBill
            ? [
                  {
                      type: 'allocation',
                      id: defaultOwnerAllocation?.id ?? 0,
                      label:
                          defaultOwnerAllocation?.name ?? 'Select allocation',
                  },
              ]
            : [],
    );
    const [pendingParticipant, setPendingParticipant] = useState<
        string | number | null
    >(null);
    const [personSearch, setPersonSearch] = useState('');
    const [assignmentFocus, setAssignmentFocus] =
        useState<AssignmentFocus>(null);
    const [pendingAllocationFocusId, setPendingAllocationFocusId] = useState<
        string | null
    >(null);
    const form = useForm({
        date: toLocalDateString(new Date()),
        description: '',
        note: '',
        payment_account_id: 0,
        total: '',
        service_charge: '',
        allocation_id: 0,
        allocations: [newPurchaseAllocationLine()],
        items: [] as Item[],
    });
    const paymentAccounts = accounts.filter((a) => a.type !== 'person');
    const people = accounts.filter((a) => a.type === 'person');
    const payment = paymentAccounts.find(
        (a) => a.id === form.data.payment_account_id,
    );
    const subtotal = useMemo(
        () =>
            form.data.items.reduce(
                (sum, item) =>
                    sum + amount(item.quantity) * amount(item.unitPrice),
                0,
            ),
        [form.data.items],
    );
    const service = amount(form.data.service_charge);
    const total = splitBill
        ? Math.round((subtotal + service) * 100) / 100
        : amount(form.data.total);
    const purchaseAllocationTotal = useMemo(
        () =>
            Math.round(
                form.data.allocations.reduce(
                    (sum, line) => sum + amount(line.amount),
                    0,
                ) * 100,
            ) / 100,
        [form.data.allocations],
    );
    const purchaseAllocationDifference =
        Math.round((total - purchaseAllocationTotal) * 100) / 100;
    const difference = Math.round((total - subtotal - service) * 100) / 100;
    const assigneeOptions = [
        ...people.map((person) => ({
            id: `account:${person.id}`,
            name: person.name,
            balance: person.balance,
            is_pinned: person.is_pinned,
            detail: 'Person',
        })),
    ];

    const setItems = (items: Item[]) => form.setData('items', items);
    const setPurchaseAllocations = (allocations: PurchaseAllocationLine[]) =>
        form.setData('allocations', allocations);

    useEffect(() => {
        if (pendingAllocationFocusId === null) {
            return;
        }

        document.getElementById(pendingAllocationFocusId)?.focus();
        setPendingAllocationFocusId(null);
    }, [pendingAllocationFocusId, form.data.allocations.length]);
    const updateItem = (index: number, patch: Partial<Item>) =>
        setItems(
            form.data.items.map((item, i) =>
                i === index ? { ...item, ...patch } : item,
            ),
        );
    const assigneeKey = (assignee: Assignee): string =>
        assignee.type === 'new_person'
            ? `new_person:${assignee.name.toLocaleLowerCase()}`
            : `${assignee.type}:${assignee.id}`;
    const sameAssignee = (a: Assignee, b: Assignee): boolean =>
        assigneeKey(a) === assigneeKey(b);
    const selectedPerson =
        assignmentFocus?.type === 'person'
            ? (participants.find(
                  (participant) =>
                      assigneeKey(participant) === assignmentFocus.key,
              ) ?? null)
            : null;

    const addPerson = () => {
        let participant: Assignee | null = null;
        if (typeof pendingParticipant === 'string') {
            const [type, rawId] = pendingParticipant.split(':');
            const source =
                type === 'account'
                    ? people.find((person) => person.id === Number(rawId))
                    : undefined;
            if (source) {
                participant = {
                    type: 'account',
                    id: source.id,
                    label: source.name,
                };
            }
        }

        const typedName = personSearch.trim();
        if (participant === null && typedName !== '') {
            const existing = people.find(
                (person) =>
                    person.name.toLocaleLowerCase() ===
                    typedName.toLocaleLowerCase(),
            );
            participant = existing
                ? {
                      type: 'account',
                      id: existing.id,
                      label: existing.name,
                  }
                : {
                      type: 'new_person',
                      name: typedName,
                      label: typedName,
                  };
        }

        if (
            participant === null ||
            participants.some((current) => sameAssignee(current, participant))
        ) {
            return;
        }
        setParticipants((current) => [...current, participant]);
        setPendingParticipant(null);
        setPersonSearch('');
    };

    const toggleAssignment = (participant: Assignee, itemIndex: number) => {
        const item = form.data.items[itemIndex];
        const assigned = item.assignees.some((a) =>
            sameAssignee(a, participant),
        );
        updateItem(itemIndex, {
            assignees: assigned
                ? item.assignees.filter((a) => !sameAssignee(a, participant))
                : [...item.assignees, { ...participant, shares: 1 }],
        });
    };

    const changeItemShares = (
        itemIndex: number,
        participant: Assignee,
        delta: number,
    ) => {
        const item = form.data.items[itemIndex];
        updateItem(itemIndex, {
            assignees: item.assignees.map((assignee) =>
                sameAssignee(assignee, participant)
                    ? {
                          ...assignee,
                          shares: Math.max(1, (assignee.shares ?? 1) + delta),
                      }
                    : assignee,
            ),
        });
    };

    const handleItemClick = (item: Item, itemIndex: number) => {
        if (selectedPerson) {
            toggleAssignment(selectedPerson, itemIndex);

            return;
        }

        setAssignmentFocus((current) =>
            current?.type === 'item' && current.key === item.key
                ? null
                : { type: 'item', key: item.key },
        );
    };

    const handlePersonClick = (participant: Assignee) => {
        if (assignmentFocus?.type === 'item') {
            const selectedItemIndex = form.data.items.findIndex(
                (item) => item.key === assignmentFocus.key,
            );

            if (selectedItemIndex >= 0) {
                toggleAssignment(participant, selectedItemIndex);
            }

            return;
        }

        const participantKey = assigneeKey(participant);
        setAssignmentFocus((current) =>
            current?.type === 'person' && current.key === participantKey
                ? null
                : { type: 'person', key: participantKey },
        );
    };

    const removeParticipant = (participant: Assignee) => {
        if (participant.type === 'allocation') {
            return;
        }

        setParticipants((current) =>
            current.filter((a) => !sameAssignee(a, participant)),
        );
        setItems(
            form.data.items.map((item) => ({
                ...item,
                assignees: item.assignees.filter(
                    (a) => !sameAssignee(a, participant),
                ),
            })),
        );
    };

    const changeOwnerAllocation = (value: number | string | null) => {
        const allocation = allocations.find(
            (option) => option.id === Number(value),
        );
        if (!allocation) {
            return;
        }

        const currentOwner = participants.find(
            (participant) => participant.type === 'allocation',
        );
        const nextOwner: Assignee = {
            type: 'allocation',
            id: allocation.id,
            label: allocation.name,
        };

        setParticipants((current) =>
            current.map((participant) =>
                participant.type === 'allocation' ? nextOwner : participant,
            ),
        );
        if (currentOwner) {
            setItems(
                form.data.items.map((item) => ({
                    ...item,
                    assignees: item.assignees.map((assignee) =>
                        sameAssignee(assignee, currentOwner)
                            ? {
                                  ...nextOwner,
                                  shares: assignee.shares ?? 1,
                              }
                            : assignee,
                    ),
                })),
            );
        }
        if (
            currentOwner &&
            assignmentFocus?.type === 'person' &&
            assignmentFocus.key === assigneeKey(currentOwner)
        ) {
            setAssignmentFocus({
                type: 'person',
                key: assigneeKey(nextOwner),
            });
        }
    };

    const participantSubtotal = (participant: Assignee): number =>
        form.data.items.reduce((sum, item) => {
            const assignment = item.assignees.find((assignee) =>
                sameAssignee(assignee, participant),
            );
            if (!assignment) {
                return sum;
            }
            const totalShares = item.assignees.reduce(
                (shares, assignee) => shares + (assignee.shares ?? 1),
                0,
            );
            return (
                sum +
                (amount(item.quantity) *
                    amount(item.unitPrice) *
                    (assignment.shares ?? 1)) /
                    totalShares
            );
        }, 0);

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({
            ...data,
            note: data.note.trim() || null,
            service_charge: splitBill ? data.service_charge : '0',
            total: splitBill ? total.toFixed(2) : data.total,
            allocation_id: splitBill
                ? data.allocation_id
                : (data.allocations[0]?.allocation_id ?? 0),
            allocations: splitBill
                ? []
                : data.allocations.map((line) => ({
                      allocation_id: line.allocation_id,
                      amount: line.amount,
                  })),
            items: splitBill
                ? data.items.map((item) => ({
                      description: item.description,
                      quantity: Number(item.quantity),
                      unit_price: item.unitPrice,
                      assignees: item.assignees.map((assignee) =>
                          assignee.type === 'new_person'
                              ? {
                                    type: assignee.type,
                                    name: assignee.name,
                                    shares: assignee.shares ?? 1,
                                }
                              : {
                                    type: assignee.type,
                                    id: assignee.id,
                                    shares: assignee.shares ?? 1,
                                },
                      ),
                  }))
                : [
                      {
                          description: data.description,
                          amount: data.total,
                          assignees: [
                              {
                                  type: 'allocation',
                                  id: data.allocations[0]?.allocation_id ?? 0,
                              },
                          ],
                      },
                  ],
        }));
        form.post(splitBill ? '/bill-splits' : '/purchases', {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                onOpenChange?.(false);
                onCreateSuccess?.(splitBill ? 'bill_split' : 'purchase');
            },
            onError: () => {
                onOpenChange?.(false);
                onCreateFailure?.(splitBill ? 'bill_split' : 'purchase');
            },
        });
    };

    const valid =
        form.data.description.trim() !== '' &&
        form.data.payment_account_id > 0 &&
        total > 0 &&
        (!splitBill
            ? form.data.allocations.length > 0 &&
              purchaseAllocationDifference === 0 &&
              form.data.allocations.every(
                  (line) => line.allocation_id > 0 && amount(line.amount) > 0,
              ) &&
              new Set(
                  form.data.allocations.map((line) => line.allocation_id),
              ).size === form.data.allocations.length
            : difference === 0 &&
              form.data.items.length > 0 &&
              form.data.items.every(
                  (item) =>
                      item.description.trim() !== '' &&
                      amount(item.quantity) >= 1 &&
                      amount(item.unitPrice) > 0 &&
                      item.assignees.length > 0 &&
                      item.assignees.every(
                          (assignee) =>
                              assignee.type !== 'allocation' || assignee.id > 0,
                      ),
              ));

    const formContent = (
        <form
            onSubmit={submit}
            className="space-y-5"
            onClickCapture={(event) => {
                if (
                    event.target instanceof Element &&
                    event.target.closest('[data-assignment-zone]')
                ) {
                    return;
                }

                setAssignmentFocus(null);
            }}
        >
            {presentation === 'dialog' ? (
                <DialogHeader>
                    <DialogTitle>
                        {splitBill ? 'Split a bill' : 'Record purchase'}
                    </DialogTitle>
                    <DialogDescription>
                        {splitBill
                            ? 'Itemize the receipt, assign each item, and reconcile the total.'
                            : 'Enter a positive amount. Penny applies the ledger direction.'}
                    </DialogDescription>
                </DialogHeader>
            ) : null}
            <div className={splitBill ? 'hidden' : 'grid gap-4 sm:grid-cols-2'}>
                <div className="sm:col-span-2">
                    <TransactionDateSelector
                        id="purchase-date"
                        value={form.data.date}
                        onChange={(value) => form.setData('date', value)}
                    />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="purchase-description">Description</Label>
                    <Input
                        id="purchase-description"
                        value={form.data.description}
                        onChange={(e) =>
                            form.setData('description', e.target.value)
                        }
                        placeholder="Dinner"
                    />
                </div>
            </div>
            <div
                className={
                    splitBill
                        ? 'hidden'
                        : 'grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]'
                }
            >
                <div>
                    <Label>Paid from</Label>
                    <SearchableCombobox
                        ariaLabel="Payment account"
                        value={form.data.payment_account_id || null}
                        onChange={(value) =>
                            form.setData('payment_account_id', Number(value))
                        }
                        options={paymentAccounts}
                        placeholder="Search accounts…"
                    />
                    <ProjectedBalance
                        balance={payment?.balance}
                        delta={total > 0 ? -total : null}
                    />
                </div>
                <div>
                    <Label>Amount</Label>
                    <MoneyInput
                        id="purchase-amount"
                        value={form.data.total}
                        onChange={(value) => form.setData('total', value)}
                    />
                </div>
            </div>
            {!splitBill ? (
                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <Label>Allocation split</Label>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const used = new Set(
                                    form.data.allocations
                                        .map((line) => line.allocation_id)
                                        .filter((id) => id > 0),
                                );
                                const next = allocations.find(
                                    (allocation) => !used.has(allocation.id),
                                );
                                setPurchaseAllocations([
                                    ...form.data.allocations,
                                    newPurchaseAllocationLine(next?.id ?? 0),
                                ]);
                                setPendingAllocationFocusId(
                                    `purchase-allocation-${form.data.allocations.length}`,
                                );
                            }}
                            disabled={
                                !allocations.some(
                                    (allocation) =>
                                        !form.data.allocations.some(
                                            (line) =>
                                                line.allocation_id ===
                                                allocation.id,
                                        ),
                                )
                            }
                        >
                            <Plus className="size-4" />
                            Add
                        </Button>
                    </div>
                    <ul className="space-y-3">
                        {form.data.allocations.map((line, index) => {
                            const otherIds = new Set(
                                form.data.allocations
                                    .map((current, currentIndex) =>
                                        currentIndex === index
                                            ? null
                                            : current.allocation_id,
                                    )
                                    .filter(
                                        (id): id is number =>
                                            id !== null && id > 0,
                                    ),
                            );
                            const options = allocations.filter(
                                (allocation) =>
                                    allocation.id === line.allocation_id ||
                                    !otherIds.has(allocation.id),
                            );
                            const allocation = allocations.find(
                                (option) => option.id === line.allocation_id,
                            );

                            return (
                                <li
                                    key={line.key}
                                    className="flex items-start gap-2"
                                >
                                    <div className="min-w-0 flex-1">
                                        <Label className="sr-only">
                                            Allocation
                                        </Label>
                                        <SearchableCombobox
                                            id={`purchase-allocation-${index}`}
                                            ariaLabel="Purchase allocation"
                                            value={
                                                line.allocation_id > 0
                                                    ? line.allocation_id
                                                    : null
                                            }
                                            onChange={(value) => {
                                                const next = [
                                                    ...form.data.allocations,
                                                ];
                                                next[index] = {
                                                    ...line,
                                                    allocation_id: Number(
                                                        value ?? 0,
                                                    ),
                                                };
                                                setPurchaseAllocations(next);
                                            }}
                                            options={options}
                                            placeholder="Search allocations…"
                                        />
                                        <ProjectedBalance
                                            balance={allocation?.balance}
                                            delta={
                                                amount(line.amount) > 0
                                                    ? -amount(line.amount)
                                                    : null
                                            }
                                        />
                                    </div>
                                    <div className="w-32 shrink-0">
                                        <Label className="sr-only">
                                            Amount
                                        </Label>
                                        <MoneyInput
                                            aria-label="Allocation amount"
                                            value={line.amount}
                                            onChange={(value) => {
                                                const next = [
                                                    ...form.data.allocations,
                                                ];
                                                next[index] = {
                                                    ...line,
                                                    amount: value,
                                                };
                                                setPurchaseAllocations(next);
                                            }}
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="shrink-0"
                                        onClick={() => {
                                            const next =
                                                form.data.allocations.filter(
                                                    (_, currentIndex) =>
                                                        currentIndex !== index,
                                                );
                                            setPurchaseAllocations(
                                                next.length > 0
                                                    ? next
                                                    : [
                                                          newPurchaseAllocationLine(),
                                                      ],
                                            );
                                        }}
                                        disabled={
                                            form.data.allocations.length <= 1
                                        }
                                        aria-label="Remove allocation line"
                                    >
                                        <Trash2 className="size-4 text-destructive" />
                                    </Button>
                                </li>
                            );
                        })}
                    </ul>
                    <p className="text-xs text-muted-foreground tabular-nums">
                        Split {formatPhpMoney(purchaseAllocationTotal)}
                        {purchaseAllocationDifference === 0
                            ? ''
                            : ` · Remaining ${formatPhpMoney(purchaseAllocationDifference)}`}
                    </p>
                </div>
            ) : (
                <>
                    <div className="grid items-start gap-4 md:grid-cols-2">
                        <div className="border border-neutral-300 bg-white p-5 font-mono text-neutral-950 shadow-lg">
                            <div className="mb-5 text-center text-xs">
                                <p className="text-base font-bold">PENNY</p>
                                <p className="text-neutral-500">
                                    BILL SPLIT RECEIPT
                                </p>
                                <p className="mt-2 text-neutral-500">
                                    {form.data.date || 'DATE'} ·{' '}
                                    {form.data.description || 'DESCRIPTION'}
                                </p>
                                <p className="text-neutral-500">
                                    PAID FROM: {payment?.name ?? '—'}
                                </p>
                            </div>
                            <div className="mb-3 flex items-center justify-between border-y border-dashed border-neutral-400 py-2">
                                <div>
                                    <h3 className="font-bold">ITEMS</h3>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="border-neutral-300 bg-white text-neutral-950 hover:bg-neutral-100 hover:text-neutral-950 dark:border-neutral-300 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 dark:hover:text-neutral-950"
                                    onClick={() =>
                                        setItems([
                                            ...form.data.items,
                                            newItem(),
                                        ])
                                    }
                                >
                                    <Plus className="size-4" /> Item
                                </Button>
                            </div>
                            <div className="grid grid-cols-[1fr_4rem_7rem_5rem_2rem] gap-2 border-b border-dashed border-neutral-400 pb-1 text-right text-[11px] font-bold">
                                <span className="text-left">ITEM</span>
                                <span>QTY</span>
                                <span>PRICE</span>
                                <span>AMOUNT</span>
                                <span />
                            </div>
                            <div className="space-y-4">
                                {form.data.items.length === 0 ? (
                                    <p className="rounded-md bg-neutral-100 p-3 text-sm text-neutral-500">
                                        No items yet.
                                    </p>
                                ) : null}
                                {form.data.items.map((item, index) => (
                                    <div
                                        key={item.key}
                                        data-assignment-zone="item"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            handleItemClick(item, index);
                                        }}
                                        className={`relative space-y-2 border-t p-2 font-mono first:border-0 ${
                                            assignmentFocus?.type === 'item' &&
                                            assignmentFocus.key === item.key
                                                ? 'rounded-md bg-emerald-500/15'
                                                : assignmentFocus?.type ===
                                                    'item'
                                                  ? 'opacity-40'
                                                  : selectedPerson
                                                    ? item.assignees.some(
                                                          (assignee) =>
                                                              sameAssignee(
                                                                  assignee,
                                                                  selectedPerson,
                                                              ),
                                                      )
                                                        ? 'rounded-md bg-emerald-500/15'
                                                        : 'opacity-40'
                                                    : item.assignees.length ===
                                                        0
                                                      ? 'border-l-2 border-l-amber-500/60'
                                                      : ''
                                        }`}
                                    >
                                        {(assignmentFocus?.type === 'item' &&
                                            assignmentFocus.key === item.key) ||
                                        (selectedPerson &&
                                            item.assignees.some((assignee) =>
                                                sameAssignee(
                                                    assignee,
                                                    selectedPerson,
                                                ),
                                            )) ? (
                                            <Check className="absolute top-2 right-2 size-4 text-emerald-500" />
                                        ) : null}
                                        <div className="grid grid-cols-[1fr_4rem_7rem_5rem_2rem] items-center gap-2">
                                            <Input
                                                aria-label={`Item ${index + 1} description`}
                                                value={item.description}
                                                onChange={(e) =>
                                                    updateItem(index, {
                                                        description:
                                                            e.target.value,
                                                    })
                                                }
                                                placeholder="Item description"
                                                className="border-0 bg-transparent px-0 text-neutral-950 shadow-none focus-visible:ring-0 dark:bg-transparent dark:text-neutral-950"
                                            />
                                            <Input
                                                aria-label={`Item ${index + 1} quantity`}
                                                type="number"
                                                min="1"
                                                value={item.quantity}
                                                onChange={(e) =>
                                                    updateItem(index, {
                                                        quantity:
                                                            e.target.value,
                                                    })
                                                }
                                                placeholder="Qty"
                                                className="border-0 bg-transparent px-0 text-right text-neutral-950 shadow-none focus-visible:ring-0 dark:bg-transparent dark:text-neutral-950"
                                            />
                                            <MoneyInput
                                                aria-label={`Item ${index + 1} unit price`}
                                                value={item.unitPrice}
                                                onChange={(value) =>
                                                    updateItem(index, {
                                                        unitPrice: value,
                                                    })
                                                }
                                                className="w-28 border-0 bg-transparent px-0 text-right text-neutral-950 shadow-none focus-visible:ring-0 dark:bg-transparent dark:text-neutral-950"
                                            />
                                            <span className="text-right text-sm font-medium">
                                                {formatPhpMoney(
                                                    amount(item.quantity) *
                                                        amount(item.unitPrice),
                                                )}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setItems(
                                                        form.data.items.filter(
                                                            (_, i) =>
                                                                i !== index,
                                                        ),
                                                    );
                                                }}
                                            >
                                                <Trash2 className="size-4 text-neutral-500" />
                                            </Button>
                                        </div>
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>
                                                {item.assignees.length === 0
                                                    ? 'Unassigned'
                                                    : `${item.assignees.length} ${item.assignees.length === 1 ? 'person' : 'people'}`}
                                            </span>
                                            <span>
                                                {formatPhpMoney(
                                                    amount(item.quantity) *
                                                        amount(item.unitPrice),
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-5 space-y-2 border-t border-dashed border-neutral-400 pt-3 text-sm">
                                <div className="flex items-center justify-between">
                                    <Label className="font-mono text-neutral-500">
                                        SERVICE CHARGE
                                    </Label>
                                    <MoneyInput
                                        value={form.data.service_charge}
                                        onChange={(value) =>
                                            form.setData(
                                                'service_charge',
                                                value,
                                            )
                                        }
                                        className="w-32 border-0 bg-transparent px-0 text-right text-neutral-950 shadow-none focus-visible:ring-0 dark:bg-transparent dark:text-neutral-950"
                                    />
                                </div>
                                <div className="flex justify-between text-neutral-500">
                                    <span>SUBTOTAL</span>
                                    <span className="text-neutral-950">
                                        {formatPhpMoney(subtotal)}
                                    </span>
                                </div>
                                <div className="flex justify-between border-t border-dashed border-neutral-400 pt-2 text-base font-bold">
                                    <span>TOTAL</span>
                                    <span>{formatPhpMoney(total)}</span>
                                </div>
                                <p className="pt-4 text-center text-[11px] text-neutral-500">
                                    *** thank you for using Penny ***
                                </p>
                            </div>
                        </div>
                        <div className="space-y-4 rounded-lg border p-4">
                            <div className="space-y-3 border-b pb-4">
                                <h3 className="font-medium">
                                    Transaction details
                                </h3>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="sm:col-span-2">
                                        <TransactionDateSelector
                                            id="bill-date"
                                            value={form.data.date}
                                            onChange={(value) =>
                                                form.setData('date', value)
                                            }
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <Label htmlFor="bill-description">
                                            Description
                                        </Label>
                                        <Input
                                            id="bill-description"
                                            value={form.data.description}
                                            onChange={(e) =>
                                                form.setData(
                                                    'description',
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="Dinner"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label>Paid from</Label>
                                    <SearchableCombobox
                                        ariaLabel="Bill payment account"
                                        value={
                                            form.data.payment_account_id || null
                                        }
                                        onChange={(value) =>
                                            form.setData(
                                                'payment_account_id',
                                                Number(value),
                                            )
                                        }
                                        options={paymentAccounts}
                                        placeholder="Search accounts…"
                                    />
                                    <ProjectedBalance
                                        balance={payment?.balance}
                                        delta={total > 0 ? -total : null}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="bill-note">Note</Label>
                                    <Input
                                        id="bill-note"
                                        value={form.data.note}
                                        onChange={(e) =>
                                            form.setData('note', e.target.value)
                                        }
                                    />
                                </div>
                            </div>
                            <div>
                                <h3 className="font-medium">People</h3>
                                <p className="text-xs text-muted-foreground">
                                    Add everyone, then choose all the items each
                                    person had.
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <div className="min-w-0 flex-1">
                                    <SearchableCombobox
                                        ariaLabel="Add participant"
                                        value={pendingParticipant}
                                        onChange={setPendingParticipant}
                                        searchValue={personSearch}
                                        onSearchValueChange={setPersonSearch}
                                        options={assigneeOptions}
                                        placeholder="Search or type a person…"
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={
                                        pendingParticipant === null &&
                                        personSearch.trim() === ''
                                    }
                                    onClick={addPerson}
                                >
                                    Add
                                </Button>
                            </div>
                            {participants.length > 0 ? (
                                <div className="space-y-3">
                                    {participants.map((participant) => {
                                        const personSubtotal =
                                            participantSubtotal(participant);
                                        const serviceShare =
                                            subtotal > 0
                                                ? (service * personSubtotal) /
                                                  subtotal
                                                : 0;
                                        const participantKey =
                                            assigneeKey(participant);
                                        const assignedItems =
                                            form.data.items.filter((item) =>
                                                item.assignees.some((a) =>
                                                    sameAssignee(
                                                        a,
                                                        participant,
                                                    ),
                                                ),
                                            );
                                        return (
                                            <section
                                                key={participantKey}
                                                data-assignment-zone="person"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    handlePersonClick(
                                                        participant,
                                                    );
                                                }}
                                                className={`rounded-md border p-3 transition ${
                                                    assignmentFocus?.type ===
                                                        'person' &&
                                                    assignmentFocus.key ===
                                                        participantKey
                                                        ? 'border-emerald-500/40 bg-emerald-500/15'
                                                        : assignmentFocus?.type ===
                                                            'person'
                                                          ? 'opacity-40'
                                                          : assignmentFocus?.type ===
                                                                  'item' &&
                                                              form.data.items
                                                                  .find(
                                                                      (item) =>
                                                                          item.key ===
                                                                          assignmentFocus.key,
                                                                  )
                                                                  ?.assignees.some(
                                                                      (a) =>
                                                                          sameAssignee(
                                                                              a,
                                                                              participant,
                                                                          ),
                                                                  )
                                                            ? 'border-emerald-500/40 bg-emerald-500/15'
                                                            : ''
                                                }`}
                                            >
                                                <div className="mb-2 flex items-start justify-between gap-3">
                                                    <div>
                                                        <h4 className="font-medium">
                                                            {(assignmentFocus?.type ===
                                                                'person' &&
                                                                assignmentFocus.key ===
                                                                    participantKey) ||
                                                            (assignmentFocus?.type ===
                                                                'item' &&
                                                                form.data.items
                                                                    .find(
                                                                        (
                                                                            item,
                                                                        ) =>
                                                                            item.key ===
                                                                            assignmentFocus.key,
                                                                    )
                                                                    ?.assignees.some(
                                                                        (a) =>
                                                                            sameAssignee(
                                                                                a,
                                                                                participant,
                                                                            ),
                                                                    )) ? (
                                                                <Check className="mr-1 inline size-4 text-emerald-500" />
                                                            ) : null}
                                                            {participant.type ===
                                                            'allocation'
                                                                ? 'Me'
                                                                : participant.label}
                                                        </h4>
                                                        <p className="text-xs text-muted-foreground tabular-nums">
                                                            Items{' '}
                                                            {formatPhpMoney(
                                                                personSubtotal,
                                                            )}
                                                            {service > 0
                                                                ? ` + service ${formatPhpMoney(serviceShare)}`
                                                                : ''}{' '}
                                                            ={' '}
                                                            <strong className="text-foreground">
                                                                {formatPhpMoney(
                                                                    personSubtotal +
                                                                        serviceShare,
                                                                )}
                                                            </strong>
                                                        </p>
                                                    </div>
                                                    {participant.type !==
                                                    'allocation' ? (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            aria-label={`Remove ${participant.label}`}
                                                            onClick={(
                                                                event,
                                                            ) => {
                                                                event.stopPropagation();
                                                                removeParticipant(
                                                                    participant,
                                                                );
                                                            }}
                                                        >
                                                            <X className="size-4" />
                                                        </Button>
                                                    ) : null}
                                                </div>
                                                {participant.type ===
                                                'allocation' ? (
                                                    <div
                                                        className="mb-2"
                                                        onClick={(event) =>
                                                            event.stopPropagation()
                                                        }
                                                    >
                                                        <SearchableCombobox
                                                            ariaLabel="My allocation"
                                                            value={
                                                                participant.id ||
                                                                null
                                                            }
                                                            onChange={
                                                                changeOwnerAllocation
                                                            }
                                                            options={
                                                                allocations
                                                            }
                                                            placeholder="Choose my allocation…"
                                                        />
                                                    </div>
                                                ) : null}
                                                {assignedItems.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {assignedItems.map(
                                                            (item) => {
                                                                const assignment =
                                                                    item.assignees.find(
                                                                        (
                                                                            assignee,
                                                                        ) =>
                                                                            sameAssignee(
                                                                                assignee,
                                                                                participant,
                                                                            ),
                                                                    );
                                                                const shares =
                                                                    assignment?.shares ??
                                                                    1;
                                                                const totalShares =
                                                                    item.assignees.reduce(
                                                                        (
                                                                            total,
                                                                            assignee,
                                                                        ) =>
                                                                            total +
                                                                            (assignee.shares ??
                                                                                1),
                                                                        0,
                                                                    );
                                                                const share =
                                                                    (amount(
                                                                        item.quantity,
                                                                    ) *
                                                                        amount(
                                                                            item.unitPrice,
                                                                        ) *
                                                                        shares) /
                                                                    totalShares;
                                                                const itemIndex =
                                                                    form.data.items.findIndex(
                                                                        (
                                                                            current,
                                                                        ) =>
                                                                            current.key ===
                                                                            item.key,
                                                                    );

                                                                return (
                                                                    <Badge
                                                                        key={
                                                                            item.key
                                                                        }
                                                                        variant="secondary"
                                                                        className="max-w-full gap-1.5 font-normal"
                                                                    >
                                                                        <span className="max-w-40 truncate">
                                                                            {
                                                                                item.description
                                                                            }
                                                                        </span>
                                                                        <span className="tabular-nums opacity-70">
                                                                            {formatPhpMoney(
                                                                                share,
                                                                            )}
                                                                        </span>
                                                                        <span className="ml-0.5 flex items-center rounded-sm border bg-background/70">
                                                                            <button
                                                                                type="button"
                                                                                aria-label={`Remove one share of ${item.description} from ${participant.label}`}
                                                                                disabled={
                                                                                    shares <=
                                                                                    1
                                                                                }
                                                                                className="px-1 disabled:cursor-not-allowed disabled:opacity-30"
                                                                                onClick={(
                                                                                    event,
                                                                                ) => {
                                                                                    event.stopPropagation();
                                                                                    changeItemShares(
                                                                                        itemIndex,
                                                                                        participant,
                                                                                        -1,
                                                                                    );
                                                                                }}
                                                                            >
                                                                                −
                                                                            </button>
                                                                            <span className="min-w-4 text-center tabular-nums">
                                                                                {
                                                                                    shares
                                                                                }

                                                                                ×
                                                                            </span>
                                                                            <button
                                                                                type="button"
                                                                                aria-label={`Add one share of ${item.description} to ${participant.label}`}
                                                                                className="px-1"
                                                                                onClick={(
                                                                                    event,
                                                                                ) => {
                                                                                    event.stopPropagation();
                                                                                    changeItemShares(
                                                                                        itemIndex,
                                                                                        participant,
                                                                                        1,
                                                                                    );
                                                                                }}
                                                                            >
                                                                                +
                                                                            </button>
                                                                        </span>
                                                                    </Badge>
                                                                );
                                                            },
                                                        )}
                                                    </div>
                                                ) : null}
                                            </section>
                                        );
                                    })}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </>
            )}
            <div className={splitBill ? 'hidden' : ''}>
                <Label htmlFor="purchase-note">Note</Label>
                <Input
                    id="purchase-note"
                    value={form.data.note}
                    onChange={(e) => form.setData('note', e.target.value)}
                />
            </div>
            {Object.keys(form.errors).length > 0 ? (
                <p className="text-sm text-destructive">
                    {Object.values(form.errors)[0]}
                </p>
            ) : null}
            <DialogFooter>
                <Button type="submit" disabled={!valid || form.processing}>
                    {splitBill ? 'Save bill split' : 'Record purchase'}
                </Button>
            </DialogFooter>
        </form>
    );

    if (presentation === 'page') {
        return formContent;
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                {formContent}
            </DialogContent>
        </Dialog>
    );
}
