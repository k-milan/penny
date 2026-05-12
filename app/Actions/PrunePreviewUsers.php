<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\User;

final readonly class PrunePreviewUsers
{
    public function __construct(private DeleteUser $deleteUser)
    {
        //
    }

    public function handle(): int
    {
        $count = 0;

        User::query()
            ->whereNotNull('preview_expires_at')
            ->where('preview_expires_at', '<=', now())
            ->orderBy('id')
            ->each(function (User $user) use (&$count): void {
                $this->deleteUser->handle($user);
                $count++;
            });

        return $count;
    }
}
