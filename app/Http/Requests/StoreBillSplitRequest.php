<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreBillSplitRequest extends FormRequest
{
    public function prepareForValidation(): void
    {
        $this->mergeIfMissing(['note' => null, 'service_charge' => 0]);
    }

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
                Rule::exists('accounts', 'id')->where('user_id', $userId)->whereNot('type', 'person'),
            ],
            'total' => ['required', 'numeric', 'gt:0'],
            'service_charge' => ['nullable', 'numeric', 'min:0'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.description' => ['required', 'string', 'max:255'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.unit_price' => ['required', 'numeric', 'gt:0'],
            'items.*.assignees' => ['required', 'array', 'min:1'],
            'items.*.assignees.*.type' => ['required', Rule::in(['account', 'allocation', 'new_person'])],
            'items.*.assignees.*.id' => ['nullable', 'integer'],
            'items.*.assignees.*.name' => ['nullable', 'string', 'max:255'],
        ];
    }
}
