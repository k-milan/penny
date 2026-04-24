<?php

declare(strict_types=1);

namespace App\Enums;

enum AllocationType: string
{
    case Normal = 'normal';
    case Bill = 'bill';
    case Savings = 'savings';
    case Unallocated = 'unallocated';
}
