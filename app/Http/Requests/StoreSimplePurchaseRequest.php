<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

final class StoreSimplePurchaseRequest extends FormRequest
{
    public function rules(): array
    {
        $userId = (int) ($this->user()?->id ?? 0);

        return [
            'date' => ['required', 'date'],
            'description' => ['required', 'string', 'max:255'],
            'note' => ['nullable', 'string'],
            'payment_account_id' => [
                'required',
                'integer',
                Rule::exists('accounts', 'id')
                    ->where('user_id', $userId)
                    ->whereNot('type', 'person'),
            ],
            'allocation_id' => [
                'nullable',
                'integer',
                Rule::exists('allocations', 'id')->where('user_id', $userId),
            ],
            'allocations' => ['nullable', 'array'],
            'allocations.*.allocation_id' => [
                'required',
                'integer',
                Rule::exists('allocations', 'id')->where('user_id', $userId),
            ],
            'allocations.*.amount' => ['required', 'numeric', 'gt:0'],
            'total' => ['required', 'numeric', 'gt:0'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $allocations = $this->input('allocations', []);
            $hasAllocationRows = is_array($allocations) && count($allocations) > 0;
            $hasLegacyAllocation = $this->filled('allocation_id');

            if (! $hasAllocationRows && ! $hasLegacyAllocation) {
                $validator->errors()->add('allocations', 'Add at least one allocation.');

                return;
            }

            if (! $hasAllocationRows) {
                return;
            }

            $ids = [];
            $sum = 0.0;
            foreach (array_values($allocations) as $i => $row) {
                if (! is_array($row)) {
                    continue;
                }

                $id = (int) ($row['allocation_id'] ?? 0);
                if ($id > 0) {
                    if (in_array($id, $ids, true)) {
                        $validator->errors()->add("allocations.{$i}.allocation_id", 'Each allocation can only appear once in a purchase.');
                    }
                    $ids[] = $id;
                }

                $sum += (float) ($row['amount'] ?? 0);
            }

            $total = (float) $this->input('total', 0);
            if (abs($sum - $total) > 0.009) {
                $validator->errors()->add('allocations', 'Allocation amounts must add up to the purchase total.');
            }
        });
    }
}
