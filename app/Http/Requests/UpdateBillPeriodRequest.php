<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\BillPeriod;
use Illuminate\Foundation\Http\FormRequest;

final class UpdateBillPeriodRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $billPeriod = $this->route('billPeriod');

        return $billPeriod instanceof BillPeriod
            && $this->user() !== null
            && (int) $this->user()->id === (int) $billPeriod->user_id;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'due_date' => ['required', 'date'],
            'due_amount' => ['required', 'numeric', 'min:0'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'due_amount.required' => 'Enter the amount due for this bill.',
            'due_amount.min' => 'The amount due cannot be negative.',
        ];
    }
}
