<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class StorePaymentQrCodeRequest extends FormRequest
{
    /** @return array<string, array<mixed>> */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:80', 'unique:payment_qr_codes,name,NULL,id,user_id,'.(string) $this->user()?->id],
            'image' => ['required', 'image', 'mimes:jpeg,png,webp', 'max:5120', 'dimensions:max_width=2000,max_height=2000'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'name.unique' => 'You already have a payment QR code with this name.',
            'image.max' => 'The cropped QR code must be 5 MB or smaller.',
        ];
    }
}
