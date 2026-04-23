<?php

declare(strict_types=1);

use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\AllocationController;
use App\Http\Controllers\Api\TransactionController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function (): void {
    Route::apiResource('accounts', AccountController::class);
    Route::apiResource('allocations', AllocationController::class);
    Route::apiResource('transactions', TransactionController::class);
});
