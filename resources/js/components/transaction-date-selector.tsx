import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CalendarDays } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

const toLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

const dateDaysAgo = (daysAgo: number): Date => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - daysAgo);

    return date;
};

const formatDateChoice = (date: Date): string =>
    date
        .toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        })
        .toUpperCase();

export function TransactionDateSelector({
    id,
    value,
    onChange,
    invalid = false,
}: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    invalid?: boolean;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [showCustomDateInput, setShowCustomDateInput] = useState(false);
    const dateChoices = useMemo(
        () =>
            [5, 4, 3, 2, 1, 0].map((daysAgo) => {
                const date = dateDaysAgo(daysAgo);

                return {
                    value: toLocalDateString(date),
                    label: formatDateChoice(date),
                };
            }),
        [],
    );
    const selectedRollingDate = dateChoices.some(
        (choice) => choice.value === value,
    );
    const dateInputClassName =
        'border-input file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm';

    const openDateInput = (): void => {
        setShowCustomDateInput(true);
        window.setTimeout(() => {
            inputRef.current?.showPicker?.();
            inputRef.current?.focus();
        }, 0);
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <Label htmlFor={id}>Date</Label>
                <Button
                    type="button"
                    variant={selectedRollingDate ? 'outline' : 'secondary'}
                    size="sm"
                    className="gap-1.5"
                    onClick={openDateInput}
                >
                    <CalendarDays className="size-4" aria-hidden />
                    Pick date
                </Button>
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                {dateChoices.map((choice) => (
                    <Button
                        key={choice.value}
                        type="button"
                        variant={value === choice.value ? 'default' : 'outline'}
                        size="sm"
                        className="min-w-0 px-2 text-xs tabular-nums"
                        onClick={() => {
                            onChange(choice.value);
                            setShowCustomDateInput(false);
                        }}
                    >
                        {choice.label}
                    </Button>
                ))}
            </div>
            {showCustomDateInput || !selectedRollingDate ? (
                <input
                    ref={inputRef}
                    id={id}
                    name="date"
                    type="date"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    className={dateInputClassName}
                    required
                    aria-invalid={invalid}
                />
            ) : (
                <input
                    ref={inputRef}
                    id={id}
                    name="date"
                    type="date"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    className="sr-only"
                    tabIndex={-1}
                    required
                    aria-invalid={invalid}
                />
            )}
        </div>
    );
}
