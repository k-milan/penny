<?php

declare(strict_types=1);

use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\AllocationController;
use App\Http\Controllers\Api\TransactionController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function (): void {
    // `as` avoids clashing with web Route::resource names (e.g. accounts.index).
    Route::apiResource('accounts', AccountController::class, ['as' => 'api']);
    Route::apiResource('allocations', AllocationController::class, ['as' => 'api']);
    Route::apiResource('transactions', TransactionController::class, ['as' => 'api']);
});
