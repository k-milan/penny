<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\CreateBillSplit;
use App\Http\Requests\StoreBillSplitRequest;
use App\Http\Resources\AccountResource;
use App\Http\Resources\AllocationResource;
use App\Models\Account;
use App\Models\Allocation;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final readonly class BillSplitController
{
    public function create(Request $request): Response
    {
        $user = $request->user();
        assert($user instanceof User);

        $accounts = Account::query()
            ->where('user_id', $user->id)
            ->orderByDesc('is_pinned')
            ->orderBy('name')
            ->get();
        $allocations = Allocation::query()
            ->where('user_id', $user->id)
            ->orderByDesc('is_pinned')
            ->orderBy('name')
            ->get();

        return Inertia::render('bill-splits/create', [
            'accounts' => AccountResource::collection($accounts)->resolve(),
            'allocations' => AllocationResource::collection($allocations)->resolve(),
        ]);
    }

    public function store(StoreBillSplitRequest $request, CreateBillSplit $action): RedirectResponse
    {
        $user = $request->user();
        assert($user instanceof User);
        $action->handle($user, $request->validated());

        return redirect()->route('transactions.index')->with('success', 'Bill split saved.');
    }
}
