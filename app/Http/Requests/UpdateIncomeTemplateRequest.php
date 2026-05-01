<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Enums\IncomePayoutFrequency;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

final class UpdateIncomeTemplateRequest extends FormRequest
{
    public function prepareForValidation(): void
    {
        if ($this->input('description') === '') {
            $this->merge(['description' => null]);
        }
        if ($this->input('company_name') === '') {
            $this->merge(['company_name' => null]);
        }

        $accounts = collect($this->input('accounts', []))
            ->filter(function (mixed $row): bool {
                if (! is_array($row)) {
                    return false;
                }

                return isset($row['account_id'], $row['amount'])
                    && $row['account_id'] !== '' && $row['account_id'] !== null
                    && $row['amount'] !== '' && $row['amount'] !== null;
            })
            ->values()
            ->all();
        $this->merge(['accounts' => $accounts]);

        $allocations = collect($this->input('allocations', []))
            ->filter(function (mixed $row): bool {
                if (! is_array($row)) {
                    return false;
                }

                return isset($row['allocation_id'], $row['amount'])
                    && $row['allocation_id'] !== '' && $row['allocation_id'] !== null
                    && $row['amount'] !== '' && $row['amount'] !== null;
            })
            ->values()
            ->all();
        $this->merge(['allocations' => $allocations]);
    }

    /**
     * @return array<string, array<mixed>|string>
     */
    public function rules(): array
    {
        $userId = (int) ($this->user()?->id ?? 0);

        $frequencyValues = array_map(
            static fn (IncomePayoutFrequency $c): string => $c->value,
            IncomePayoutFrequency::cases()
        );

        return [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:65535'],
            'company_name' => ['nullable', 'string', 'max:255'],
            'payout_frequency' => ['required', 'string', Rule::in($frequencyValues)],
            'expected_income' => ['required', 'numeric', 'min:0'],
            'accounts' => ['nullable', 'array'],
            'accounts.*.account_id' => [
                'required',
                'integer',
                Rule::exists('accounts', 'id')->where('user_id', $userId),
            ],
            'accounts.*.amount' => ['required', 'numeric', 'min:0'],
            'allocations' => ['nullable', 'array'],
            'allocations.*.allocation_id' => [
                'required',
                'integer',
                Rule::exists('allocations', 'id')->where('user_id', $userId),
            ],
            'allocations.*.amount' => ['required', 'numeric', 'min:0'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $accountIds = collect($this->input('accounts', []))->pluck('account_id');
            if ($accountIds->count() !== $accountIds->unique()->count()) {
                $validator->errors()->add(
                    'accounts',
                    'Each account may only appear once.',
                );
            }

            $allocationIds = collect($this->input('allocations', []))->pluck('allocation_id');
            if ($allocationIds->count() !== $allocationIds->unique()->count()) {
                $validator->errors()->add(
                    'allocations',
                    'Each allocation may only appear once.',
                );
            }
        });
    }
}
