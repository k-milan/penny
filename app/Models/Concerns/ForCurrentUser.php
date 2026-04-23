<?php

declare(strict_types=1);

namespace App\Models\Concerns;

use Illuminate\Support\Facades\Auth;

trait ForCurrentUser
{
    public function resolveRouteBinding($value, $field = null)
    {
        $field ??= $this->getRouteKeyName();
        $query = static::query()->where($field, $value);
        if (Auth::check()) {
            $query->where($this->getTable().'.user_id', Auth::id());
        }

        return $query->firstOrFail();
    }
}
