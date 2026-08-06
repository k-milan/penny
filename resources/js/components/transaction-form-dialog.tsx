import TransactionController from '@/actions/App/Http/Controllers/TransactionController';
import InputError from '@/components/input-error';
import { MoneyInput } from '@/components/money-input';
import {
    ProjectedBalance,
    SearchableCombobox,
} from '@/components/searchable-combobox';
import type { TransactionCreateKind } from '@/components/transaction-create-result-dialog';
import { TransactionDateSelector } from '@/components/transaction-date-selector';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatPhpMoney } from '@/lib/format';
import {
    renderGroupedAccountOptions,
    renderGroupedAllocationOptions,
} from '@/lib/grouped-options';
import { cn } from '@/lib/utils';
import { useForm } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, Plus, Trash2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

export type AccountOption = {
    id: number;
    name: string;
    type: string;
    balance: string;
    is_pinned?: boolean;
};

export type AllocationOption = {
    id: number;
    name: string;
    type: string;
    balance: string;
    is_pinned?: boolean;
    is_unallocated?: boolean;
    due_date?: string | null;
    due_day?: number | null;
    goal_amount?: string | null;
};

export type TransactionFormModel = {
    id: number;
    date: string;
    description: string;
    note: string | null;
    accounts: {
        account_id: number;
        amount: string;
        account?: { id: number; name: string; type?: string; balance?: string };
    }[];
    allocations: {
        allocation_id: number;
        amount: string;
        allocation?: {
            id: number;
            name: string;
            type?: string;
            balance?: string;
        };
    }[];
};

type LineAccount = { account_id: number; amount: string };
type LineAllocation = { allocation_id: number; amount: string };

function accountOptionsForRow(
    accountList: AccountOption[],
    rows: LineAccount[],
    rowIndex: number,
): AccountOption[] {
    const otherIds = new Set(
        rows
            .map((r, j) => (j !== rowIndex ? r.account_id : null))
            .filter((id): id is number => id != null && id > 0),
    );
    const current = rows[rowIndex]?.account_id;
    return accountList.filter((a) => a.id === current || !otherIds.has(a.id));
}

function sumLineAmounts(lines: { amount: string }[]): number {
    let sum = 0;
    for (const line of lines) {
        const raw = line.amount.trim();
        if (raw === '' || raw === '-') {
            continue;
        }
        const n = Number.parseFloat(raw);
        if (Number.isFinite(n)) {
            sum += n;
        }
    }
    return sum;
}

function allocationOptionsForRow(
    choices: AllocationOption[],
    rows: LineAllocation[],
    rowIndex: number,
): AllocationOption[] {
    const otherIds = new Set(
        rows
            .map((r, j) => (j !== rowIndex ? r.allocation_id : null))
            .filter((id): id is number => id != null && id > 0),
    );
    const current = rows[rowIndex]?.allocation_id;
    return choices.filter((a) => a.id === current || !otherIds.has(a.id));
}

export type CreateDialogPreset =
    | 'default'
    | 'transfer'
    | 'credit_card'
    | 'loan';

function initialFormData(
    mode: 'create' | 'edit',
    transaction: TransactionFormModel | null,
    accounts: AccountOption[],
    allocations: AllocationOption[],
    createPreset: CreateDialogPreset = 'default',
): {
    date: string;
    description: string;
    note: string;
    accounts: LineAccount[];
    allocations: LineAllocation[];
} {
    if (mode === 'edit' && transaction) {
        const accountRows = Array.isArray(transaction.accounts)
            ? transaction.accounts
            : [];
        const allocationRows = Array.isArray(transaction.allocations)
            ? transaction.allocations
            : [];
        return {
            date: transaction.date,
            description: transaction.description,
            note: transaction.note ?? '',
            accounts: accountRows.map((a) => ({
                account_id: a.account_id,
                amount: a.amount,
            })),
            allocations: allocationRows.map((a) => ({
                allocation_id: a.allocation_id,
                amount: a.amount,
            })),
        };
    }

    const today = new Date().toISOString().slice(0, 10);
    if (createPreset === 'transfer') {
        return {
            date: today,
            description: 'Transfer',
            note: '',
            accounts: [],
            allocations: [],
        };
    }
    if (createPreset === 'credit_card') {
        return {
            date: today,
            description: '',
            note: '',
            accounts: [],
            allocations: [],
        };
    }
    if (createPreset === 'loan') {
        return {
            date: today,
            description: 'Loan',
            note: '',
            accounts: [],
            allocations: [],
        };
    }

    return {
        date: today,
        description: '',
        note: '',
        accounts:
            accounts.length > 0
                ? [{ account_id: accounts[0].id, amount: '' }]
                : [],
        allocations: [],
    };
}

function normalizeForSubmit(data: {
    date: string;
    description: string;
    note: string;
    accounts: LineAccount[];
    allocations: LineAllocation[];
}) {
    return {
        date: data.date,
        description: data.description,
        note: data.note === '' ? null : data.note,
        accounts: data.accounts.map((row) => ({
            account_id: row.account_id,
            amount: row.amount,
        })),
        allocations: data.allocations.map((row) => ({
            allocation_id: row.allocation_id,
            amount: row.amount,
        })),
    };
}

type TransferKind = 'account' | 'allocation';

function formatSignedTransferAmounts(
    magnitude: string,
): { neg: string; pos: string } | null {
    const raw = magnitude.trim();
    if (raw === '' || raw === '-') {
        return null;
    }
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n) || n <= 0) {
        return null;
    }
    const s = n.toFixed(2);
    return { neg: `-${s}`, pos: s };
}

/** Empty / zero → 0; positive → fee amount; invalid input → null. */
function parseOptionalTransferFee(raw: string): number | null {
    const t = raw.trim();
    if (t === '' || t === '-') {
        return 0;
    }
    const n = Number.parseFloat(t);
    if (!Number.isFinite(n) || n < 0) {
        return null;
    }
    return n;
}

function buildTransferForSubmit(
    base: { date: string; description: string; note: string },
    kind: TransferKind,
    fromId: number,
    toId: number,
    transferAmount: string,
    transferFeeAmount: string,
    feeAllocationId: number,
    unallocatedAllocationId: number | null,
): {
    date: string;
    description: string;
    note: string | null;
    accounts: LineAccount[];
    allocations: LineAllocation[];
} {
    const empty = {
        date: base.date,
        description: base.description,
        note: base.note === '' ? null : base.note,
        accounts: [] as LineAccount[],
        allocations: [] as LineAllocation[],
    };
    const pair = formatSignedTransferAmounts(transferAmount);
    if (pair === null || fromId === toId) {
        return empty;
    }
    if (kind === 'account') {
        const feeVal = parseOptionalTransferFee(transferFeeAmount);
        if (feeVal === null) {
            return empty;
        }
        if (feeVal === 0) {
            return {
                ...empty,
                accounts: [
                    { account_id: fromId, amount: pair.neg },
                    { account_id: toId, amount: pair.pos },
                ],
            };
        }
        const feeAlloc =
            feeAllocationId > 0 ? feeAllocationId : unallocatedAllocationId;
        if (feeAlloc === null || feeAlloc <= 0) {
            return empty;
        }
        const received = Number.parseFloat(pair.pos);
        const sentTotal = (received + feeVal).toFixed(2);
        const feeStr = (-feeVal).toFixed(2);
        return {
            ...empty,
            accounts: [
                { account_id: fromId, amount: `-${sentTotal}` },
                { account_id: toId, amount: pair.pos },
            ],
            allocations: [{ allocation_id: feeAlloc, amount: feeStr }],
        };
    }
    return {
        ...empty,
        allocations: [
            { allocation_id: fromId, amount: pair.neg },
            { allocation_id: toId, amount: pair.pos },
        ],
    };
}

/** One funding account for a card payment (money leaves this account). */
export type CardPaymentSplitRow = {
    key: string;
    accountId: number;
    amount: string;
};

function newCreditSplitKey(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `cc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function cardPaymentSourceOptionsForRow(
    sources: AccountOption[],
    rows: CardPaymentSplitRow[],
    rowIndex: number,
): AccountOption[] {
    const otherIds = new Set(
        rows
            .map((r, j) => (j !== rowIndex ? r.accountId : null))
            .filter((id): id is number => id != null && id > 0),
    );
    const current = rows[rowIndex]?.accountId;
    return sources.filter((a) => a.id === current || !otherIds.has(a.id));
}

/** Card charge: card negative, person lines positive, allocation lines negative. UI uses positive magnitudes. */
type CardPurchaseAllocSplit = {
    allocationId: number;
    amount: string;
};

function buildCardPurchaseForSubmit(
    cardId: number,
    personSplits: CardPaymentSplitRow[],
    allocSplits: CardPurchaseAllocSplit[],
    validPersonAccountIds: Set<number>,
): { accounts: LineAccount[]; allocations: LineAllocation[] } | null {
    if (cardId <= 0) {
        return null;
    }
    let personTotal = 0;
    const personLines: LineAccount[] = [];
    for (const s of personSplits) {
        if (s.accountId <= 0 || !validPersonAccountIds.has(s.accountId)) {
            return null;
        }
        const raw = s.amount.trim();
        if (raw === '' || raw === '-') {
            return null;
        }
        const n = Number.parseFloat(raw);
        if (!Number.isFinite(n) || n <= 0) {
            return null;
        }
        personTotal += n;
        personLines.push({
            account_id: s.accountId,
            amount: n.toFixed(2),
        });
    }
    let allocMagTotal = 0;
    const allocLines: LineAllocation[] = [];
    for (const s of allocSplits) {
        if (s.allocationId <= 0) {
            return null;
        }
        const raw = s.amount.trim();
        if (raw === '' || raw === '-') {
            return null;
        }
        const n = Number.parseFloat(raw);
        if (!Number.isFinite(n) || n <= 0) {
            return null;
        }
        allocMagTotal += n;
        allocLines.push({
            allocation_id: s.allocationId,
            amount: (-n).toFixed(2),
        });
    }
    if (personTotal <= 0 && allocMagTotal <= 0) {
        return null;
    }
    const cardTotal = personTotal + allocMagTotal;
    if (cardTotal <= 0) {
        return null;
    }
    const accounts: LineAccount[] = [
        { account_id: cardId, amount: (-cardTotal).toFixed(2) },
        ...personLines,
    ];
    return { accounts, allocations: allocLines };
}

/** Pay down card debt: positive on the card, negative on funding accounts (no allocation lines). */
function buildCardPaymentForSubmit(
    cardId: number,
    splits: CardPaymentSplitRow[],
): { accounts: LineAccount[]; allocations: LineAllocation[] } | null {
    if (cardId <= 0) {
        return null;
    }
    const parsed: { accountId: number; value: number }[] = [];
    for (const s of splits) {
        if (s.accountId <= 0) {
            return null;
        }
        const raw = s.amount.trim();
        if (raw === '' || raw === '-') {
            return null;
        }
        const n = Number.parseFloat(raw);
        if (!Number.isFinite(n) || n <= 0) {
            return null;
        }
        parsed.push({ accountId: s.accountId, value: n });
    }
    if (parsed.length === 0) {
        return null;
    }
    let total = 0;
    for (const p of parsed) {
        total += p.value;
    }
    if (total <= 0) {
        return null;
    }
    const accounts: LineAccount[] = [
        { account_id: cardId, amount: total.toFixed(2) },
    ];
    for (const p of parsed) {
        accounts.push({
            account_id: p.accountId,
            amount: (-p.value).toFixed(2),
        });
    }
    return { accounts, allocations: [] };
}

export type LoanPersonDirection =
    | 'i_paid_them'
    | 'they_owe_me'
    | 'they_paid_me'
    | 'i_owe_them';

/** True for directions where the person line is recorded as positive. */
function isLoanPersonPositive(d: LoanPersonDirection): boolean {
    return d === 'i_paid_them' || d === 'they_owe_me';
}

function parsePositiveMagnitude(raw: string): number | null {
    const t = raw.trim();
    if (t === '' || t === '-') {
        return null;
    }
    const n = Number.parseFloat(t);
    if (!Number.isFinite(n) || n <= 0) {
        return null;
    }
    return n;
}

function positiveMagnitudeOrZero(raw: string): number {
    return parsePositiveMagnitude(raw) ?? 0;
}

/** Signed person line from one person + direction + positive UI amount. */
function loanPersonSignedFromState(
    personId: number,
    direction: LoanPersonDirection,
    amountStr: string,
): number | null {
    if (personId <= 0) {
        return null;
    }
    const m = parsePositiveMagnitude(amountStr);
    if (m === null) {
        return null;
    }
    return isLoanPersonPositive(direction) ? m : -m;
}

function sumLoanFundingEffective(
    rows: LineAccount[],
    direction: LoanPersonDirection,
): number | null {
    let s = 0;
    for (const row of rows) {
        if (row.account_id <= 0) {
            return null;
        }
        const m = parsePositiveMagnitude(row.amount);
        if (m === null) {
            return null;
        }
        s += isLoanPersonPositive(direction) ? -m : m;
    }
    return s;
}

function sumLoanAllocEffective(
    rows: LineAllocation[],
    accountTotal: number | null,
): number | null {
    if (accountTotal === null) {
        return null;
    }

    let s = 0;
    for (const row of rows) {
        if (row.allocation_id <= 0) {
            return null;
        }
        const m = parsePositiveMagnitude(row.amount);
        if (m === null) {
            return null;
        }
        s += accountTotal < 0 ? -m : m;
    }
    return s;
}

/**
 * One person + funding accounts + allocations. UI amounts are positive magnitudes;
 * funding sign opposes the person line; allocation sign matches the net account
 * total so both ledger sides balance.
 */
function buildLoanForSubmit(
    personId: number,
    direction: LoanPersonDirection,
    personAmountStr: string,
    fundingAccountRows: LineAccount[],
    allocationRows: LineAllocation[],
): { accounts: LineAccount[]; allocations: LineAllocation[] } | null {
    if (
        loanPersonSignedFromState(personId, direction, personAmountStr) === null
    ) {
        return null;
    }
    const pMag = parsePositiveMagnitude(personAmountStr)!;
    const personLines: LineAccount[] = [
        {
            account_id: personId,
            amount: isLoanPersonPositive(direction)
                ? pMag.toFixed(2)
                : (-pMag).toFixed(2),
        },
    ];
    const funding: LineAccount[] = [];
    for (const row of fundingAccountRows) {
        if (row.account_id <= 0) {
            return null;
        }
        const m = parsePositiveMagnitude(row.amount);
        if (m === null) {
            return null;
        }
        const signed = isLoanPersonPositive(direction) ? -m : m;
        funding.push({
            account_id: row.account_id,
            amount: signed.toFixed(2),
        });
    }
    const allAccounts = [...personLines, ...funding];
    let accountTotal = 0;
    for (const account of allAccounts) {
        accountTotal += Number.parseFloat(account.amount);
    }

    const allocations: LineAllocation[] = [];
    for (const row of allocationRows) {
        if (row.allocation_id <= 0) {
            return null;
        }
        const m = parsePositiveMagnitude(row.amount);
        if (m === null) {
            return null;
        }
        const signed = accountTotal < 0 ? -m : m;
        allocations.push({
            allocation_id: row.allocation_id,
            amount: signed.toFixed(2),
        });
    }
    if (funding.length === 0 && allocations.length === 0) {
        return null;
    }
    let lSum = 0;
    for (const x of allocations) {
        lSum += Number.parseFloat(x.amount);
    }
    if (Math.abs(accountTotal - lSum) > 0.015) {
        return null;
    }
    return { accounts: allAccounts, allocations };
}

type FlatErrors = Record<string, string | undefined>;

function formFieldError(
    errors: Record<string, string | string[] | undefined> | undefined,
    key: string,
): string | undefined {
    if (!errors) {
        return undefined;
    }
    const e = (errors as FlatErrors)[key];
    if (e === undefined) {
        return undefined;
    }
    if (Array.isArray(e)) {
        return e[0];
    }
    return e;
}

export function TransactionFormDialog({
    open,
    onOpenChange,
    mode,
    transaction,
    accounts: accountsProp,
    allocations: allocationsProp,
    createPreset = 'default',
    unallocatedAllocationId: unallocatedAllocationIdProp = null,
    onBackToCreateChoice,
    onCreateSuccess,
    onCreateFailure,
    initialCreditCardTab = 'purchase',
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: 'create' | 'edit';
    transaction: TransactionFormModel | null;
    accounts: AccountOption[];
    allocations: AllocationOption[];
    createPreset?: CreateDialogPreset;
    /** System “Unallocated” allocation id (for transfer fees when none chosen). */
    unallocatedAllocationId?: number | null;
    onBackToCreateChoice?: () => void;
    onCreateSuccess?: (kind: TransactionCreateKind) => void;
    onCreateFailure?: (kind: TransactionCreateKind) => void;
    initialCreditCardTab?: 'payment' | 'purchase';
}) {
    const accountList = useMemo(
        () => (Array.isArray(accountsProp) ? accountsProp : []),
        [accountsProp],
    );
    const allocationList = useMemo(
        () => (Array.isArray(allocationsProp) ? allocationsProp : []),
        [allocationsProp],
    );

    const form = useForm({
        date: '',
        description: '',
        note: '',
        accounts: [] as LineAccount[],
        allocations: [] as LineAllocation[],
    });
    const [pendingFieldFocusId, setPendingFieldFocusId] = useState<
        string | null
    >(null);

    useLayoutEffect(() => {
        if (pendingFieldFocusId === null) {
            return;
        }

        document.getElementById(pendingFieldFocusId)?.focus();
        setPendingFieldFocusId(null);
    }, [
        pendingFieldFocusId,
        form.data.accounts.length,
        form.data.allocations.length,
    ]);

    const unallocatedAllocationId =
        typeof unallocatedAllocationIdProp === 'number' &&
        unallocatedAllocationIdProp > 0
            ? unallocatedAllocationIdProp
            : null;

    const allocationLineOptions = allocationList.filter(
        (a) => !a.is_unallocated,
    );
    const transferAllocChoices = useMemo((): AllocationOption[] => {
        if (unallocatedAllocationId === null) {
            return allocationLineOptions;
        }
        if (
            allocationLineOptions.some((a) => a.id === unallocatedAllocationId)
        ) {
            return allocationLineOptions;
        }
        const u: AllocationOption = {
            id: unallocatedAllocationId,
            name: 'Unallocated',
            type: 'unallocated',
            balance: '',
            is_unallocated: true,
        };
        return [u, ...allocationLineOptions];
    }, [allocationLineOptions, unallocatedAllocationId]);
    const canSubmit =
        accountList.length > 0 || allocationLineOptions.length > 0;
    const canShowAccountTab = accountList.length >= 2;
    const canShowTransferAllocTab = transferAllocChoices.length >= 2;
    const canDoTransfer = canShowAccountTab || canShowTransferAllocTab;
    const isCreateTransfer = mode === 'create' && createPreset === 'transfer';
    const isCreateCredit = mode === 'create' && createPreset === 'credit_card';
    const isCreateLoan = mode === 'create' && createPreset === 'loan';

    const creditCardAccounts = useMemo(
        () => accountList.filter((a) => a.type === 'credit_card'),
        [accountList],
    );
    /** Bank, cash, person, etc. — not credit cards (funds that pay the card). */
    const cardPaymentSourceAccounts = useMemo(
        () => accountList.filter((a) => a.type !== 'credit_card'),
        [accountList],
    );

    const personAccounts = useMemo(
        () => accountList.filter((a) => a.type === 'person'),
        [accountList],
    );
    const personAccountIdSet = useMemo(
        () => new Set(personAccounts.map((a) => a.id)),
        [personAccounts],
    );
    const loanFundingAccounts = useMemo(
        () => accountList.filter((a) => a.type !== 'person'),
        [accountList],
    );

    const [transferKind, setTransferKind] = useState<TransferKind>(() =>
        accountList.length >= 2 ? 'account' : 'allocation',
    );
    const [fromAccountId, setFromAccountId] = useState(0);
    const [toAccountId, setToAccountId] = useState(0);
    const [fromAllocId, setFromAllocId] = useState(0);
    const [toAllocId, setToAllocId] = useState(0);
    const [transferAmount, setTransferAmount] = useState('');
    const [transferFeeAmount, setTransferFeeAmount] = useState('');
    const [transferFeeAllocationId, setTransferFeeAllocationId] = useState(0);

    const [creditCardId, setCreditCardId] = useState(0);
    type CreditCardTab = 'payment' | 'purchase';
    const [creditCardTab, setCreditCardTab] =
        useState<CreditCardTab>('purchase');
    const [creditSplits, setCreditSplits] = useState<CardPaymentSplitRow[]>([]);
    const [purchasePersonSplits, setPurchasePersonSplits] = useState<
        CardPaymentSplitRow[]
    >([]);
    const [purchaseAllocSplits, setPurchaseAllocSplits] = useState<
        { key: string; allocationId: number; amount: string }[]
    >([]);
    const [loanPersonId, setLoanPersonId] = useState(0);
    const [loanDirection, setLoanDirection] =
        useState<LoanPersonDirection>('i_paid_them');
    const [loanPersonAmount, setLoanPersonAmount] = useState('');

    /** Only seed from/to when the dialog opens — not on every parent re-render (new array refs would reset the allocation tab). */
    const transferDialogWasOpenRef = useRef(false);
    const creditCardDialogWasOpenRef = useRef(false);
    const loanDialogWasOpenRef = useRef(false);

    useEffect(() => {
        if (!open) {
            return;
        }
        const next = initialFormData(
            mode,
            transaction,
            accountList,
            allocationList,
            mode === 'create' ? createPreset : 'default',
        );
        form.setData(next);
    }, [open, mode, transaction?.id, createPreset]); // eslint-disable-line react-hooks/exhaustive-deps -- initial payload when dialog opens; avoid reset while typing

    useLayoutEffect(() => {
        if (!open || !isCreateTransfer) {
            if (!open) {
                transferDialogWasOpenRef.current = false;
            }
            return;
        }
        const justOpened = !transferDialogWasOpenRef.current;
        transferDialogWasOpenRef.current = true;
        if (!justOpened) {
            return;
        }
        if (canShowAccountTab) {
            setTransferKind('account');
            setFromAccountId(accountList[0]!.id);
            setToAccountId(accountList[1]!.id);
        } else if (canShowTransferAllocTab) {
            setTransferKind('allocation');
            setFromAllocId(transferAllocChoices[0]!.id);
            setToAllocId(transferAllocChoices[1]!.id);
        }
        setTransferAmount('');
        setTransferFeeAmount('');
        setTransferFeeAllocationId(0);
    }, [
        open,
        isCreateTransfer,
        canShowAccountTab,
        canShowTransferAllocTab,
        accountList,
        transferAllocChoices,
    ]);

    useLayoutEffect(() => {
        if (!open) {
            creditCardDialogWasOpenRef.current = false;
            return;
        }
        if (!isCreateCredit) {
            creditCardDialogWasOpenRef.current = false;
            return;
        }
        const justOpened = !creditCardDialogWasOpenRef.current;
        creditCardDialogWasOpenRef.current = true;
        if (!justOpened) {
            return;
        }
        setCreditCardTab(initialCreditCardTab);
        const firstCard = creditCardAccounts[0];
        setCreditCardId(firstCard?.id ?? 0);
        const firstSource = cardPaymentSourceAccounts[0];
        if (firstSource) {
            setCreditSplits([
                {
                    key: newCreditSplitKey(),
                    accountId: firstSource.id,
                    amount: '',
                },
            ]);
        } else {
            setCreditSplits([]);
        }
        setPurchasePersonSplits([]);
        const alloc0 = allocationLineOptions[0];
        if (alloc0) {
            setPurchaseAllocSplits([
                {
                    key: newCreditSplitKey(),
                    allocationId: alloc0.id,
                    amount: '',
                },
            ]);
        } else {
            setPurchaseAllocSplits([]);
        }
    }, [
        open,
        isCreateCredit,
        initialCreditCardTab,
        creditCardAccounts,
        cardPaymentSourceAccounts,
        personAccounts,
        allocationLineOptions,
    ]);

    useLayoutEffect(() => {
        if (!open) {
            loanDialogWasOpenRef.current = false;
            return;
        }
        if (!isCreateLoan) {
            loanDialogWasOpenRef.current = false;
            return;
        }
        const justOpened = !loanDialogWasOpenRef.current;
        loanDialogWasOpenRef.current = true;
        if (!justOpened) {
            return;
        }
        const p0 = personAccounts[0];
        if (p0) {
            setLoanPersonId(p0.id);
            setLoanDirection('i_paid_them');
            setLoanPersonAmount('');
        } else {
            setLoanPersonId(0);
            setLoanDirection('i_paid_them');
            setLoanPersonAmount('');
        }
    }, [open, isCreateLoan, personAccounts]);

    const usedAccountIds = new Set(
        form.data.accounts.map((r) => r.account_id).filter((id) => id > 0),
    );
    const canAddAccountLine = accountList.some(
        (a) => !usedAccountIds.has(a.id),
    );
    const usedAllocationIds = new Set(
        form.data.allocations
            .map((r) => r.allocation_id)
            .filter((id) => id > 0),
    );
    const canAddAllocationLine = allocationLineOptions.some(
        (a) => !usedAllocationIds.has(a.id),
    );
    const usedLoanFundingIds = new Set(
        form.data.accounts.map((r) => r.account_id).filter((id) => id > 0),
    );
    const canAddLoanFundingLine = loanFundingAccounts.some(
        (a) => !usedLoanFundingIds.has(a.id),
    );

    const transferFromId =
        transferKind === 'account' ? fromAccountId : fromAllocId;
    const transferToId = transferKind === 'account' ? toAccountId : toAllocId;
    const transferFromToDistinct =
        transferFromId > 0 &&
        transferToId > 0 &&
        transferFromId !== transferToId;
    const transferAmountValid =
        formatSignedTransferAmounts(transferAmount) !== null;
    const transferFeeParsed = useMemo(
        () => parseOptionalTransferFee(transferFeeAmount),
        [transferFeeAmount],
    );
    const transferFeeInputInvalid =
        transferKind === 'account' && transferFeeParsed === null;
    const transferFeeNeedsUnallocatedId =
        transferKind === 'account' &&
        transferFeeParsed !== null &&
        transferFeeParsed > 0 &&
        transferFeeAllocationId <= 0;
    const transferFeeUnallocatedMissing =
        transferFeeNeedsUnallocatedId && unallocatedAllocationId === null;
    const canSubmitTransfer =
        isCreateTransfer &&
        canDoTransfer &&
        (transferKind === 'account'
            ? canShowAccountTab
            : canShowTransferAllocTab) &&
        transferFromToDistinct &&
        transferAmountValid &&
        !transferFeeInputInvalid &&
        !transferFeeUnallocatedMissing;

    const creditPaymentBuild = useMemo(
        () => buildCardPaymentForSubmit(creditCardId, creditSplits),
        [creditCardId, creditSplits],
    );
    const creditPurchaseBuild = useMemo(
        () =>
            buildCardPurchaseForSubmit(
                creditCardId,
                purchasePersonSplits,
                purchaseAllocSplits.map((s) => ({
                    allocationId: s.allocationId,
                    amount: s.amount,
                })),
                personAccountIdSet,
            ),
        [
            creditCardId,
            purchasePersonSplits,
            purchaseAllocSplits,
            personAccountIdSet,
        ],
    );
    const creditPaymentTotal = useMemo(
        () =>
            creditSplits.reduce(
                (sum, row) => sum + positiveMagnitudeOrZero(row.amount),
                0,
            ),
        [creditSplits],
    );
    const creditPurchaseTotal = useMemo(
        () =>
            purchasePersonSplits.reduce(
                (sum, row) => sum + positiveMagnitudeOrZero(row.amount),
                0,
            ) +
            purchaseAllocSplits.reduce(
                (sum, row) => sum + positiveMagnitudeOrZero(row.amount),
                0,
            ),
        [purchasePersonSplits, purchaseAllocSplits],
    );
    const creditCard = creditCardAccounts.find((a) => a.id === creditCardId);
    const canSubmitCredit =
        isCreateCredit &&
        creditCardAccounts.length > 0 &&
        creditCardId > 0 &&
        (form.data.description?.trim() ?? '') !== '' &&
        (creditCardTab === 'payment'
            ? cardPaymentSourceAccounts.length > 0 &&
              creditPaymentBuild !== null
            : creditPurchaseBuild !== null);

    const loanPersonSignedTotal = useMemo(
        () =>
            loanPersonSignedFromState(
                loanPersonId,
                loanDirection,
                loanPersonAmount,
            ),
        [loanPersonId, loanDirection, loanPersonAmount],
    );
    const loanFundingRunning = useMemo(
        () => sumLoanFundingEffective(form.data.accounts, loanDirection),
        [form.data.accounts, loanDirection],
    );
    const loanAccountRunning =
        loanPersonSignedTotal !== null && loanFundingRunning !== null
            ? loanPersonSignedTotal + loanFundingRunning
            : null;
    const loanAllocRunning = useMemo(
        () => sumLoanAllocEffective(form.data.allocations, loanAccountRunning),
        [form.data.allocations, loanAccountRunning],
    );
    const loanBalanceGap =
        loanAccountRunning !== null && loanAllocRunning !== null
            ? loanAccountRunning - loanAllocRunning
            : null;

    const loanBuild = useMemo(
        () =>
            isCreateLoan
                ? buildLoanForSubmit(
                      loanPersonId,
                      loanDirection,
                      loanPersonAmount,
                      form.data.accounts,
                      form.data.allocations,
                  )
                : null,
        [
            isCreateLoan,
            loanPersonId,
            loanDirection,
            loanPersonAmount,
            form.data.accounts,
            form.data.allocations,
        ],
    );
    const canSubmitLoan =
        isCreateLoan &&
        personAccounts.length > 0 &&
        loanBuild !== null &&
        (form.data.description?.trim() ?? '') !== '';

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const createKind: TransactionCreateKind = isCreateTransfer
            ? 'transfer'
            : isCreateCredit
              ? creditCardTab === 'payment'
                  ? 'credit_card_payment'
                  : 'credit_card_purchase'
              : isCreateLoan
                ? 'loan'
                : 'transaction';
        if (isCreateCredit) {
            if (!canSubmitCredit) {
                return;
            }
        } else if (isCreateTransfer) {
            if (!canDoTransfer) {
                return;
            }
            if (!canSubmitTransfer) {
                return;
            }
        } else if (isCreateLoan) {
            if (!canSubmitLoan) {
                return;
            }
        } else if (!canSubmit) {
            return;
        }
        form.clearErrors();
        if (isCreateCredit) {
            const built =
                creditCardTab === 'payment'
                    ? buildCardPaymentForSubmit(creditCardId, creditSplits)
                    : buildCardPurchaseForSubmit(
                          creditCardId,
                          purchasePersonSplits,
                          purchaseAllocSplits.map((s) => ({
                              allocationId: s.allocationId,
                              amount: s.amount,
                          })),
                          personAccountIdSet,
                      );
            if (built === null) {
                return;
            }
            form.transform(() =>
                normalizeForSubmit({
                    date: form.data.date,
                    description: form.data.description,
                    note: form.data.note,
                    accounts: built.accounts,
                    allocations: built.allocations,
                }),
            );
        } else if (isCreateTransfer) {
            const built = buildTransferForSubmit(
                {
                    date: form.data.date,
                    description: form.data.description,
                    note: form.data.note,
                },
                transferKind,
                transferFromId,
                transferToId,
                transferAmount,
                transferFeeAmount,
                transferFeeAllocationId,
                unallocatedAllocationId,
            );
            form.transform(() =>
                normalizeForSubmit({
                    date: form.data.date,
                    description: form.data.description,
                    note: form.data.note,
                    accounts: built.accounts,
                    allocations: built.allocations,
                }),
            );
        } else if (isCreateLoan) {
            const built = buildLoanForSubmit(
                loanPersonId,
                loanDirection,
                loanPersonAmount,
                form.data.accounts,
                form.data.allocations,
            );
            if (built === null) {
                return;
            }
            form.transform(() =>
                normalizeForSubmit({
                    date: form.data.date,
                    description: form.data.description,
                    note: form.data.note,
                    accounts: built.accounts,
                    allocations: built.allocations,
                }),
            );
        } else {
            form.transform((data) =>
                normalizeForSubmit(
                    data as {
                        date: string;
                        description: string;
                        note: string;
                        accounts: LineAccount[];
                        allocations: LineAllocation[];
                    },
                ),
            );
        }
        if (mode === 'create') {
            form.post(TransactionController.store.url(), {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    onOpenChange(false);
                    onCreateSuccess?.(createKind);
                },
                onError: () => {
                    onOpenChange(false);
                    onCreateFailure?.(createKind);
                },
            });
            return;
        }
        if (transaction) {
            form.patch(
                TransactionController.update.url({
                    transaction: transaction.id,
                }),
                {
                    preserveScroll: true,
                    preserveState: true,
                    onSuccess: () => onOpenChange(false),
                },
            );
        }
    };

    const selectClass =
        'border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]';
    const invalidClass =
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive';
    const err = (key: string) => formFieldError(form.errors, key);

    const accountLinesTotal = useMemo(
        () => sumLineAmounts(form.data.accounts),
        [form.data.accounts],
    );
    const allocationLinesTotal = useMemo(
        () => sumLineAmounts(form.data.allocations),
        [form.data.allocations],
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-[min(calc(100vw-2rem),42rem)] flex-col gap-4 overflow-hidden p-4 sm:max-h-[calc(100vh-64px)] sm:p-6 xl:max-w-[min(calc(100vw-2rem),48rem)]">
                <div className="shrink-0">
                    <DialogHeader className="text-left">
                        <div className="flex items-start gap-2 pr-8">
                            {mode === 'create' && onBackToCreateChoice ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="-ml-2 size-8 shrink-0"
                                    onClick={onBackToCreateChoice}
                                    aria-label="Back to transaction type"
                                >
                                    <ArrowLeft className="size-4" aria-hidden />
                                </Button>
                            ) : null}
                            <DialogTitle className="min-w-0 pt-1">
                                {mode === 'create'
                                    ? (() => {
                                          switch (createPreset) {
                                              case 'transfer':
                                                  return 'New transfer';
                                              case 'credit_card':
                                                  return 'New card transaction';
                                              case 'loan':
                                                  return 'New loan';
                                              default:
                                                  return 'New transaction';
                                          }
                                      })()
                                    : 'Edit transaction'}
                            </DialogTitle>
                        </div>
                        <DialogDescription className="sr-only">
                            {isCreateTransfer
                                ? 'Move money between two accounts or two allocations. For account transfers you can add a fee and choose which allocation it is taken from, or leave that blank to use Unallocated.'
                                : isCreateCredit
                                  ? 'Pay down the card or record a purchase: account signs follow the tab you pick (payment vs purchase).'
                                  : isCreateLoan
                                    ? 'Loan: one person (direction + amount), then fund with non-person accounts and allocations using positive amounts; Penny applies the correct signs.'
                                    : mode === 'create'
                                      ? 'Create a new transaction with account and allocation lines.'
                                      : 'Edit the account and allocation lines for this transaction.'}
                        </DialogDescription>
                    </DialogHeader>

                    {isCreateTransfer && !canDoTransfer && (
                        <p className="text-sm text-destructive">
                            Add at least two accounts or two allocations to
                            record a transfer.
                        </p>
                    )}
                    {isCreateCredit && creditCardAccounts.length === 0 && (
                        <p className="text-sm text-destructive">
                            Add a credit card account first to record this.
                        </p>
                    )}
                    {isCreateCredit &&
                        creditCardAccounts.length > 0 &&
                        cardPaymentSourceAccounts.length === 0 &&
                        creditCardTab === 'payment' && (
                            <p className="text-sm text-destructive">
                                Add at least one non–credit-card account (for
                                example checking) to pay from.
                            </p>
                        )}
                    {isCreateLoan && personAccounts.length === 0 && (
                        <p className="text-sm text-destructive">
                            Add at least one <strong>person</strong> account to
                            track who owes whom.
                        </p>
                    )}
                    {isCreateLoan &&
                        personAccounts.length > 0 &&
                        loanFundingAccounts.length === 0 &&
                        allocationLineOptions.length === 0 && (
                            <p className="text-sm text-destructive">
                                Add a non-person account or an allocation to
                                balance this loan (e.g. cash you paid out or an
                                envelope).
                            </p>
                        )}
                    {!canSubmit &&
                        !isCreateTransfer &&
                        !isCreateCredit &&
                        !isCreateLoan && (
                            <p className="text-sm text-destructive">
                                Add at least one account or allocation in Penny
                                before recording a transaction.
                            </p>
                        )}
                </div>

                <form
                    className="flex min-h-0 flex-1 flex-col gap-0"
                    onSubmit={submit}
                >
                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
                        <div className="rounded-lg border bg-muted/30 p-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="grid gap-2 sm:col-span-2">
                                    <TransactionDateSelector
                                        id="tx-date"
                                        value={form.data.date}
                                        onChange={(value) =>
                                            form.setData('date', value)
                                        }
                                        invalid={!!err('date')}
                                    />
                                    <InputError message={form.errors.date} />
                                </div>
                                <div className="grid gap-2 sm:col-span-2">
                                    <Label htmlFor="tx-desc">Description</Label>
                                    <Input
                                        id="tx-desc"
                                        name="description"
                                        value={form.data.description}
                                        onChange={(e) =>
                                            form.setData(
                                                'description',
                                                e.target.value,
                                            )
                                        }
                                        required
                                        aria-invalid={!!err('description')}
                                    />
                                    <InputError
                                        message={form.errors.description}
                                    />
                                </div>
                                <div className="grid gap-2 sm:col-span-2">
                                    <Label htmlFor="tx-note">
                                        Note (optional)
                                    </Label>
                                    <textarea
                                        id="tx-note"
                                        name="note"
                                        rows={2}
                                        className={cn(
                                            selectClass,
                                            invalidClass,
                                            'min-h-[4rem] py-2',
                                        )}
                                        value={form.data.note}
                                        onChange={(e) =>
                                            form.setData('note', e.target.value)
                                        }
                                        aria-invalid={!!err('note')}
                                    />
                                    <InputError message={form.errors.note} />
                                </div>
                            </div>
                        </div>
                        {/* end details card */}

                        {isCreateCredit ? (
                            <div className="space-y-3">
                                <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                                    {creditCardAccounts.length > 0 && (
                                        <div className="grid max-w-md gap-2">
                                            <Label>Credit card</Label>
                                            <SearchableCombobox
                                                ariaLabel="Credit card"
                                                value={creditCardId || null}
                                                onChange={(value) =>
                                                    setCreditCardId(
                                                        Number(value ?? 0),
                                                    )
                                                }
                                                options={creditCardAccounts}
                                                placeholder="Select credit card"
                                            />
                                            <ProjectedBalance
                                                balance={creditCard?.balance}
                                                delta={
                                                    creditCardTab === 'payment'
                                                        ? creditPaymentTotal
                                                        : -creditPurchaseTotal
                                                }
                                            />
                                        </div>
                                    )}
                                    <div className="grid gap-2">
                                        <span className="text-sm font-medium">
                                            Type
                                        </span>
                                        <ToggleGroup
                                            type="single"
                                            value={creditCardTab}
                                            onValueChange={(v) => {
                                                if (
                                                    v !== 'payment' &&
                                                    v !== 'purchase'
                                                ) {
                                                    return;
                                                }
                                                setCreditCardTab(v);
                                            }}
                                            variant="outline"
                                            className="w-full max-w-md justify-stretch"
                                        >
                                            <ToggleGroupItem
                                                value="purchase"
                                                className="min-w-0 flex-1 px-2"
                                            >
                                                Purchase
                                            </ToggleGroupItem>
                                            <ToggleGroupItem
                                                value="payment"
                                                className="min-w-0 flex-1 px-2"
                                            >
                                                Payment
                                            </ToggleGroupItem>
                                        </ToggleGroup>
                                    </div>
                                </div>
                                {/* end credit card config card */}
                                <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                                    {creditCardTab === 'payment' ? (
                                        <>
                                            <p className="text-sm text-muted-foreground">
                                                Pay down the card: the card line
                                                is recorded{' '}
                                                <strong>positive</strong>; each
                                                funding account is{' '}
                                                <strong>negative</strong> (bank,
                                                cash, or person).
                                            </p>
                                            <ul className="space-y-1.5">
                                                {creditSplits.map(
                                                    (row, rowIndex) => {
                                                        const sourceChoices =
                                                            cardPaymentSourceOptionsForRow(
                                                                cardPaymentSourceAccounts,
                                                                creditSplits,
                                                                rowIndex,
                                                            );
                                                        const sourceAccount =
                                                            sourceChoices.find(
                                                                (a) =>
                                                                    a.id ===
                                                                    row.accountId,
                                                            );
                                                        return (
                                                            <li
                                                                key={row.key}
                                                                className="flex items-start gap-2"
                                                            >
                                                                <div className="min-w-0 flex-1">
                                                                    <Label className="sr-only">
                                                                        Paid
                                                                        from
                                                                    </Label>
                                                                    <SearchableCombobox
                                                                        ariaLabel="Paid from"
                                                                        value={
                                                                            row.accountId ||
                                                                            null
                                                                        }
                                                                        onChange={(
                                                                            value,
                                                                        ) => {
                                                                            setCreditSplits(
                                                                                (
                                                                                    prev,
                                                                                ) =>
                                                                                    prev.map(
                                                                                        (
                                                                                            s,
                                                                                        ) =>
                                                                                            s.key ===
                                                                                            row.key
                                                                                                ? {
                                                                                                      ...s,
                                                                                                      accountId:
                                                                                                          Number(
                                                                                                              value ??
                                                                                                                  0,
                                                                                                          ),
                                                                                                  }
                                                                                                : s,
                                                                                    ),
                                                                            );
                                                                        }}
                                                                        options={
                                                                            sourceChoices
                                                                        }
                                                                        placeholder="Select account"
                                                                    />
                                                                    <ProjectedBalance
                                                                        balance={
                                                                            sourceAccount?.balance
                                                                        }
                                                                        delta={
                                                                            -positiveMagnitudeOrZero(
                                                                                row.amount,
                                                                            )
                                                                        }
                                                                    />
                                                                </div>
                                                                <div className="w-28 shrink-0">
                                                                    <Label
                                                                        className="sr-only"
                                                                        htmlFor={`cc-amt-${row.key}`}
                                                                    >
                                                                        Amount
                                                                    </Label>
                                                                    <MoneyInput
                                                                        id={`cc-amt-${row.key}`}
                                                                        value={
                                                                            row.amount
                                                                        }
                                                                        onChange={(
                                                                            v,
                                                                        ) => {
                                                                            setCreditSplits(
                                                                                (
                                                                                    prev,
                                                                                ) =>
                                                                                    prev.map(
                                                                                        (
                                                                                            s,
                                                                                        ) =>
                                                                                            s.key ===
                                                                                            row.key
                                                                                                ? {
                                                                                                      ...s,
                                                                                                      amount: v,
                                                                                                  }
                                                                                                : s,
                                                                                    ),
                                                                            );
                                                                        }}
                                                                    />
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="shrink-0"
                                                                    onClick={() => {
                                                                        setCreditSplits(
                                                                            (
                                                                                prev,
                                                                            ) =>
                                                                                prev.filter(
                                                                                    (
                                                                                        s,
                                                                                    ) =>
                                                                                        s.key !==
                                                                                        row.key,
                                                                                ),
                                                                        );
                                                                    }}
                                                                    disabled={
                                                                        creditSplits.length <=
                                                                        1
                                                                    }
                                                                    aria-label="Remove split"
                                                                >
                                                                    <Trash2 className="size-4 text-destructive" />
                                                                </Button>
                                                            </li>
                                                        );
                                                    },
                                                )}
                                            </ul>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        const used = new Set(
                                                            creditSplits.map(
                                                                (s) =>
                                                                    s.accountId,
                                                            ),
                                                        );
                                                        const next =
                                                            cardPaymentSourceAccounts.find(
                                                                (a) =>
                                                                    !used.has(
                                                                        a.id,
                                                                    ),
                                                            );
                                                        if (next) {
                                                            setCreditSplits(
                                                                (prev) => [
                                                                    ...prev,
                                                                    {
                                                                        key: newCreditSplitKey(),
                                                                        accountId:
                                                                            next.id,
                                                                        amount: '',
                                                                    },
                                                                ],
                                                            );
                                                        }
                                                    }}
                                                    disabled={
                                                        cardPaymentSourceAccounts.filter(
                                                            (a) =>
                                                                !creditSplits.some(
                                                                    (s) =>
                                                                        s.accountId ===
                                                                        a.id,
                                                                ),
                                                        ).length === 0
                                                    }
                                                >
                                                    <Plus className="size-4" />
                                                    Add account
                                                </Button>
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                Payment total:{' '}
                                                <span className="font-medium text-foreground tabular-nums">
                                                    {formatPhpMoney(
                                                        creditSplits.reduce(
                                                            (acc, s) => {
                                                                const t =
                                                                    s.amount.trim();
                                                                if (
                                                                    t === '' ||
                                                                    t === '-'
                                                                ) {
                                                                    return acc;
                                                                }
                                                                const n =
                                                                    Number.parseFloat(
                                                                        t,
                                                                    );
                                                                return (
                                                                    acc +
                                                                    (Number.isFinite(
                                                                        n,
                                                                    ) && n > 0
                                                                        ? n
                                                                        : 0)
                                                                );
                                                            },
                                                            0,
                                                        ),
                                                    )}{' '}
                                                </span>
                                                (applied to the selected card)
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-sm font-medium">
                                                Allocation split
                                            </p>
                                            <ul className="space-y-1.5">
                                                {purchaseAllocSplits.map(
                                                    (row, rowIndex) => {
                                                        const allocRowsForPicker: LineAllocation[] =
                                                            purchaseAllocSplits.map(
                                                                (s) => ({
                                                                    allocation_id:
                                                                        s.allocationId,
                                                                    amount: s.amount,
                                                                }),
                                                            );
                                                        const allocChoices =
                                                            allocationOptionsForRow(
                                                                allocationLineOptions,
                                                                allocRowsForPicker,
                                                                rowIndex,
                                                            );
                                                        const allocation =
                                                            allocChoices.find(
                                                                (a) =>
                                                                    a.id ===
                                                                    row.allocationId,
                                                            );
                                                        return (
                                                            <li
                                                                key={row.key}
                                                                className="flex items-start gap-2"
                                                            >
                                                                <div className="min-w-0 flex-1">
                                                                    <Label className="sr-only">
                                                                        Allocation
                                                                    </Label>
                                                                    <SearchableCombobox
                                                                        ariaLabel="Allocation"
                                                                        value={
                                                                            row.allocationId ||
                                                                            null
                                                                        }
                                                                        onChange={(
                                                                            value,
                                                                        ) => {
                                                                            setPurchaseAllocSplits(
                                                                                (
                                                                                    prev,
                                                                                ) =>
                                                                                    prev.map(
                                                                                        (
                                                                                            s,
                                                                                        ) =>
                                                                                            s.key ===
                                                                                            row.key
                                                                                                ? {
                                                                                                      ...s,
                                                                                                      allocationId:
                                                                                                          Number(
                                                                                                              value ??
                                                                                                                  0,
                                                                                                          ),
                                                                                                  }
                                                                                                : s,
                                                                                    ),
                                                                            );
                                                                        }}
                                                                        options={
                                                                            allocChoices
                                                                        }
                                                                        placeholder="Select allocation"
                                                                    />
                                                                    <ProjectedBalance
                                                                        balance={
                                                                            allocation?.balance
                                                                        }
                                                                        delta={
                                                                            -positiveMagnitudeOrZero(
                                                                                row.amount,
                                                                            )
                                                                        }
                                                                    />
                                                                </div>
                                                                <div className="w-28 shrink-0">
                                                                    <Label
                                                                        className="sr-only"
                                                                        htmlFor={`cpaa-${row.key}`}
                                                                    >
                                                                        Amount
                                                                    </Label>
                                                                    <MoneyInput
                                                                        id={`cpaa-${row.key}`}
                                                                        value={
                                                                            row.amount
                                                                        }
                                                                        onChange={(
                                                                            v,
                                                                        ) => {
                                                                            setPurchaseAllocSplits(
                                                                                (
                                                                                    prev,
                                                                                ) =>
                                                                                    prev.map(
                                                                                        (
                                                                                            s,
                                                                                        ) =>
                                                                                            s.key ===
                                                                                            row.key
                                                                                                ? {
                                                                                                      ...s,
                                                                                                      amount: v,
                                                                                                  }
                                                                                                : s,
                                                                                    ),
                                                                            );
                                                                        }}
                                                                    />
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="shrink-0"
                                                                    onClick={() => {
                                                                        setPurchaseAllocSplits(
                                                                            (
                                                                                prev,
                                                                            ) =>
                                                                                prev.filter(
                                                                                    (
                                                                                        s,
                                                                                    ) =>
                                                                                        s.key !==
                                                                                        row.key,
                                                                                ),
                                                                        );
                                                                    }}
                                                                    disabled={
                                                                        purchaseAllocSplits.length <=
                                                                        1
                                                                    }
                                                                    aria-label="Remove allocation line"
                                                                >
                                                                    <Trash2 className="size-4 text-destructive" />
                                                                </Button>
                                                            </li>
                                                        );
                                                    },
                                                )}
                                            </ul>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        const used = new Set(
                                                            purchaseAllocSplits.map(
                                                                (s) =>
                                                                    s.allocationId,
                                                            ),
                                                        );
                                                        const next =
                                                            allocationLineOptions.find(
                                                                (a) =>
                                                                    !used.has(
                                                                        a.id,
                                                                    ),
                                                            );
                                                        if (next) {
                                                            setPurchaseAllocSplits(
                                                                (prev) => [
                                                                    ...prev,
                                                                    {
                                                                        key: newCreditSplitKey(),
                                                                        allocationId:
                                                                            next.id,
                                                                        amount: '',
                                                                    },
                                                                ],
                                                            );
                                                        }
                                                    }}
                                                    disabled={
                                                        allocationLineOptions.filter(
                                                            (a) =>
                                                                !purchaseAllocSplits.some(
                                                                    (s) =>
                                                                        s.allocationId ===
                                                                        a.id,
                                                                ),
                                                        ).length === 0
                                                    }
                                                >
                                                    <Plus className="size-4" />
                                                    Add allocation
                                                </Button>
                                            </div>
                                            <p className="text-sm font-medium">
                                                Split with people
                                            </p>
                                            {purchasePersonSplits.length ===
                                                0 && (
                                                <p className="text-sm text-muted-foreground">
                                                    No people splitting this
                                                    purchase.
                                                </p>
                                            )}
                                            <ul className="space-y-1.5">
                                                {purchasePersonSplits.map(
                                                    (row, rowIndex) => {
                                                        const sourceChoices =
                                                            cardPaymentSourceOptionsForRow(
                                                                personAccounts,
                                                                purchasePersonSplits,
                                                                rowIndex,
                                                            );
                                                        const personAccount =
                                                            sourceChoices.find(
                                                                (a) =>
                                                                    a.id ===
                                                                    row.accountId,
                                                            );
                                                        return (
                                                            <li
                                                                key={row.key}
                                                                className="flex items-start gap-2"
                                                            >
                                                                <div className="min-w-0 flex-1">
                                                                    <Label className="sr-only">
                                                                        Person
                                                                    </Label>
                                                                    <SearchableCombobox
                                                                        ariaLabel="Person"
                                                                        value={
                                                                            row.accountId ||
                                                                            null
                                                                        }
                                                                        onChange={(
                                                                            value,
                                                                        ) => {
                                                                            setPurchasePersonSplits(
                                                                                (
                                                                                    prev,
                                                                                ) =>
                                                                                    prev.map(
                                                                                        (
                                                                                            s,
                                                                                        ) =>
                                                                                            s.key ===
                                                                                            row.key
                                                                                                ? {
                                                                                                      ...s,
                                                                                                      accountId:
                                                                                                          Number(
                                                                                                              value ??
                                                                                                                  0,
                                                                                                          ),
                                                                                                  }
                                                                                                : s,
                                                                                    ),
                                                                            );
                                                                        }}
                                                                        options={
                                                                            sourceChoices
                                                                        }
                                                                        placeholder="Select person"
                                                                    />
                                                                    <ProjectedBalance
                                                                        balance={
                                                                            personAccount?.balance
                                                                        }
                                                                        delta={positiveMagnitudeOrZero(
                                                                            row.amount,
                                                                        )}
                                                                    />
                                                                </div>
                                                                <div className="w-28 shrink-0">
                                                                    <Label
                                                                        className="sr-only"
                                                                        htmlFor={`cpa-${row.key}`}
                                                                    >
                                                                        Amount
                                                                    </Label>
                                                                    <MoneyInput
                                                                        id={`cpa-${row.key}`}
                                                                        value={
                                                                            row.amount
                                                                        }
                                                                        onChange={(
                                                                            v,
                                                                        ) => {
                                                                            setPurchasePersonSplits(
                                                                                (
                                                                                    prev,
                                                                                ) =>
                                                                                    prev.map(
                                                                                        (
                                                                                            s,
                                                                                        ) =>
                                                                                            s.key ===
                                                                                            row.key
                                                                                                ? {
                                                                                                      ...s,
                                                                                                      amount: v,
                                                                                                  }
                                                                                                : s,
                                                                                    ),
                                                                            );
                                                                        }}
                                                                    />
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="shrink-0"
                                                                    onClick={() => {
                                                                        setPurchasePersonSplits(
                                                                            (
                                                                                prev,
                                                                            ) =>
                                                                                prev.filter(
                                                                                    (
                                                                                        s,
                                                                                    ) =>
                                                                                        s.key !==
                                                                                        row.key,
                                                                                ),
                                                                        );
                                                                    }}
                                                                    aria-label="Remove person line"
                                                                >
                                                                    <Trash2 className="size-4 text-destructive" />
                                                                </Button>
                                                            </li>
                                                        );
                                                    },
                                                )}
                                            </ul>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        const used = new Set(
                                                            purchasePersonSplits.map(
                                                                (s) =>
                                                                    s.accountId,
                                                            ),
                                                        );
                                                        const next =
                                                            personAccounts.find(
                                                                (a) =>
                                                                    !used.has(
                                                                        a.id,
                                                                    ),
                                                            );
                                                        if (next) {
                                                            setPurchasePersonSplits(
                                                                (prev) => [
                                                                    ...prev,
                                                                    {
                                                                        key: newCreditSplitKey(),
                                                                        accountId:
                                                                            next.id,
                                                                        amount: '',
                                                                    },
                                                                ],
                                                            );
                                                        }
                                                    }}
                                                    disabled={
                                                        !personAccounts.some(
                                                            (a) =>
                                                                !purchasePersonSplits.some(
                                                                    (s) =>
                                                                        s.accountId ===
                                                                        a.id,
                                                                ),
                                                        )
                                                    }
                                                >
                                                    <Plus className="size-4" />
                                                    Add person
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                    <InputError
                                        message={form.errors.accounts}
                                    />
                                    <InputError
                                        message={form.errors.allocations}
                                    />
                                </div>
                                {/* end credit card lines card */}
                            </div>
                        ) : isCreateTransfer && canDoTransfer ? (
                            <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                                {canShowAccountTab &&
                                canShowTransferAllocTab ? (
                                    <div className="grid gap-2">
                                        <span className="text-sm font-medium">
                                            Transfer type
                                        </span>
                                        <ToggleGroup
                                            type="single"
                                            value={transferKind}
                                            onValueChange={(v) => {
                                                if (
                                                    v !== 'account' &&
                                                    v !== 'allocation'
                                                ) {
                                                    return;
                                                }
                                                setTransferKind(v);
                                                if (v === 'account') {
                                                    setFromAccountId(
                                                        accountList[0]!.id,
                                                    );
                                                    setToAccountId(
                                                        accountList[1]!.id,
                                                    );
                                                } else {
                                                    setFromAllocId(
                                                        transferAllocChoices[0]!
                                                            .id,
                                                    );
                                                    setToAllocId(
                                                        transferAllocChoices[1]!
                                                            .id,
                                                    );
                                                }
                                                setTransferAmount('');
                                                setTransferFeeAmount('');
                                                setTransferFeeAllocationId(0);
                                            }}
                                            variant="outline"
                                            className="w-full max-w-sm justify-stretch"
                                        >
                                            <ToggleGroupItem
                                                value="account"
                                                className="min-w-0 flex-1 px-2"
                                            >
                                                Account
                                            </ToggleGroupItem>
                                            <ToggleGroupItem
                                                value="allocation"
                                                className="min-w-0 flex-1 px-2"
                                            >
                                                Allocation
                                            </ToggleGroupItem>
                                        </ToggleGroup>
                                    </div>
                                ) : canShowAccountTab ? (
                                    <p className="text-sm text-muted-foreground">
                                        Transfer between two accounts
                                    </p>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        Transfer between two allocations
                                    </p>
                                )}

                                {transferKind === 'account' &&
                                canShowAccountTab ? (
                                    <div className="flex items-end gap-2">
                                        <div className="grid min-w-0 flex-1 gap-2">
                                            <Label htmlFor="tx-from-account">
                                                From
                                            </Label>
                                            <select
                                                id="tx-from-account"
                                                className={cn(
                                                    selectClass,
                                                    invalidClass,
                                                )}
                                                value={fromAccountId}
                                                onChange={(e) => {
                                                    const id = Number(
                                                        e.target.value,
                                                    );
                                                    setFromAccountId(id);
                                                    if (id === toAccountId) {
                                                        const o =
                                                            accountList.find(
                                                                (a) =>
                                                                    a.id !== id,
                                                            );
                                                        if (o) {
                                                            setToAccountId(
                                                                o.id,
                                                            );
                                                        }
                                                    }
                                                }}
                                            >
                                                {renderGroupedAccountOptions(
                                                    accountList.filter(
                                                        (a) =>
                                                            a.id !==
                                                            toAccountId,
                                                    ),
                                                )}
                                            </select>
                                        </div>
                                        <ArrowRight className="mb-[10px] size-4 shrink-0 text-muted-foreground" />
                                        <div className="grid min-w-0 flex-1 gap-2">
                                            <Label htmlFor="tx-to-account">
                                                To
                                            </Label>
                                            <select
                                                id="tx-to-account"
                                                className={cn(
                                                    selectClass,
                                                    invalidClass,
                                                )}
                                                value={toAccountId}
                                                onChange={(e) => {
                                                    const id = Number(
                                                        e.target.value,
                                                    );
                                                    setToAccountId(id);
                                                    if (id === fromAccountId) {
                                                        const o =
                                                            accountList.find(
                                                                (a) =>
                                                                    a.id !== id,
                                                            );
                                                        if (o) {
                                                            setFromAccountId(
                                                                o.id,
                                                            );
                                                        }
                                                    }
                                                }}
                                            >
                                                {renderGroupedAccountOptions(
                                                    accountList.filter(
                                                        (a) =>
                                                            a.id !==
                                                            fromAccountId,
                                                    ),
                                                )}
                                            </select>
                                        </div>
                                    </div>
                                ) : null}

                                {transferKind === 'allocation' &&
                                canShowTransferAllocTab ? (
                                    <div className="flex items-end gap-2">
                                        <div className="grid min-w-0 flex-1 gap-2">
                                            <Label htmlFor="tx-from-alloc">
                                                From
                                            </Label>
                                            <select
                                                id="tx-from-alloc"
                                                className={cn(
                                                    selectClass,
                                                    invalidClass,
                                                )}
                                                value={fromAllocId}
                                                onChange={(e) => {
                                                    const id = Number(
                                                        e.target.value,
                                                    );
                                                    setFromAllocId(id);
                                                    if (id === toAllocId) {
                                                        const o =
                                                            transferAllocChoices.find(
                                                                (a) =>
                                                                    a.id !== id,
                                                            );
                                                        if (o) {
                                                            setToAllocId(o.id);
                                                        }
                                                    }
                                                }}
                                            >
                                                {renderGroupedAllocationOptions(
                                                    transferAllocChoices.filter(
                                                        (a) =>
                                                            a.id !== toAllocId,
                                                    ),
                                                )}
                                            </select>
                                        </div>
                                        <ArrowRight className="mb-[10px] size-4 shrink-0 text-muted-foreground" />
                                        <div className="grid min-w-0 flex-1 gap-2">
                                            <Label htmlFor="tx-to-alloc">
                                                To
                                            </Label>
                                            <select
                                                id="tx-to-alloc"
                                                className={cn(
                                                    selectClass,
                                                    invalidClass,
                                                )}
                                                value={toAllocId}
                                                onChange={(e) => {
                                                    const id = Number(
                                                        e.target.value,
                                                    );
                                                    setToAllocId(id);
                                                    if (id === fromAllocId) {
                                                        const o =
                                                            transferAllocChoices.find(
                                                                (a) =>
                                                                    a.id !== id,
                                                            );
                                                        if (o) {
                                                            setFromAllocId(
                                                                o.id,
                                                            );
                                                        }
                                                    }
                                                }}
                                            >
                                                {renderGroupedAllocationOptions(
                                                    transferAllocChoices.filter(
                                                        (a) =>
                                                            a.id !==
                                                            fromAllocId,
                                                    ),
                                                )}
                                            </select>
                                        </div>
                                    </div>
                                ) : null}

                                <div className="grid max-w-sm gap-2">
                                    <Label htmlFor="tx-transfer-amt">
                                        Amount
                                    </Label>
                                    <MoneyInput
                                        id="tx-transfer-amt"
                                        name="transfer_amount"
                                        value={transferAmount}
                                        onChange={setTransferAmount}
                                        onKeyDown={(event) => {
                                            if (
                                                event.key === 'Tab' &&
                                                !event.shiftKey &&
                                                transferKind === 'account' &&
                                                canShowAccountTab
                                            ) {
                                                event.preventDefault();
                                                document
                                                    .getElementById(
                                                        'tx-transfer-fee',
                                                    )
                                                    ?.focus();
                                            }
                                        }}
                                        aria-invalid={
                                            !!err('accounts.0.amount') ||
                                            !!err('accounts.1.amount') ||
                                            !!err('allocations.0.amount') ||
                                            !!err('allocations.1.amount') ||
                                            !!err('accounts') ||
                                            !!err('allocations')
                                        }
                                    />
                                    {transferKind === 'account' &&
                                    canShowAccountTab ? (
                                        <p className="text-xs text-muted-foreground">
                                            Destination receives this amount. If
                                            you add a fee below, the source
                                            account also decreases by the fee.
                                        </p>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">
                                            From decreases by this amount; to
                                            increases by the same amount.
                                        </p>
                                    )}
                                </div>

                                {transferKind === 'account' &&
                                canShowAccountTab ? (
                                    <div className="max-w-2xl space-y-3 rounded-md border border-border p-4">
                                        <p className="text-sm font-medium">
                                            Transfer fee (optional)
                                        </p>
                                        <div className="flex items-end gap-3">
                                            <div className="grid min-w-0 flex-1 gap-2">
                                                <Label htmlFor="tx-transfer-fee">
                                                    Fee
                                                </Label>
                                                <MoneyInput
                                                    id="tx-transfer-fee"
                                                    name="transfer_fee"
                                                    value={transferFeeAmount}
                                                    onChange={
                                                        setTransferFeeAmount
                                                    }
                                                    onKeyDown={(event) => {
                                                        if (
                                                            event.key ===
                                                                'Tab' &&
                                                            event.shiftKey
                                                        ) {
                                                            event.preventDefault();
                                                            document
                                                                .getElementById(
                                                                    'tx-transfer-amt',
                                                                )
                                                                ?.focus();
                                                        }
                                                    }}
                                                    aria-invalid={
                                                        transferFeeInputInvalid
                                                    }
                                                />
                                            </div>
                                            <div className="grid min-w-0 flex-1 gap-2">
                                                <Label htmlFor="tx-transfer-fee-alloc">
                                                    Fee from
                                                </Label>
                                                <select
                                                    id="tx-transfer-fee-alloc"
                                                    className={cn(
                                                        selectClass,
                                                        invalidClass,
                                                    )}
                                                    value={
                                                        transferFeeAllocationId
                                                    }
                                                    onChange={(e) =>
                                                        setTransferFeeAllocationId(
                                                            Number(
                                                                e.target.value,
                                                            ),
                                                        )
                                                    }
                                                >
                                                    <option value={0}>
                                                        Unallocated
                                                    </option>
                                                    {allocationLineOptions.map(
                                                        (a) => (
                                                            <option
                                                                key={a.id}
                                                                value={a.id}
                                                            >
                                                                {a.name}
                                                            </option>
                                                        ),
                                                    )}
                                                </select>
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Fee is taken from the selected
                                            allocation, or from{' '}
                                            <strong>Unallocated</strong> when
                                            "Fee from" is Unallocated.
                                        </p>
                                        {transferFeeUnallocatedMissing ? (
                                            <p className="text-sm text-destructive">
                                                Unallocated allocation is
                                                missing; add an account or
                                                allocation so the system can
                                                create it, or choose a specific
                                                envelope for the fee.
                                            </p>
                                        ) : null}
                                    </div>
                                ) : canShowAccountTab ? (
                                    <p className="max-w-md text-sm text-muted-foreground">
                                        Transfer fees are only available for{' '}
                                        <strong>Account</strong> transfers.
                                        Switch the type above to Account to add
                                        a fee.
                                    </p>
                                ) : null}

                                <div className="grid max-w-sm gap-2">
                                    <InputError
                                        message={err('accounts.0.amount')}
                                    />
                                    <InputError
                                        message={err('accounts.1.amount')}
                                    />
                                    <InputError
                                        message={err('allocations.0.amount')}
                                    />
                                    <InputError
                                        message={err('allocations.1.amount')}
                                    />
                                    <InputError message={err('accounts')} />
                                    <InputError message={err('allocations')} />
                                </div>
                            </div>
                        ) : isCreateLoan ? (
                            <div className="space-y-3">
                                <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                                    <Label className="text-base">Person</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Pick the direction that matches your
                                        intent. Enter <strong>positive</strong>{' '}
                                        amounts everywhere; Penny applies the
                                        correct signs automatically.
                                    </p>
                                    {personAccounts.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            Add a person account first.
                                        </p>
                                    ) : (
                                        <div className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:flex-wrap sm:items-end">
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <Label
                                                    className="text-xs"
                                                    htmlFor="loan-person-select"
                                                >
                                                    Person
                                                </Label>
                                                <select
                                                    id="loan-person-select"
                                                    className={cn(
                                                        selectClass,
                                                        invalidClass,
                                                    )}
                                                    value={loanPersonId}
                                                    onChange={(e) =>
                                                        setLoanPersonId(
                                                            Number(
                                                                e.target.value,
                                                            ),
                                                        )
                                                    }
                                                >
                                                    {renderGroupedAccountOptions(
                                                        personAccounts,
                                                    )}
                                                </select>
                                            </div>
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <Label
                                                    className="text-xs"
                                                    htmlFor="loan-person-direction"
                                                >
                                                    Direction
                                                </Label>
                                                <select
                                                    id="loan-person-direction"
                                                    className={cn(
                                                        selectClass,
                                                        invalidClass,
                                                    )}
                                                    value={loanDirection}
                                                    onChange={(e) => {
                                                        const v =
                                                            e.target.value;
                                                        if (
                                                            v !==
                                                                'i_paid_them' &&
                                                            v !==
                                                                'they_owe_me' &&
                                                            v !==
                                                                'they_paid_me' &&
                                                            v !== 'i_owe_them'
                                                        ) {
                                                            return;
                                                        }
                                                        setLoanDirection(v);
                                                    }}
                                                >
                                                    <option value="i_paid_them">
                                                        I paid them
                                                    </option>
                                                    <option value="they_owe_me">
                                                        They owe me
                                                    </option>
                                                    <option value="they_paid_me">
                                                        They paid me
                                                    </option>
                                                    <option value="i_owe_them">
                                                        I owe them
                                                    </option>
                                                </select>
                                            </div>
                                            <div className="w-full max-w-sm min-w-[9rem] space-y-1 sm:max-w-[12rem]">
                                                <Label
                                                    className="text-xs"
                                                    htmlFor="loan-person-amt"
                                                >
                                                    Amount
                                                </Label>
                                                <MoneyInput
                                                    id="loan-person-amt"
                                                    value={loanPersonAmount}
                                                    onChange={
                                                        setLoanPersonAmount
                                                    }
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-base">
                                            Funding accounts
                                        </Label>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={!canAddLoanFundingLine}
                                            onClick={() => {
                                                const used = new Set(
                                                    form.data.accounts
                                                        .map(
                                                            (r) => r.account_id,
                                                        )
                                                        .filter((id) => id > 0),
                                                );
                                                const first =
                                                    loanFundingAccounts.find(
                                                        (a) => !used.has(a.id),
                                                    );
                                                if (!first) {
                                                    return;
                                                }
                                                form.setData('accounts', [
                                                    ...form.data.accounts,
                                                    {
                                                        account_id: first.id,
                                                        amount: '',
                                                    },
                                                ]);
                                                setPendingFieldFocusId(
                                                    `loan-acc-amt-${form.data.accounts.length}`,
                                                );
                                            }}
                                        >
                                            <Plus className="size-4" />
                                            Add funding line
                                        </Button>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Bank, cash, or credit card — enter{' '}
                                        <strong>positive</strong> amounts; Penny
                                        stores them with the sign opposite to
                                        the person line.
                                    </p>
                                    {form.data.accounts.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            No funding lines.
                                        </p>
                                    ) : null}
                                    <ul className="space-y-3">
                                        {form.data.accounts.map((row, i) => {
                                            const accIdKey = `accounts.${i}.account_id`;
                                            const accAmtKey = `accounts.${i}.amount`;
                                            const accIdErr = err(accIdKey);
                                            const accAmtErr = err(accAmtKey);
                                            return (
                                                <li
                                                    key={`loan-f-${i}`}
                                                    className="flex items-start gap-2"
                                                >
                                                    <div className="min-w-0 flex-1 space-y-1">
                                                        <Label
                                                            className="sr-only"
                                                            htmlFor={`loan-acc-${i}`}
                                                        >
                                                            Account
                                                        </Label>
                                                        <select
                                                            id={`loan-acc-${i}`}
                                                            name={accIdKey}
                                                            className={cn(
                                                                selectClass,
                                                                invalidClass,
                                                            )}
                                                            value={
                                                                row.account_id
                                                            }
                                                            aria-invalid={
                                                                !!accIdErr
                                                            }
                                                            onChange={(e) => {
                                                                const next = [
                                                                    ...form.data
                                                                        .accounts,
                                                                ];
                                                                next[i] = {
                                                                    ...next[i],
                                                                    account_id:
                                                                        Number(
                                                                            e
                                                                                .target
                                                                                .value,
                                                                        ),
                                                                };
                                                                form.setData(
                                                                    'accounts',
                                                                    next,
                                                                );
                                                            }}
                                                        >
                                                            {renderGroupedAccountOptions(
                                                                accountOptionsForRow(
                                                                    loanFundingAccounts,
                                                                    form.data
                                                                        .accounts,
                                                                    i,
                                                                ),
                                                            )}
                                                        </select>
                                                        <InputError
                                                            message={accIdErr}
                                                        />
                                                    </div>
                                                    <div className="w-28 shrink-0 space-y-1">
                                                        <Label
                                                            className="sr-only"
                                                            htmlFor={`loan-acc-amt-${i}`}
                                                        >
                                                            Amount
                                                        </Label>
                                                        <MoneyInput
                                                            id={`loan-acc-amt-${i}`}
                                                            name={accAmtKey}
                                                            value={row.amount}
                                                            aria-invalid={
                                                                !!accAmtErr
                                                            }
                                                            onChange={(v) => {
                                                                const next = [
                                                                    ...form.data
                                                                        .accounts,
                                                                ];
                                                                next[i] = {
                                                                    ...next[i],
                                                                    amount: v,
                                                                };
                                                                form.setData(
                                                                    'accounts',
                                                                    next,
                                                                );
                                                            }}
                                                        />
                                                        <InputError
                                                            message={accAmtErr}
                                                        />
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="shrink-0 self-end"
                                                        onClick={() => {
                                                            form.setData(
                                                                'accounts',
                                                                form.data.accounts.filter(
                                                                    (_, j) =>
                                                                        j !== i,
                                                                ),
                                                            );
                                                        }}
                                                    >
                                                        <Trash2 className="size-4 text-destructive" />
                                                    </Button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                    {form.data.accounts.length >= 1 && (
                                        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3 text-sm text-muted-foreground">
                                            <span>Funding (as recorded)</span>
                                            <span className="min-w-[9rem] text-right font-medium text-foreground tabular-nums">
                                                {loanFundingRunning === null
                                                    ? '—'
                                                    : formatPhpMoney(
                                                          loanFundingRunning,
                                                      )}
                                            </span>
                                            <span
                                                className="size-9 shrink-0"
                                                aria-hidden
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-base">
                                            Allocation lines
                                        </Label>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={!canAddAllocationLine}
                                            onClick={() => {
                                                const used = new Set(
                                                    form.data.allocations
                                                        .map(
                                                            (r) =>
                                                                r.allocation_id,
                                                        )
                                                        .filter((id) => id > 0),
                                                );
                                                const first =
                                                    allocationLineOptions.find(
                                                        (a) => !used.has(a.id),
                                                    );
                                                if (!first) {
                                                    return;
                                                }
                                                form.setData('allocations', [
                                                    ...form.data.allocations,
                                                    {
                                                        allocation_id: first.id,
                                                        amount: '',
                                                    },
                                                ]);
                                                setPendingFieldFocusId(
                                                    `loan-alloc-amt-${form.data.allocations.length}`,
                                                );
                                            }}
                                        >
                                            <Plus className="size-4" />
                                            Add allocation line
                                        </Button>
                                    </div>
                                    {form.data.allocations.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            Optional: envelopes. Enter positive
                                            amounts; Penny assigns their sign to
                                            match the net account total.
                                        </p>
                                    ) : null}
                                    <ul className="space-y-3">
                                        {form.data.allocations.map((row, i) => {
                                            const allocIdKey = `allocations.${i}.allocation_id`;
                                            const allocAmtKey = `allocations.${i}.amount`;
                                            const allocIdErr = err(allocIdKey);
                                            const allocAmtErr =
                                                err(allocAmtKey);
                                            return (
                                                <li
                                                    key={`loan-l-${i}`}
                                                    className="flex items-start gap-2"
                                                >
                                                    <div className="min-w-0 flex-1 space-y-1">
                                                        <Label
                                                            className="sr-only"
                                                            htmlFor={`loan-alloc-${i}`}
                                                        >
                                                            Allocation
                                                        </Label>
                                                        <select
                                                            id={`loan-alloc-${i}`}
                                                            name={allocIdKey}
                                                            className={cn(
                                                                selectClass,
                                                                invalidClass,
                                                            )}
                                                            value={
                                                                row.allocation_id
                                                            }
                                                            aria-invalid={
                                                                !!allocIdErr
                                                            }
                                                            onChange={(e) => {
                                                                const next = [
                                                                    ...form.data
                                                                        .allocations,
                                                                ];
                                                                next[i] = {
                                                                    ...next[i],
                                                                    allocation_id:
                                                                        Number(
                                                                            e
                                                                                .target
                                                                                .value,
                                                                        ),
                                                                };
                                                                form.setData(
                                                                    'allocations',
                                                                    next,
                                                                );
                                                            }}
                                                        >
                                                            {renderGroupedAllocationOptions(
                                                                allocationOptionsForRow(
                                                                    allocationLineOptions,
                                                                    form.data
                                                                        .allocations,
                                                                    i,
                                                                ),
                                                            )}
                                                        </select>
                                                        <InputError
                                                            message={allocIdErr}
                                                        />
                                                    </div>
                                                    <div className="w-28 shrink-0 space-y-1">
                                                        <Label
                                                            className="sr-only"
                                                            htmlFor={`loan-alloc-amt-${i}`}
                                                        >
                                                            Amount
                                                        </Label>
                                                        <MoneyInput
                                                            id={`loan-alloc-amt-${i}`}
                                                            name={allocAmtKey}
                                                            value={row.amount}
                                                            aria-invalid={
                                                                !!allocAmtErr
                                                            }
                                                            onChange={(v) => {
                                                                const next = [
                                                                    ...form.data
                                                                        .allocations,
                                                                ];
                                                                next[i] = {
                                                                    ...next[i],
                                                                    amount: v,
                                                                };
                                                                form.setData(
                                                                    'allocations',
                                                                    next,
                                                                );
                                                            }}
                                                        />
                                                        <InputError
                                                            message={
                                                                allocAmtErr
                                                            }
                                                        />
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="shrink-0 self-end"
                                                        onClick={() => {
                                                            form.setData(
                                                                'allocations',
                                                                form.data.allocations.filter(
                                                                    (_, j) =>
                                                                        j !== i,
                                                                ),
                                                            );
                                                        }}
                                                    >
                                                        <Trash2 className="size-4 text-destructive" />
                                                    </Button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                    {form.data.allocations.length >= 1 && (
                                        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3 text-sm text-muted-foreground">
                                            <span>
                                                Allocations (as recorded)
                                            </span>
                                            <span className="min-w-[9rem] text-right font-medium text-foreground tabular-nums">
                                                {loanAllocRunning === null
                                                    ? '—'
                                                    : formatPhpMoney(
                                                          loanAllocRunning,
                                                      )}
                                            </span>
                                            <span
                                                className="size-9 shrink-0"
                                                aria-hidden
                                            />
                                        </div>
                                    )}
                                </div>
                                {/* end loan allocations card */}

                                <div
                                    className={cn(
                                        'rounded-lg border p-4 text-sm',
                                        loanBalanceGap !== null &&
                                            Math.abs(loanBalanceGap) < 0.02
                                            ? 'border-green-600/50 bg-green-600/5'
                                            : 'border-border bg-muted/30',
                                    )}
                                >
                                    <p className="font-medium">
                                        Match Penny totals
                                    </p>
                                    <ul className="mt-2 space-y-1 text-muted-foreground">
                                        <li className="flex flex-wrap justify-between gap-2">
                                            <span>Person (signed)</span>
                                            <span className="font-medium text-foreground tabular-nums">
                                                {loanPersonSignedTotal === null
                                                    ? '—'
                                                    : formatPhpMoney(
                                                          loanPersonSignedTotal,
                                                      )}
                                            </span>
                                        </li>
                                        <li className="flex flex-wrap justify-between gap-2">
                                            <span>+ Funding (signed)</span>
                                            <span className="font-medium text-foreground tabular-nums">
                                                {loanFundingRunning === null
                                                    ? '—'
                                                    : formatPhpMoney(
                                                          loanFundingRunning,
                                                      )}
                                            </span>
                                        </li>
                                        <li className="flex flex-wrap justify-between gap-2">
                                            <span>Account total (signed)</span>
                                            <span className="font-medium text-foreground tabular-nums">
                                                {loanAccountRunning === null
                                                    ? '—'
                                                    : formatPhpMoney(
                                                          loanAccountRunning,
                                                      )}
                                            </span>
                                        </li>
                                        <li className="flex flex-wrap justify-between gap-2">
                                            <span>
                                                Allocations total (signed)
                                            </span>
                                            <span className="font-medium text-foreground tabular-nums">
                                                {loanAllocRunning === null
                                                    ? '—'
                                                    : formatPhpMoney(
                                                          loanAllocRunning,
                                                      )}
                                            </span>
                                        </li>
                                        <li className="mt-2 flex flex-wrap justify-between gap-2 border-t border-border pt-2 font-medium text-foreground">
                                            <span>Difference (need 0.00)</span>
                                            <span
                                                className={cn(
                                                    'tabular-nums',
                                                    loanBalanceGap !== null &&
                                                        Math.abs(
                                                            loanBalanceGap,
                                                        ) < 0.02
                                                        ? 'text-green-600 dark:text-green-400'
                                                        : 'text-destructive',
                                                )}
                                            >
                                                {loanBalanceGap === null
                                                    ? '—'
                                                    : formatPhpMoney(
                                                          loanBalanceGap,
                                                      )}
                                            </span>
                                        </li>
                                    </ul>
                                    <p className="mt-2 text-xs text-muted-foreground">
                                        Sum check: the net of person and funding
                                        must equal allocations. Example (they
                                        owe you): person 500, funding 300 →
                                        record −300 from that account;
                                        allocations should total 200.
                                    </p>
                                </div>
                                <InputError message={form.errors.accounts} />
                                <InputError message={form.errors.allocations} />
                            </div>
                        ) : !isCreateTransfer &&
                          !isCreateCredit &&
                          !isCreateLoan ? (
                            <div className="grid gap-3 lg:grid-cols-2">
                                <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <Label className="text-base">
                                            Account lines
                                        </Label>

                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={!canAddAccountLine}
                                            onClick={() => {
                                                const used = new Set(
                                                    form.data.accounts
                                                        .map(
                                                            (r) => r.account_id,
                                                        )
                                                        .filter((id) => id > 0),
                                                );
                                                const first = accountList.find(
                                                    (a) => !used.has(a.id),
                                                );
                                                if (!first) {
                                                    return;
                                                }
                                                form.setData('accounts', [
                                                    ...form.data.accounts,
                                                    {
                                                        account_id: first.id,
                                                        amount: '',
                                                    },
                                                ]);
                                                setPendingFieldFocusId(
                                                    `acc-amt-${form.data.accounts.length}`,
                                                );
                                            }}
                                        >
                                            <Plus className="size-4" />
                                            Add
                                        </Button>
                                    </div>
                                    {form.data.accounts.length === 0 && (
                                        <p className="text-sm text-muted-foreground">
                                            No account lines.
                                        </p>
                                    )}
                                    <ul className="space-y-3">
                                        {form.data.accounts.map((row, i) => {
                                            const accIdKey = `accounts.${i}.account_id`;
                                            const accAmtKey = `accounts.${i}.amount`;
                                            const accIdErr = err(accIdKey);
                                            const accAmtErr = err(accAmtKey);
                                            return (
                                                <li
                                                    key={`a-${i}`}
                                                    className="flex items-start gap-2"
                                                >
                                                    <div className="min-w-0 flex-1 space-y-1">
                                                        <Label
                                                            className="sr-only"
                                                            htmlFor={`acc-${i}`}
                                                        >
                                                            Account
                                                        </Label>
                                                        <SearchableCombobox
                                                            ariaLabel="Account"
                                                            value={
                                                                row.account_id
                                                            }
                                                            options={accountOptionsForRow(
                                                                accountList,
                                                                form.data
                                                                    .accounts,
                                                                i,
                                                            )}
                                                            onChange={(
                                                                value,
                                                            ) => {
                                                                const next = [
                                                                    ...form.data
                                                                        .accounts,
                                                                ];
                                                                next[i] = {
                                                                    ...next[i],
                                                                    account_id:
                                                                        Number(
                                                                            value,
                                                                        ),
                                                                };
                                                                form.setData(
                                                                    'accounts',
                                                                    next,
                                                                );
                                                            }}
                                                        />
                                                        <ProjectedBalance
                                                            balance={
                                                                accountList.find(
                                                                    (a) =>
                                                                        a.id ===
                                                                        row.account_id,
                                                                )?.balance
                                                            }
                                                            delta={
                                                                Number.isFinite(
                                                                    Number.parseFloat(
                                                                        row.amount,
                                                                    ),
                                                                )
                                                                    ? Number.parseFloat(
                                                                          row.amount,
                                                                      ) -
                                                                      (mode ===
                                                                      'edit'
                                                                          ? Number.parseFloat(
                                                                                transaction?.accounts.find(
                                                                                    (
                                                                                        line,
                                                                                    ) =>
                                                                                        line.account_id ===
                                                                                        row.account_id,
                                                                                )
                                                                                    ?.amount ??
                                                                                    '0',
                                                                            )
                                                                          : 0)
                                                                    : null
                                                            }
                                                        />
                                                        <InputError
                                                            message={accIdErr}
                                                        />
                                                    </div>
                                                    <div className="w-28 shrink-0 space-y-1">
                                                        <Label
                                                            className="sr-only"
                                                            htmlFor={`acc-amt-${i}`}
                                                        >
                                                            Amount
                                                        </Label>
                                                        <MoneyInput
                                                            id={`acc-amt-${i}`}
                                                            name={accAmtKey}
                                                            value={row.amount}
                                                            aria-invalid={
                                                                !!accAmtErr
                                                            }
                                                            onChange={(v) => {
                                                                const next = [
                                                                    ...form.data
                                                                        .accounts,
                                                                ];
                                                                next[i] = {
                                                                    ...next[i],
                                                                    amount: v,
                                                                };
                                                                form.setData(
                                                                    'accounts',
                                                                    next,
                                                                );
                                                            }}
                                                        />
                                                        <InputError
                                                            message={accAmtErr}
                                                        />
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="shrink-0 self-end"
                                                        onClick={() => {
                                                            form.setData(
                                                                'accounts',
                                                                form.data.accounts.filter(
                                                                    (_, j) =>
                                                                        j !== i,
                                                                ),
                                                            );
                                                        }}
                                                    >
                                                        <Trash2 className="size-4 text-destructive" />
                                                    </Button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                    <InputError
                                        message={form.errors.accounts}
                                    />
                                </div>
                                {/* end accounts card */}

                                <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <Label className="text-base">
                                            Allocation lines
                                        </Label>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={!canAddAllocationLine}
                                            onClick={() => {
                                                const used = new Set(
                                                    form.data.allocations
                                                        .map(
                                                            (r) =>
                                                                r.allocation_id,
                                                        )
                                                        .filter((id) => id > 0),
                                                );
                                                const first =
                                                    allocationLineOptions.find(
                                                        (a) => !used.has(a.id),
                                                    );
                                                if (!first) {
                                                    return;
                                                }
                                                form.setData('allocations', [
                                                    ...form.data.allocations,
                                                    {
                                                        allocation_id: first.id,
                                                        amount: '',
                                                    },
                                                ]);
                                                setPendingFieldFocusId(
                                                    `alloc-amt-${form.data.allocations.length}`,
                                                );
                                            }}
                                        >
                                            <Plus className="size-4" />
                                            Add
                                        </Button>
                                    </div>
                                    {form.data.allocations.length === 0 && (
                                        <p className="text-sm text-muted-foreground">
                                            Optional allocation lines.
                                        </p>
                                    )}
                                    <ul className="space-y-3">
                                        {form.data.allocations.map((row, i) => {
                                            const allocIdKey = `allocations.${i}.allocation_id`;
                                            const allocAmtKey = `allocations.${i}.amount`;
                                            const allocIdErr = err(allocIdKey);
                                            const allocAmtErr =
                                                err(allocAmtKey);
                                            return (
                                                <li
                                                    key={`l-${i}`}
                                                    className="flex items-start gap-2"
                                                >
                                                    <div className="min-w-0 flex-1 space-y-1">
                                                        <Label
                                                            className="sr-only"
                                                            htmlFor={`alloc-${i}`}
                                                        >
                                                            Allocation
                                                        </Label>
                                                        <SearchableCombobox
                                                            ariaLabel="Allocation"
                                                            value={
                                                                row.allocation_id
                                                            }
                                                            options={allocationOptionsForRow(
                                                                allocationLineOptions,
                                                                form.data
                                                                    .allocations,
                                                                i,
                                                            )}
                                                            onChange={(
                                                                value,
                                                            ) => {
                                                                const next = [
                                                                    ...form.data
                                                                        .allocations,
                                                                ];
                                                                next[i] = {
                                                                    ...next[i],
                                                                    allocation_id:
                                                                        Number(
                                                                            value,
                                                                        ),
                                                                };
                                                                form.setData(
                                                                    'allocations',
                                                                    next,
                                                                );
                                                            }}
                                                        />
                                                        <ProjectedBalance
                                                            balance={
                                                                allocationLineOptions.find(
                                                                    (a) =>
                                                                        a.id ===
                                                                        row.allocation_id,
                                                                )?.balance
                                                            }
                                                            delta={
                                                                Number.isFinite(
                                                                    Number.parseFloat(
                                                                        row.amount,
                                                                    ),
                                                                )
                                                                    ? Number.parseFloat(
                                                                          row.amount,
                                                                      ) -
                                                                      (mode ===
                                                                      'edit'
                                                                          ? Number.parseFloat(
                                                                                transaction?.allocations.find(
                                                                                    (
                                                                                        line,
                                                                                    ) =>
                                                                                        line.allocation_id ===
                                                                                        row.allocation_id,
                                                                                )
                                                                                    ?.amount ??
                                                                                    '0',
                                                                            )
                                                                          : 0)
                                                                    : null
                                                            }
                                                        />
                                                        <InputError
                                                            message={allocIdErr}
                                                        />
                                                    </div>
                                                    <div className="w-28 shrink-0 space-y-1">
                                                        <Label
                                                            className="sr-only"
                                                            htmlFor={`alloc-amt-${i}`}
                                                        >
                                                            Amount
                                                        </Label>
                                                        <MoneyInput
                                                            id={`alloc-amt-${i}`}
                                                            name={allocAmtKey}
                                                            value={row.amount}
                                                            aria-invalid={
                                                                !!allocAmtErr
                                                            }
                                                            onChange={(v) => {
                                                                const next = [
                                                                    ...form.data
                                                                        .allocations,
                                                                ];
                                                                next[i] = {
                                                                    ...next[i],
                                                                    amount: v,
                                                                };
                                                                form.setData(
                                                                    'allocations',
                                                                    next,
                                                                );
                                                            }}
                                                        />
                                                        <InputError
                                                            message={
                                                                allocAmtErr
                                                            }
                                                        />
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="shrink-0 self-end"
                                                        onClick={() => {
                                                            form.setData(
                                                                'allocations',
                                                                form.data.allocations.filter(
                                                                    (_, j) =>
                                                                        j !== i,
                                                                ),
                                                            );
                                                        }}
                                                    >
                                                        <Trash2 className="size-4 text-destructive" />
                                                    </Button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                    <InputError
                                        message={form.errors.allocations}
                                    />
                                </div>
                                {/* end allocations card */}
                            </div>
                        ) : null}
                    </div>

                    <div className="mt-4 shrink-0 space-y-3 border-t border-border pt-4">
                        {!isCreateTransfer &&
                        !isCreateCredit &&
                        !isCreateLoan ? (
                            <div className="grid gap-x-6 gap-y-1 text-sm lg:grid-cols-2">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-muted-foreground">
                                        Accounts total
                                    </span>
                                    <span className="font-medium tabular-nums">
                                        {formatPhpMoney(accountLinesTotal)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-muted-foreground">
                                        Allocations total
                                    </span>
                                    <span className="font-medium tabular-nums">
                                        {formatPhpMoney(allocationLinesTotal)}
                                    </span>
                                </div>
                            </div>
                        ) : null}
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={
                                    form.processing ||
                                    (isCreateTransfer
                                        ? !canSubmitTransfer
                                        : isCreateCredit
                                          ? !canSubmitCredit
                                          : isCreateLoan
                                            ? !canSubmitLoan
                                            : !canSubmit)
                                }
                            >
                                {mode === 'create' ? 'Save' : 'Update'}
                            </Button>
                        </DialogFooter>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
