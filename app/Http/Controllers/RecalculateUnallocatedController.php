<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\RecalculateUnallocated;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

final readonly class RecalculateUnallocatedController
{
    public function __invoke(Request $request, RecalculateUnallocated $action): RedirectResponse
    {
        $user = $request->user();
        assert($user instanceof User);

        $action->handle($user);

        return redirect()->back()->with('success', 'Unallocated balance recalculated.');
    }
}
