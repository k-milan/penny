<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Enums\AccountType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

final class StoreAccountRequest extends FormRequest
{
    public function prepareForValidation(): void
    {
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
            'type' => ['required', new Enum(AccountType::class)],
            'initial_balance' => ['nullable', 'numeric'],
        ];
    }
}
