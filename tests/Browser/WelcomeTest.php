<?php

declare(strict_types=1);

it('renders the public landing page', function (): void {
    $page = visit('/');

    $page->assertSee('Penny');
});
