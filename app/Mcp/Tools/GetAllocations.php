<?php

declare(strict_types=1);

namespace App\Mcp\Tools;

use App\Http\Resources\AllocationResource;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('get_allocations')]
#[Description('Get your allocations, including IDs, names, types and current decimal balances.')]
#[IsReadOnly]
final class GetAllocations extends PennyTool
{
    public function handle(Request $request): Response
    {
        $records = $this->user($request)->allocations()->orderBy('name')->get();

        return $this->jsonResponse(['allocations' => AllocationResource::collection($records)->resolve()]);
    }
}
