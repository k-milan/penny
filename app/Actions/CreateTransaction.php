<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Transaction;
use App\Models\User;
use Illuminate\Support\Facades\DB;

final readonly class CreateTransaction
{
    public function __construct(
        private AddToAccountBalance $addToAccountBalance,
        private AddToAllocationBalance $addToAllocationBalance,
        private ApplyImplicitUnallocatedFromTransactionNets $applyImplicitUnallocated,
    ) {
        //
    }

    /**
     * @param  array{
     *     date: \Carbon\CarbonInterface|string,
     *     description: string,
     *     note: string|null,
     *     bill_allocation_id?: int|null,
     *     bill_period_id?: int|null,
     *     accounts: array<int, array{account_id: int, amount: string|float|int}>,
     *     allocations: array<int, array{allocation_id: int, amount: string|float|int}>,
     * }  $data
     */
    public function handle(User $user, array $data): Transaction
    {
        return DB::transaction(function () use ($user, $data): Transaction {
            $transaction = Transaction::query()->create([
                'user_id' => $user->id,
                'date' => $data['date'],
                'description' => $data['description'],
                'note' => $data['note'] ?? null,
                'bill_allocation_id' => $data['bill_allocation_id'] ?? null,
                'bill_period_id' => $data['bill_period_id'] ?? null,
                'bill_payment_amount' => $this->billPaymentAmount($data),
            ]);

            foreach ($data['accounts'] as $row) {
                $amount = (string) $row['amount'];
                $transaction->transactionAccounts()->create([
                    'account_id' => $row['account_id'],
                    'amount' => $amount,
                ]);
                $this->addToAccountBalance->handle($row['account_id'], $amount);
            }

            foreach ($data['allocations'] as $row) {
                $amount = (string) $row['amount'];
                $transaction->transactionAllocations()->create([
                    'allocation_id' => $row['allocation_id'],
                    'amount' => $amount,
                ]);
                $this->addToAllocationBalance->handle($row['allocation_id'], $amount);
            }

            $this->applyImplicitUnallocated->applyForUser(
                (int) $user->id,
                $data['accounts'],
                $data['allocations'],
            );

            return $transaction->load(['transactionAccounts.account', 'transactionAllocations.allocation']);
        });
    }

    /**
     * @param  array{bill_allocation_id?: int|null, bill_period_id?: int|null, accounts: array<int, array{amount: string|float|int}>, allocations: array<int, array{allocation_id: int, amount: string|float|int}>}  $data
     */
    private function billPaymentAmount(array $data): ?string
    {
        $billAllocationId = $data['bill_allocation_id'] ?? null;
        if ($billAllocationId === null && ($data['bill_period_id'] ?? null) === null) {
            return null;
        }

        if ($billAllocationId !== null) {
            foreach ($data['allocations'] as $row) {
                if ($row['allocation_id'] === $billAllocationId && bccomp((string) $row['amount'], '0.00', 2) !== 0) {
                    return number_format(abs((float) $row['amount']), 2, '.', '');
                }
            }
        }

        $largest = '0.00';
        foreach (array_merge($data['accounts'], $data['allocations']) as $row) {
            $absolute = number_format(abs((float) $row['amount']), 2, '.', '');
            if (bccomp($absolute, $largest, 2) > 0) {
                $largest = $absolute;
            }
        }

        return $largest;
    }
}
