<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\AccountType;
use App\Models\Account;
use App\Models\Transaction;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final readonly class PublicAccountShareController
{
    public function __invoke(Request $request, string $token): Response
    {
        $account = Account::query()
            ->where('share_token', $token)
            ->where('type', AccountType::Person)
            ->with('user')
            ->firstOrFail();

        return Inertia::render('accounts/share', [
            'account' => [
                'name' => $account->name,
                'balance' => (string) $account->balance,
            ],
            'owner_name' => $account->user->name,
            'transactions' => Inertia::scroll(
                static function () use ($account): mixed {
                    $paginator = Transaction::query()
                        ->whereHas(
                            'transactionAccounts',
                            static fn ($q) => $q->where('account_id', $account->id)
                        )
                        ->with([
                            'transactionAccounts' => static fn ($q) => $q->where('account_id', $account->id),
                            'billSplit.participants' => static fn ($q) => $q->where('account_id', $account->id),
                            'billSplit.items.participants' => static fn ($q) => $q->where('account_id', $account->id),
                        ])
                        ->orderByDesc('date')
                        ->orderByDesc('created_at')
                        ->orderByDesc('id')
                        ->paginate(30, ['*'], 'transactions');

                    return $paginator->through(static function (Transaction $t) use ($account): array {
                        /** @var \App\Models\TransactionAccount|null $line */
                        $line = $t->transactionAccounts->first();
                        $participant = $t->billSplit?->participants->firstWhere('account_id', $account->id);
                        $bill = null;
                        if ($participant !== null && $t->billSplit !== null) {
                            $bill = [
                                'items' => $t->billSplit->items->map(static function ($item) use ($participant): ?array {
                                    $assigned = $item->participants->firstWhere('id', $participant->id);
                                    if ($assigned === null) {
                                        return null;
                                    }

                                    return [
                                        'description' => $item->description,
                                        'shares' => (int) $assigned->pivot->shares,
                                        'amount' => bcadd('0.00', (string) $assigned->pivot->amount, 2),
                                    ];
                                })->filter()->values()->all(),
                                'item_subtotal' => (string) $participant->item_subtotal,
                                'service_charge' => (string) $participant->service_charge,
                                'discount' => (string) $participant->discount,
                                'total' => (string) $participant->total,
                            ];
                        }

                        return [
                            'id' => $t->id,
                            'date' => $t->date->format('Y-m-d'),
                            'description' => $t->description,
                            'note' => $t->note,
                            'amount' => $line !== null ? (string) $line->amount : null,
                            'bill' => $bill,
                        ];
                    });
                }
            ),
        ]);
    }
}
