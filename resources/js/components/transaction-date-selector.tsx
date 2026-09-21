import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

export const toLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

const startOfWeek = (date: Date): Date => {
    const sunday = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
    );
    sunday.setDate(sunday.getDate() - sunday.getDay());

    return sunday;
};

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
    const [visibleWeek, setVisibleWeek] = useState(() =>
        startOfWeek(value ? new Date(`${value}T12:00:00`) : new Date()),
    );
    const dateChoices = useMemo(
        () =>
            Array.from({ length: 7 }, (_, dayIndex) => {
                const date = new Date(visibleWeek);
                date.setDate(date.getDate() + dayIndex);

                return {
                    value: toLocalDateString(date),
                    label: date
                        .toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                        })
                        .toUpperCase(),
                    weekday: date.toLocaleDateString('en-US', {
                        weekday: 'short',
                    }),
                };
            }),
        [visibleWeek],
    );
    const selectedVisibleDate = dateChoices.some(
        (choice) => choice.value === value,
    );
    const selectedChoiceIndex = dateChoices.findIndex(
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

    const moveWeek = (weeks: number): void => {
        setVisibleWeek((current) => {
            const next = new Date(current);
            next.setDate(next.getDate() + weeks * 7);

            return next;
        });
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <Label htmlFor={id}>Date</Label>
                <div className="flex items-center gap-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Previous week"
                        onClick={() => moveWeek(-1)}
                    >
                        <ChevronLeft className="size-4" aria-hidden />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Next week"
                        onClick={() => moveWeek(1)}
                    >
                        <ChevronRight className="size-4" aria-hidden />
                    </Button>
                    <Button
                        type="button"
                        variant={selectedVisibleDate ? 'ghost' : 'secondary'}
                        size="icon"
                        aria-label="Pick date"
                        onClick={openDateInput}
                    >
                        <CalendarDays className="size-4" aria-hidden />
                    </Button>
                </div>
            </div>
            <div
                className="grid grid-cols-7 gap-1.5"
                role="radiogroup"
                aria-label="Dates in displayed week"
            >
                {dateChoices.map((choice) => (
                    <Button
                        key={choice.value}
                        id={`${id}-choice-${choice.value}`}
                        type="button"
                        role="radio"
                        aria-checked={value === choice.value}
                        variant={value === choice.value ? 'default' : 'outline'}
                        size="sm"
                        className="h-auto min-w-0 flex-col gap-0 px-1 py-1 text-[10px] tabular-nums sm:text-xs"
                        tabIndex={
                            value === choice.value ||
                            (!selectedVisibleDate &&
                                choice.value === dateChoices[0].value)
                                ? 0
                                : -1
                        }
                        onClick={() => {
                            onChange(choice.value);
                            setShowCustomDateInput(false);
                        }}
                        onKeyDown={(event) => {
                            const indexByKey: Record<string, number> = {
                                ArrowLeft: Math.max(selectedChoiceIndex - 1, 0),
                                ArrowUp: Math.max(selectedChoiceIndex - 1, 0),
                                ArrowRight: Math.min(
                                    selectedChoiceIndex + 1,
                                    dateChoices.length - 1,
                                ),
                                ArrowDown: Math.min(
                                    selectedChoiceIndex + 1,
                                    dateChoices.length - 1,
                                ),
                                Home: 0,
                                End: dateChoices.length - 1,
                            };
                            const nextIndex = indexByKey[event.key];

                            if (nextIndex === undefined) {
                                return;
                            }

                            event.preventDefault();
                            const nextChoice = dateChoices[nextIndex];
                            onChange(nextChoice.value);
                            document
                                .getElementById(
                                    `${id}-choice-${nextChoice.value}`,
                                )
                                ?.focus();
                        }}
                    >
                        <span>{choice.weekday}</span>
                        <span>{choice.label}</span>
                    </Button>
                ))}
            </div>
            {showCustomDateInput ? (
                <input
                    ref={inputRef}
                    id={id}
                    name="date"
                    type="date"
                    value={value}
                    onChange={(event) => {
                        onChange(event.target.value);
                        if (event.target.value) {
                            setVisibleWeek(
                                startOfWeek(
                                    new Date(`${event.target.value}T12:00:00`),
                                ),
                            );
                            setShowCustomDateInput(false);
                        }
                    }}
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
