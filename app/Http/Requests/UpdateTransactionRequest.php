<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\Transaction;
use App\Support\TransactionLineAmounts;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

final class UpdateTransactionRequest extends FormRequest
{
    public function authorize(): bool
    {
        $transaction = $this->route('transaction');
        if (! $transaction instanceof Transaction) {
            return false;
        }

        $user = $this->user();

        return $user !== null && (int) $user->id === (int) $transaction->user_id;
    }

    public function prepareForValidation(): void
    {
        $this->mergeIfMissing([
            'accounts' => [],
            'allocations' => [],
        ]);
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'date' => 'Date',
            'description' => 'Description',
            'note' => 'Note',
            'accounts.*.account_id' => 'Account',
            'accounts.*.amount' => 'Account line amount',
            'allocations.*.allocation_id' => 'Allocation',
            'allocations.*.amount' => 'Allocation line amount',
        ];
    }

    /**
     * @return array<string, array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'date' => ['required', 'date'],
            'description' => ['required', 'string', 'max:255'],
            'note' => ['nullable', 'string'],
            'accounts' => ['array'],
            'accounts.*.account_id' => [
                'required',
                'integer',
                Rule::exists('accounts', 'id')->where('user_id', auth()->id() ?? 0),
            ],
            'accounts.*.amount' => ['required', 'numeric'],
            'allocations' => ['array'],
            'allocations.*.allocation_id' => [
                'required',
                'integer',
                Rule::exists('allocations', 'id')->where('user_id', auth()->id() ?? 0),
            ],
            'allocations.*.amount' => ['required', 'numeric'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $accounts = $this->input('accounts', []);
            $allocations = $this->input('allocations', []);
            if (! is_array($accounts) || ! is_array($allocations)) {
                return;
            }
            if (count($accounts) === 0 && count($allocations) === 0) {
                $validator->errors()->add('accounts', 'Add at least one account or allocation line.');

                return;
            }

            $accountRows = array_values($accounts);
            $accountIdCounts = array_count_values(
                array_filter(
                    array_map(
                        static fn (array $row): int => (int) ($row['account_id'] ?? 0),
                        $accountRows
                    ),
                    static fn (int $id): bool => $id > 0
                )
            );
            foreach ($accountRows as $i => $row) {
                $id = (int) ($row['account_id'] ?? 0);
                if ($id > 0 && ($accountIdCounts[$id] ?? 0) > 1) {
                    $validator->errors()->add("accounts.{$i}.account_id", 'Each account can only appear once in a transaction.');
                }
            }

            $allocationRows = array_values($allocations);
            $allocationIdCounts = array_count_values(
                array_filter(
                    array_map(
                        static fn (array $row): int => (int) ($row['allocation_id'] ?? 0),
                        $allocationRows
                    ),
                    static fn (int $id): bool => $id > 0
                )
            );
            foreach ($allocationRows as $i => $row) {
                $id = (int) ($row['allocation_id'] ?? 0);
                if ($id > 0 && ($allocationIdCounts[$id] ?? 0) > 1) {
                    $validator->errors()->add("allocations.{$i}.allocation_id", 'Each allocation can only appear once in a transaction.');
                }
            }

            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $accountTotal = TransactionLineAmounts::sumAmounts(
                is_array($accounts) ? $accounts : []
            );
            $allocationTotal = TransactionLineAmounts::sumAmounts(
                is_array($allocations) ? $allocations : []
            );
            if (bccomp($accountTotal, $allocationTotal, 2) !== 0) {
                $message = 'The total of the account line amounts must equal the total of the allocation line amounts.';
                $validator->errors()->add('accounts', $message);
                $validator->errors()->add('allocations', $message);
            }
        });
    }
}
