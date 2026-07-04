<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Actions\CreateAccount;
use App\Actions\DeleteAccount;
use App\Actions\UpdateAccount;
use App\Http\Requests\StoreAccountRequest;
use App\Http\Requests\UpdateAccountRequest;
use App\Http\Resources\AccountResource;
use App\Models\Account;
use App\Models\User;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Pagination\LengthAwarePaginator;

final readonly class AccountController
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        assert($user instanceof User);

        /** @var LengthAwarePaginator<int, Account> $accounts */
        $accounts = Account::query()
            ->where('user_id', $user->id)
            ->orderByDesc('is_pinned')
            ->orderBy('name')
            ->paginate($request->integer('per_page', 15));

        return AccountResource::collection($accounts)->response();
    }

    public function store(StoreAccountRequest $request, CreateAccount $action): JsonResponse
    {
        $user = $request->user();
        assert($user instanceof User);

        /** @var array{name: string, type: \App\Enums\AccountType, initial_balance?: float|int|string|null} $data */
        $data = $request->validated();
        $initial = $data['initial_balance'] ?? null;
        $account = $action->handle($user, [
            'name' => $data['name'],
            'type' => $data['type'],
            'initial_balance' => is_numeric($initial) ? (string) $initial : null,
        ]);

        return (new AccountResource($account))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(Account $account): JsonResponse
    {
        return (new AccountResource($account))->response();
    }

    public function update(UpdateAccountRequest $request, Account $account, UpdateAccount $action): JsonResponse
    {
        $action->handle($account, $request->validated());

        $account->refresh();

        return (new AccountResource($account))->response();
    }

    public function destroy(Account $account, DeleteAccount $action): JsonResponse|Response
    {
        try {
            $action->handle($account);
        } catch (DomainException $e) {
            return response()->json(['message' => $e->getMessage()], Response::HTTP_CONFLICT);
        }

        return response()->noContent();
    }
}
