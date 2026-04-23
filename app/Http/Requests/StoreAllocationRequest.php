<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Enums\AllocationType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

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
    }

    /**
     * @return array<string, array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'type' => ['sometimes', new Enum(AllocationType::class)],
            'due_date' => ['nullable', 'date'],
            'goal_amount' => ['nullable', 'numeric'],
        ];
    }
}
