<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Sum of signed amounts for account / allocation line payloads in requests.
 */
final class TransactionLineAmounts
{
    /**
     * @param  array<int, array{amount: mixed}>  $lines
     */
    public static function sumAmounts(array $lines): string
    {
        $sum = '0.00';
        foreach ($lines as $row) {
            if (! is_array($row) || ! array_key_exists('amount', $row)) {
                continue;
            }
            if (! is_numeric($row['amount'])) {
                continue;
            }
            $sum = bcadd(
                $sum,
                bcadd('0.00', (string) $row['amount'], 2),
                2
            );
        }

        return $sum;
    }

    /**
     * @param  array<int, array{amount: string}>  $accountLines
     * @param  array<int, array{amount: string}>  $allocationLines
     */
    public static function implicitUnallocatedNet(
        array $accountLines,
        array $allocationLines
    ): string {
        $a = self::sumAmounts($accountLines);
        $b = self::sumAmounts($allocationLines);

        return bcsub($a, $b, 2);
    }
}
