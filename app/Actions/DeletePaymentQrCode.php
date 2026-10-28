<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\PaymentQrCode;
use Illuminate\Support\Facades\Storage;

final readonly class DeletePaymentQrCode
{
    public function handle(PaymentQrCode $paymentQrCode): void
    {
        Storage::disk('local')->delete($paymentQrCode->image_path);
        $paymentQrCode->delete();
    }
}
