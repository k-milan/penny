<?php

declare(strict_types=1);

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function (): void {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('preview:prune', function (): int {
    $count = app(App\Actions\PrunePreviewUsers::class)->handle();

    $this->info("Pruned {$count} expired preview user(s).");

    return self::SUCCESS;
})->purpose('Delete expired preview users and their data');

Schedule::command('preview:prune')->hourly();
