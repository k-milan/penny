import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export type TransactionCreateKind =
    | 'transaction'
    | 'purchase'
    | 'bill_split'
    | 'transfer'
    | 'credit_card_payment'
    | 'credit_card_purchase'
    | 'loan';

type TransactionCreateResultStatus = 'success' | 'failure';

const transactionKindLabels: Record<TransactionCreateKind, string> = {
    transaction: 'transaction',
    purchase: 'purchase',
    bill_split: 'bill split',
    transfer: 'transfer',
    credit_card_payment: 'credit card payment',
    credit_card_purchase: 'credit card purchase',
    loan: 'loan',
};

function sentenceCase(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

export function TransactionCreateResultDialog({
    open,
    onOpenChange,
    status,
    kind,
    onCreateSame,
    onCreateTransaction,
    onDone,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    status: TransactionCreateResultStatus;
    kind: TransactionCreateKind;
    onCreateSame: () => void;
    onCreateTransaction: () => void;
    onDone: () => void;
}) {
    const label = transactionKindLabels[kind];
    const sameLabel =
        status === 'success' ? `Create another ${label}` : `Try ${label} again`;
    const Icon = status === 'success' ? CheckCircle2 : AlertCircle;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader className="text-left">
                    <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Icon className="size-5" aria-hidden />
                    </div>
                    <DialogTitle>
                        {status === 'success'
                            ? `Successfully logged your ${label}!`
                            : `${sentenceCase(label)} was not logged`}
                    </DialogTitle>
                    <DialogDescription>
                        {status === 'success'
                            ? 'What would you like to do next?'
                            : 'Review the details and try again.'}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:grid sm:grid-cols-[minmax(0,1fr)_auto]">
                    <Button
                        type="button"
                        className="w-full min-w-0 whitespace-normal sm:col-span-2"
                        onClick={onCreateSame}
                    >
                        {sameLabel}
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        className="w-full min-w-0 whitespace-normal"
                        onClick={onCreateTransaction}
                    >
                        Create another transaction
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        className="shrink-0"
                        onClick={onDone}
                    >
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
