<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\CreatePreviewUser;
use App\Actions\PrunePreviewUsers;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

final readonly class PreviewController
{
    public function __invoke(
        Request $request,
        CreatePreviewUser $createPreviewUser,
        PrunePreviewUsers $prunePreviewUsers,
    ): RedirectResponse {
        $prunePreviewUsers->handle();

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        $user = $createPreviewUser->handle();

        Auth::login($user);
        $request->session()->regenerate();

        return redirect()->route('dashboard')
            ->with('success', 'Preview mode is ready. This data expires automatically.');
    }
}
