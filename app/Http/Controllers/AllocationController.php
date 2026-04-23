<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\CreateAllocation;
use App\Actions\DeleteAllocation;
use App\Actions\UpdateAllocation;
use App\Enums\AllocationType;
use App\Http\Requests\StoreAllocationRequest;
use App\Http\Requests\UpdateAllocationRequest;
use App\Models\Allocation;
use App\Models\User;
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

        $allocations = Allocation::query()
            ->where('user_id', $user->id)
            ->orderBy('name')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('allocations/index', [
            'allocations' => $allocations,
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('allocations/create', [
            'types' => self::allocationTypeOptions(),
        ]);
    }

    public function store(StoreAllocationRequest $request, CreateAllocation $action): RedirectResponse
    {
        $user = $request->user();
        assert($user instanceof User);

        /** @var array{name: string, type?: AllocationType|null, due_date?: \Carbon\CarbonInterface|string|null, goal_amount?: float|int|string|null} $data */
        $data = $request->validated();
        $goal = $data['goal_amount'] ?? null;
        $action->handle($user, [
            'name' => $data['name'],
            'type' => $data['type'] ?? null,
            'due_date' => $data['due_date'] ?? null,
            'goal_amount' => is_numeric($goal) ? (string) $goal : null,
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
            ],
            'types' => self::allocationTypeOptions(),
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
        return array_map(
            static fn (AllocationType $t): array => [
                'value' => $t->value,
                'label' => match ($t) {
                    AllocationType::Normal => 'Normal',
                    AllocationType::Bill => 'Bill',
                    AllocationType::Savings => 'Savings',
                },
            ],
            AllocationType::cases(),
        );
    }
}
