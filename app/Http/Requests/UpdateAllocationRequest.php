<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Enums\AllocationType;
use App\Models\Allocation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

final class UpdateAllocationRequest extends FormRequest
{
    public function prepareForValidation(): void
    {
        if ($this->input('due_date') === '') {
            $this->merge(['due_date' => null]);
        }
        if ($this->input('goal_amount') === '') {
            $this->merge(['goal_amount' => null]);
        }

        $type = $this->has('type')
            ? (AllocationType::tryFrom((string) $this->input('type'))
                ?? $this->getAllocation()->type)
            : $this->getAllocation()->type;

        if ($type !== AllocationType::Bill) {
            $this->merge(['due_date' => null]);
        }
        if ($type !== AllocationType::Savings) {
            $this->merge(['goal_amount' => null]);
        }

        if ($this->getAllocation()->is_unallocated) {
            $this->merge([
                'name' => 'Unallocated',
                'type' => AllocationType::Unallocated->value,
            ]);
        }
    }

    /**
     * @return array<string, array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'type' => ['sometimes', new Enum(AllocationType::class)],
            'due_date' => ['nullable', 'date'],
            'goal_amount' => ['nullable', 'numeric'],
            'is_pinned' => ['sometimes', 'boolean'],
        ];
    }

    private function getAllocation(): Allocation
    {
        $allocation = $this->route('allocation');
        assert($allocation instanceof Allocation);

        return $allocation;
    }
}
