import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
    formatPhpMoney,
    normalizeMoneyOnBlur,
    sanitizeMoneyInput,
} from '@/lib/format';
import * as React from 'react';

type MoneyInputProps = Omit<
    React.ComponentProps<typeof Input>,
    'value' | 'onChange' | 'type'
> & {
    value: string;
    onChange: (value: string) => void;
};

/**
 * PHP amount: blurred state shows ₱ + grouping; focused state plain numeric entry.
 */
export function MoneyInput({
    value,
    onChange,
    className,
    onBlur,
    onFocus,
    placeholder = '₱0.00',
    ...rest
}: MoneyInputProps) {
    const [focused, setFocused] = React.useState(false);

    const display = (() => {
        if (focused) {
            return value;
        }
        if (value === '' || value === '-') {
            return value === '-' ? '-' : '';
        }
        const n = Number.parseFloat(value);
        if (Number.isFinite(n)) {
            return formatPhpMoney(n);
        }
        return value;
    })();

    return (
        <div className="relative w-full min-w-0">
            {focused ? (
                <span
                    className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-sm"
                    aria-hidden
                >
                    ₱
                </span>
            ) : null}
            <Input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder={placeholder}
                className={cn(
                    focused ? 'pl-7' : '',
                    'tabular-nums',
                    className,
                )}
                value={display}
                onChange={(e) => {
                    onChange(sanitizeMoneyInput(e.target.value));
                }}
                onFocus={(e) => {
                    setFocused(true);
                    onFocus?.(e);
                }}
                onBlur={(e) => {
                    setFocused(false);
                    if (value !== '') {
                        const next = normalizeMoneyOnBlur(value);
                        if (next !== value) {
                            onChange(next);
                        }
                    }
                    onBlur?.(e);
                }}
                {...rest}
            />
        </div>
    );
}
