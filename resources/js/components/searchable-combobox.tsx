import {
    Combobox,
    ComboboxChip,
    ComboboxChips,
    ComboboxChipsInput,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
    ComboboxValue,
    useComboboxAnchor,
} from '@/components/ui/combobox';
import { formatPhpMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Pin } from 'lucide-react';
import { Fragment, useMemo } from 'react';

export type ComboboxChoice = {
    id: number | string;
    name: string;
    balance?: string;
    is_pinned?: boolean;
    detail?: string;
};

export function SearchableCombobox({
    value,
    onChange,
    options,
    placeholder = 'Select…',
    ariaLabel,
    disabled = false,
    searchValue,
    onSearchValueChange,
}: {
    value: number | string | null;
    onChange: (value: number | string | null) => void;
    options: ComboboxChoice[];
    placeholder?: string;
    ariaLabel: string;
    disabled?: boolean;
    searchValue?: string;
    onSearchValueChange?: (value: string) => void;
}) {
    const selected = options.find((option) => option.id === value) ?? null;
    const sorted = useMemo(
        () =>
            [...options].sort(
                (a, b) =>
                    Number(Boolean(b.is_pinned)) -
                        Number(Boolean(a.is_pinned)) ||
                    a.name.localeCompare(b.name),
            ),
        [options],
    );

    const label = (option: ComboboxChoice | null) =>
        option
            ? `${option.name}${option.balance !== undefined ? ` (${formatPhpMoney(option.balance)})` : ''}`
            : '';

    return (
        <Combobox
            items={sorted}
            value={selected}
            onValueChange={(option) => onChange(option?.id ?? null)}
            itemToStringLabel={(option) => label(option)}
            itemToStringValue={(option) =>
                `${label(option)} ${option.detail ?? ''}`
            }
            disabled={disabled}
            inputValue={searchValue}
            onInputValueChange={onSearchValueChange}
        >
            <ComboboxInput
                aria-label={ariaLabel}
                placeholder={placeholder}
                className="w-full"
            />
            <ComboboxContent>
                <ComboboxEmpty>No matches</ComboboxEmpty>
                <ComboboxList>
                    {(option: ComboboxChoice) => (
                        <ComboboxItem key={option.id} value={option}>
                            <span className="min-w-0 flex-1 truncate">
                                {label(option)}
                            </span>
                            {option.is_pinned ? (
                                <Pin
                                    className="size-3.5 shrink-0"
                                    fill="currentColor"
                                    aria-label="Pinned"
                                />
                            ) : null}
                        </ComboboxItem>
                    )}
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    );
}

export function MultiChipCombobox({
    value,
    onChange,
    options,
    placeholder = 'Select…',
    ariaLabel,
}: {
    value: (number | string)[];
    onChange: (value: (number | string)[]) => void;
    options: ComboboxChoice[];
    placeholder?: string;
    ariaLabel: string;
}) {
    const anchor = useComboboxAnchor();
    const sorted = useMemo(
        () => [...options].sort((a, b) => a.name.localeCompare(b.name)),
        [options],
    );
    const selected = value
        .map((id) => options.find((option) => option.id === id))
        .filter((option): option is ComboboxChoice => option !== undefined);

    return (
        <Combobox
            items={sorted}
            multiple
            autoHighlight
            value={selected}
            onValueChange={(next) => onChange(next.map((option) => option.id))}
            itemToStringLabel={(option) => option.name}
            itemToStringValue={(option) =>
                `${option.name} ${option.detail ?? ''}`
            }
        >
            <ComboboxChips ref={anchor} className="w-full">
                <ComboboxValue>
                    {(values: ComboboxChoice[]) => (
                        <Fragment>
                            {values.map((option) => (
                                <ComboboxChip key={option.id}>
                                    {option.name}
                                </ComboboxChip>
                            ))}
                            <ComboboxChipsInput
                                aria-label={ariaLabel}
                                placeholder={
                                    values.length === 0 ? placeholder : ''
                                }
                            />
                        </Fragment>
                    )}
                </ComboboxValue>
            </ComboboxChips>
            <ComboboxContent anchor={anchor}>
                <ComboboxEmpty>No items available</ComboboxEmpty>
                <ComboboxList>
                    {(option: ComboboxChoice) => (
                        <ComboboxItem key={option.id} value={option}>
                            {option.name}
                        </ComboboxItem>
                    )}
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    );
}

export function ProjectedBalance({
    balance,
    delta,
    className,
}: {
    balance: string | undefined;
    delta: number | null;
    className?: string;
}) {
    if (balance === undefined) return null;
    const current = Number.parseFloat(balance);
    const projected =
        Number.isFinite(current) && delta !== null ? current + delta : current;
    return (
        <p
            className={cn(
                'mt-1 text-xs text-muted-foreground tabular-nums',
                className,
            )}
        >
            Balance {formatPhpMoney(current)} →{' '}
            <span className="font-medium text-foreground">
                {formatPhpMoney(projected)}
            </span>
        </p>
    );
}
