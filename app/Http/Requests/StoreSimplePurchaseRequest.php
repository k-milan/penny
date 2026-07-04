<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
                'required',
                'integer',
                Rule::exists('allocations', 'id')->where('user_id', $userId),
            ],
            'total' => ['required', 'numeric', 'gt:0'],
        ];
    }
}
