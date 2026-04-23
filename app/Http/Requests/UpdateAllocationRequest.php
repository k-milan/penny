<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Enums\AllocationType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

final class UpdateAllocationRequest extends FormRequest
{
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
        ];
    }
}
