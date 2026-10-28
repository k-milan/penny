<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\PaymentQrCode;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;

final readonly class StorePaymentQrCode
{
    public function handle(User $user, string $name, UploadedFile $image): PaymentQrCode
    {
        return PaymentQrCode::query()->create([
            'user_id' => $user->id,
            'public_id' => (string) Str::uuid(),
            'name' => $name,
            'image_path' => $image->store('payment-qr-codes', 'local'),
        ]);
    }
}
