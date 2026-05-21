<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\CreateAllocation;
use App\Actions\DeleteAllocation;
use App\Actions\UpdateAllocation;
use App\Enums\AllocationType;
use App\Http\Requests\StoreAllocationRequest;
use App\Http\Requests\UpdateAllocationRequest;
use App\Http\Resources\AccountResource;
use App\Http\Resources\AllocationResource;
use App\Http\Resources\TransactionResource;
use App\Models\Account;
use App\Models\Allocation;
use App\Models\Transaction;
use App\Models\User;
use App\Support\UnallocatedAmount;
use DomainException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final readonly class AllocationController
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        assert($user instanceof User);

        $defaultUnallocated = Allocation::query()
            ->where('user_id', $user->id)
            ->where('is_unallocated', true)
            ->first();

        $allocations = Allocation::query()
            ->where('user_id', $user->id)
            ->where('is_unallocated', false)
            ->orderBy('name')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('allocations/index', [
            'allocations' => $allocations,
            'defaultUnallocated' => $defaultUnallocated
                ? (new AllocationResource($defaultUnallocated))->resolve()
                : null,
        ]);
    }

    public function show(Request $request, Allocation $allocation): Response
    {
        $user = $request->user();
        assert($user instanceof User);

        $accounts = Account::query()
            ->where('user_id', $user->id)
            ->orderBy('name')
            ->get();

        $allAllocations = Allocation::query()
            ->where('user_id', $user->id)
            ->orderBy('name')
            ->get();

        $unallocatedAllocationId = Allocation::query()
            ->where('user_id', $user->id)
            ->where('is_unallocated', true)
            ->value('id');

        return Inertia::render('allocations/show', [
            'allocation' => [
                'id' => $allocation->id,
                'name' => $allocation->name,
                'type' => $allocation->type->value,
                'balance' => (string) $allocation->balance,
                'is_unallocated' => $allocation->is_unallocated,
            ],
            'accounts' => AccountResource::collection($accounts)->resolve(),
            'allocations' => AllocationResource::collection($allAllocations)->resolve(),
            'unallocated_allocation_id' => $unallocatedAllocationId !== null
                ? (int) $unallocatedAllocationId
                : null,
            'transactions' => Inertia::scroll(
                static function () use ($allocation): mixed {
                    $paginator = Transaction::query()
                        ->whereHas(
                            'transactionAllocations',
                            static fn ($q) => $q->where('allocation_id', $allocation->id)
                        )
                        ->with([
                            'transactionAccounts.account',
                            'transactionAllocations.allocation',
                        ])
                        ->orderByDesc('date')
                        ->orderByDesc('created_at')
                        ->orderByDesc('id')
                        ->paginate(20, ['*'], 'transactions');

                    return $paginator->through(
                        static fn (Transaction $t): array => (new TransactionResource($t))->resolve(request())
                    );
                }
            ),
        ]);
    }

    public function create(Request $request): Response
    {
        $user = $request->user();
        assert($user instanceof User);

        return Inertia::render('allocations/create', [
            'types' => self::allocationTypeOptions(),
            'unallocated' => UnallocatedAmount::forUserId($user->id),
        ]);
    }

    public function store(StoreAllocationRequest $request, CreateAllocation $action): RedirectResponse
    {
        $user = $request->user();
        assert($user instanceof User);

        /** @var array{name: string, type?: AllocationType|null, due_date?: \Carbon\CarbonInterface|string|null, goal_amount?: float|int|string|null, initial_balance?: float|int|string|null} $data */
        $data = $request->validated();
        $goal = $data['goal_amount'] ?? null;
        $initial = $data['initial_balance'] ?? null;
        $action->handle($user, [
            'name' => $data['name'],
            'type' => $data['type'] ?? null,
            'due_date' => $data['due_date'] ?? null,
            'goal_amount' => is_numeric($goal) ? (string) $goal : null,
            'initial_balance' => is_numeric($initial) ? (string) $initial : null,
        ]);

        return redirect()->route('allocations.index')
            ->with('success', 'Allocation created.');
    }

    public function edit(Allocation $allocation): Response
    {
        return Inertia::render('allocations/edit', [
            'allocation' => [
                'id' => $allocation->id,
                'name' => $allocation->name,
                'type' => $allocation->type->value,
                'due_date' => $allocation->due_date?->format('Y-m-d') ?? '',
                'goal_amount' => $allocation->goal_amount === null ? '' : (string) $allocation->goal_amount,
                'balance' => (string) $allocation->balance,
                'is_unallocated' => $allocation->is_unallocated,
            ],
            'types' => $allocation->is_unallocated ? [] : self::allocationTypeOptions(),
        ]);
    }

    public function update(UpdateAllocationRequest $request, Allocation $allocation, UpdateAllocation $action): RedirectResponse
    {
        $attributes = $request->validated();
        if (array_key_exists('goal_amount', $attributes)) {
            $g = $attributes['goal_amount'];
            $attributes['goal_amount'] = ($g === null || $g === '') ? null : $g;
        }

        $action->handle($allocation, $attributes);

        return redirect()->route('allocations.index')
            ->with('success', 'Allocation updated.');
    }

    public function destroy(Allocation $allocation, DeleteAllocation $action): RedirectResponse
    {
        try {
            $action->handle($allocation);
        } catch (DomainException $e) {
            return redirect()
                ->route('allocations.index')
                ->with('error', $e->getMessage());
        }

        return redirect()
            ->route('allocations.index')
            ->with('success', 'Allocation deleted.');
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    private static function allocationTypeOptions(): array
    {
        $types = array_values(array_filter(
            AllocationType::cases(),
            static fn (AllocationType $t): bool => $t !== AllocationType::Unallocated
        ));

        return array_map(
            static fn (AllocationType $t): array => [
                'value' => $t->value,
                'label' => match ($t) {
                    AllocationType::Normal => 'Normal',
                    AllocationType::Bill => 'Bill',
                    AllocationType::Savings => 'Savings',
                },
            ],
            $types
        );
    }
}
