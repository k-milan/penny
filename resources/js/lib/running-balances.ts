export function runningBalances(
    currentBalance: string,
    transactions: { amount: string | null }[],
): number[] {
    let balanceCents = Math.round(Number(currentBalance) * 100);

    return transactions.map(({ amount }) => {
        const balanceAfter = balanceCents / 100;
        balanceCents -= Math.round(Number(amount ?? '0') * 100);

        return balanceAfter;
    });
}
