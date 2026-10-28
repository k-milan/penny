<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\DeletePaymentQrCode;
use App\Actions\StorePaymentQrCode;
use App\Http\Requests\StorePaymentQrCodeRequest;
use App\Models\PaymentQrCode;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

final readonly class PaymentQrCodeController
{
    /** @return list<array{id: int, name: string, image_url: string}> */
    public static function forUser(User $user): array
    {
        return PaymentQrCode::query()->where('user_id', $user->id)->orderBy('name')->get()
            ->map(static fn (PaymentQrCode $qrCode): array => [
                'id' => $qrCode->id,
                'name' => $qrCode->name,
                'image_url' => route('payment-qr-codes.image', $qrCode->public_id, absolute: false),
            ])->values()->all();
    }

    public function index(Request $request): Response
    {
        $user = $request->user();
        assert($user instanceof User);

        return Inertia::render('payment-qr-codes/index', ['payment_qr_codes' => self::forUser($user)]);
    }

    public function store(StorePaymentQrCodeRequest $request, StorePaymentQrCode $action): RedirectResponse
    {
        $user = $request->user();
        assert($user instanceof User);

        $action->handle($user, (string) $request->validated('name'), $request->file('image'));

        return redirect()->route('payment-qr-codes.index')->with('success', 'Payment QR code added.');
    }

    public function destroy(Request $request, int $paymentQrCode, DeletePaymentQrCode $action): RedirectResponse
    {
        $user = $request->user();
        assert($user instanceof User);
        $qrCode = PaymentQrCode::query()->where('user_id', $user->id)->findOrFail($paymentQrCode);
        $action->handle($qrCode);

        return redirect()->route('payment-qr-codes.index')->with('success', 'Payment QR code removed.');
    }

    public function image(string $publicId): BinaryFileResponse
    {
        $qrCode = PaymentQrCode::query()->where('public_id', $publicId)->firstOrFail();

        return response()->file(Storage::disk('local')->path($qrCode->image_path), [
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }
}
