<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

final class StoreTransactionRequest extends FormRequest
{
    public function prepareForValidation(): void
    {
        $this->mergeIfMissing([
            'accounts' => [],
            'allocations' => [],
        ]);
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
            }
        });
    }
}
