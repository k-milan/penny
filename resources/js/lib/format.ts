/**
 * e.g. "bank" -> "Bank", "credit_card" -> "Credit Card"
 */
export function formatTypeLabel(type: string): string {
    const s = type.replaceAll('_', ' ').trim();
    if (!s) {
        return s;
    }
    return s
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}

export function formatPhpMoney(amount: string | number): string {
    const n = typeof amount === 'string' ? Number.parseFloat(amount) : amount;
    const v = Number.isFinite(n) ? n : 0;
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(v);
}

export function formatDateYmd(dateYmd: string): string {
    const parts = dateYmd.split('-').map((p) => Number.parseInt(p, 10));
    const y = parts[0];
    const m = parts[1];
    const d = parts[2];

    if (
        !Number.isFinite(y) ||
        !Number.isFinite(m) ||
        !Number.isFinite(d) ||
        m === undefined ||
        d === undefined
    ) {
        return dateYmd;
    }

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(new Date(y, m - 1, d));
}

/**
 * Strips currency noise and keeps a single decimal money string for form state.
 */
export function sanitizeMoneyInput(raw: string): string {
    let t = raw.replace(/[₱,\s\u00A0]/g, '');
    if (t === '' || t === '-') {
        return t;
    }
    const neg = t[0] === '-';
    if (neg) {
        t = t.slice(1);
    }
    t = t.replace(/[^\d.]/g, '');
    const firstDot = t.indexOf('.');
    if (firstDot === -1) {
        return (neg ? '-' : '') + t;
    }
    const intP = t.slice(0, firstDot);
    const after = t.slice(firstDot + 1).replace(/\./g, '');
    if (after.length === 0 && t.endsWith('.')) {
        return (neg ? '-' : '') + intP + '.';
    }
    const frac = after.slice(0, 2);
    return (neg ? '-' : '') + intP + (frac.length > 0 ? `.${frac}` : '');
}

/**
 * Normalizes a parsed number to two decimal places on blur (empty stays empty).
 */
export function normalizeMoneyOnBlur(value: string): string {
    const t = value.trim();
    if (t === '' || t === '-' || t === '.') {
        return '';
    }
    if (t.endsWith('.')) {
        const n = Number.parseFloat(t.slice(0, -1));
        if (Number.isFinite(n)) {
            return n.toFixed(2);
        }
    }
    const n = Number.parseFloat(t);
    if (Number.isFinite(n)) {
        return n.toFixed(2);
    }
    return t;
}
