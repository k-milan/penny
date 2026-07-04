<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\CreateTransaction;
use App\Http\Requests\StoreSimplePurchaseRequest;
use App\Models\User;
use Illuminate\Http\RedirectResponse;

final readonly class PurchaseController
{
    public function store(StoreSimplePurchaseRequest $request, CreateTransaction $action): RedirectResponse
    {
        $user = $request->user();
        assert($user instanceof User);
        $data = $request->validated();
        $amount = number_format((float) $data['total'], 2, '.', '');
        $action->handle($user, [
            'date' => $data['date'],
            'description' => $data['description'],
            'note' => $data['note'] ?? null,
            'accounts' => [[
                'account_id' => $data['payment_account_id'],
                'amount' => '-'.$amount,
            ]],
            'allocations' => [[
                'allocation_id' => $data['allocation_id'],
                'amount' => '-'.$amount,
            ]],
        ]);

        return redirect()->back(302, [], route('dashboard'))->with('success', 'Purchase recorded.');
    }
}
