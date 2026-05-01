<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Resources\AccountResource;
use App\Http\Resources\AllocationResource;
use App\Http\Resources\TransactionResource;
use App\Models\Account;
use App\Models\Allocation;
use App\Models\Transaction;
use App\Models\User;
use App\Support\UnallocatedAmount;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final readonly class DashboardController
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();
        assert($user instanceof User);

        $accounts = Account::query()
            ->where('user_id', $user->id)
            ->orderBy('name', 'asc')
            ->get();

        $allocations = Allocation::query()
            ->where('user_id', $user->id)
            ->where('is_unallocated', false)
            ->orderBy('name', 'asc')
            ->get();

        $unallocatedAllocationId = Allocation::query()
            ->where('user_id', $user->id)
            ->where('is_unallocated', true)
            ->value('id');

        return Inertia::render('dashboard', [
            'accounts' => AccountResource::collection($accounts)->resolve(),
            'allocations' => AllocationResource::collection($allocations)->resolve(),
            'unallocated' => UnallocatedAmount::forUserId($user->id),
            'unallocated_allocation_id' => $unallocatedAllocationId !== null
                ? (int) $unallocatedAllocationId
                : null,
            'recentTransactions' => Inertia::scroll(
                static function () use ($user) {
                    $paginator = Transaction::query()
                        ->where('user_id', $user->id)
                        ->with([
                            'transactionAccounts.account',
                            'transactionAllocations.allocation',
                        ])
                        ->orderByDesc('date')
                        ->orderByDesc('created_at')
                        ->orderByDesc('id')
                        ->paginate(10, ['*'], 'recent_transactions');

                    return $paginator->through(
                        static fn (Transaction $transaction): array => (new TransactionResource($transaction))->resolve(request())
                    );
                }
            ),
        ]);
    }
}
