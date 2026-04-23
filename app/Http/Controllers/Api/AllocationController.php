<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Actions\CreateAllocation;
use App\Actions\DeleteAllocation;
use App\Actions\UpdateAllocation;
use App\Http\Requests\StoreAllocationRequest;
use App\Http\Requests\UpdateAllocationRequest;
use App\Http\Resources\AllocationResource;
use App\Models\Allocation;
use App\Models\User;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Pagination\LengthAwarePaginator;

final readonly class AllocationController
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        assert($user instanceof User);

        /** @var LengthAwarePaginator<int, Allocation> $allocations */
        $allocations = Allocation::query()
            ->where('user_id', $user->id)
            ->orderBy('name')
            ->paginate($request->integer('per_page', 15));

        return AllocationResource::collection($allocations)->response();
    }

    public function store(StoreAllocationRequest $request, CreateAllocation $action): JsonResponse
    {
        $user = $request->user();
        assert($user instanceof User);

        /** @var array{name: string, type?: \App\Enums\AllocationType|null, due_date?: \Carbon\CarbonInterface|null, goal_amount?: float|int} $data */
        $data = $request->validated();
        $goal = $data['goal_amount'] ?? null;
        $allocation = $action->handle($user, [
            'name' => $data['name'],
            'type' => $data['type'] ?? null,
            'due_date' => $data['due_date'] ?? null,
            'goal_amount' => is_numeric($goal) ? (string) $goal : null,
        ]);

        return (new AllocationResource($allocation))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(Allocation $allocation): JsonResponse
    {
        return (new AllocationResource($allocation))->response();
    }

    public function update(UpdateAllocationRequest $request, Allocation $allocation, UpdateAllocation $action): JsonResponse
    {
        $action->handle($allocation, $request->validated());

        $allocation->refresh();

        return (new AllocationResource($allocation))->response();
    }

    public function destroy(Allocation $allocation, DeleteAllocation $action): JsonResponse|Response
    {
        try {
            $action->handle($allocation);
        } catch (DomainException $e) {
            return response()->json(['message' => $e->getMessage()], Response::HTTP_CONFLICT);
        }

        return response()->noContent();
    }
}
