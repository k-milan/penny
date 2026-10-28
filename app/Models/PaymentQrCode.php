<?php

declare(strict_types=1);

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property-read int $id
 * @property-read int $user_id
 * @property-read string $public_id
 * @property-read string $name
 * @property-read string $image_path
 * @property-read CarbonInterface $created_at
 * @property-read CarbonInterface $updated_at
 * @property-read User $user
 */
final class PaymentQrCode extends Model
{
    /** @return array<string, string> */
    public function casts(): array
    {
        return [
            'id' => 'integer', 'user_id' => 'integer', 'public_id' => 'string',
            'name' => 'string', 'image_path' => 'string',
            'created_at' => 'datetime', 'updated_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
