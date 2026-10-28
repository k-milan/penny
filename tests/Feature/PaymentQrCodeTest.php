<?php

declare(strict_types=1);

use App\Enums\AccountType;
use App\Models\Account;
use App\Models\PaymentQrCode;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

it('lets a user upload a named payment qr code', function (): void {
    Storage::fake('local');
    $user = User::factory()->withoutTwoFactor()->create();

    $this->actingAs($user)->post(route('payment-qr-codes.store', absolute: false), [
        'name' => 'GCash',
        'image' => UploadedFile::fake()->image('gcash.png', 900, 900),
    ])->assertRedirectToRoute('payment-qr-codes.index')->assertSessionHasNoErrors();

    $qrCode = PaymentQrCode::query()->sole();
    expect($qrCode->user_id)->toBe($user->id)
        ->and($qrCode->name)->toBe('GCash')
        ->and($qrCode->public_id)->not->toBeEmpty();
    Storage::disk('local')->assertExists($qrCode->image_path);
});

it('validates payment qr code uploads and unique names per user', function (): void {
    Storage::fake('local');
    $user = User::factory()->withoutTwoFactor()->create();
    PaymentQrCode::query()->create([
        'user_id' => $user->id, 'public_id' => fake()->uuid(), 'name' => 'BPI',
        'image_path' => 'payment-qr-codes/bpi.png',
    ]);

    $this->actingAs($user)->post(route('payment-qr-codes.store', absolute: false), [
        'name' => 'BPI',
        'image' => UploadedFile::fake()->create('not-an-image.pdf', 10, 'application/pdf'),
    ])->assertSessionHasErrors(['name', 'image']);
});

it('shows payment qr codes on the owners shared account links', function (): void {
    $user = User::factory()->withoutTwoFactor()->create();
    $account = Account::query()->create([
        'user_id' => $user->id, 'name' => 'Jamie', 'type' => AccountType::Person,
        'balance' => '200.00', 'share_token' => 'paymentqrcodesharetoken123456789',
    ]);
    $qrCode = PaymentQrCode::query()->create([
        'user_id' => $user->id, 'public_id' => '13c692d1-22b1-4490-a562-5de9b2a4fc56',
        'name' => 'Metrobank', 'image_path' => 'payment-qr-codes/metrobank.png',
    ]);

    $this->get(route('accounts.share', $account->share_token, absolute: false))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('payment_qr_codes', 1)
            ->where('payment_qr_codes.0.id', $qrCode->id)
            ->where('payment_qr_codes.0.name', 'Metrobank')
            ->where('payment_qr_codes.0.image_url', route('payment-qr-codes.image', $qrCode->public_id, absolute: false)));
});

it('prevents users from deleting another users payment qr code', function (): void {
    $owner = User::factory()->withoutTwoFactor()->create();
    $otherUser = User::factory()->withoutTwoFactor()->create();
    $qrCode = PaymentQrCode::query()->create([
        'user_id' => $owner->id, 'public_id' => fake()->uuid(), 'name' => 'BPI',
        'image_path' => 'payment-qr-codes/bpi.png',
    ]);

    $this->actingAs($otherUser)
        ->delete(route('payment-qr-codes.destroy', $qrCode, absolute: false))
        ->assertNotFound();
    expect($qrCode->fresh())->not->toBeNull();
});

it('deletes the stored image with the payment qr code', function (): void {
    Storage::fake('local');
    $user = User::factory()->withoutTwoFactor()->create();
    Storage::disk('local')->put('payment-qr-codes/bpi.png', 'image');
    $qrCode = PaymentQrCode::query()->create([
        'user_id' => $user->id, 'public_id' => fake()->uuid(), 'name' => 'BPI',
        'image_path' => 'payment-qr-codes/bpi.png',
    ]);

    $this->actingAs($user)
        ->delete(route('payment-qr-codes.destroy', $qrCode, absolute: false))
        ->assertRedirectToRoute('payment-qr-codes.index');
    Storage::disk('local')->assertMissing('payment-qr-codes/bpi.png');
    expect($qrCode->fresh())->toBeNull();
});
