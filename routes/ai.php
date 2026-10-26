<?php

declare(strict_types=1);

use App\Mcp\Servers\PennyServer;
use Laravel\Mcp\Facades\Mcp;

Mcp::web('/mcp/penny', PennyServer::class)->middleware(['auth:mcp', 'throttle:60,1']);
