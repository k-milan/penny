<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Enums\AllocationType;
use App\Support\UnallocatedAmount;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

final class StoreAllocationRequest extends FormRequest
{
    public function prepareForValidation(): void
    {
        if ($this->input('due_date') === '') {
            $this->merge(['due_date' => null]);
        }
        if ($this->input('goal_amount') === '' || $this->input('goal_amount') === null) {
            $this->merge(['goal_amount' => null]);
        }

        $type = AllocationType::tryFrom(
            (string) $this->input('type', AllocationType::Normal->value)
        ) ?? AllocationType::Normal;

        if ($type !== AllocationType::Bill) {
            $this->merge(['due_date' => null]);
        }
        if ($type !== AllocationType::Savings) {
            $this->merge(['goal_amount' => null]);
        }

        if ($this->input('initial_balance') === '' || $this->input('initial_balance') === null) {
            $this->merge(['initial_balance' => null]);
        }
    }

    /**
     * @return array<string, array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'type' => [
                'sometimes',
                Rule::in([
                    AllocationType::Normal->value,
                    AllocationType::Bill->value,
                    AllocationType::Savings->value,
                ]),
            ],
            'due_date' => ['nullable', 'date'],
            'goal_amount' => ['nullable', 'numeric'],
            'initial_balance' => ['nullable', 'numeric', 'min:0'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $raw = $this->input('initial_balance');
            if ($raw === null || $raw === '') {
                return;
            }

            if (! is_numeric($raw)) {
                return;
            }

            $userId = (int) (auth()->id() ?? 0);
            if ($userId === 0) {
                return;
            }

            $amount = bcadd('0.00', (string) $raw, 2);
            $u = UnallocatedAmount::forUserId($userId);

            if (bccomp($amount, $u, 2) > 0) {
                $validator->errors()->add(
                    'initial_balance',
                    'Initial balance cannot be greater than your Unallocated (default) allocation balance.',
                );
            }
        });
    }
}
