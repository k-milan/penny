<?php

declare(strict_types=1);

use Symfony\Component\Process\Process;

it('calculates frontend balances after each newest-first transaction', function (string $balance, array $amounts, array $expected): void {
    $process = new Process([
        'node', '--input-type=module', '-e',
        'import { runningBalances } from "./resources/js/lib/running-balances.ts"; console.log(JSON.stringify(runningBalances(JSON.parse(process.argv[1]), JSON.parse(process.argv[2]).map(amount => ({ amount })))));',
        json_encode($balance, JSON_THROW_ON_ERROR),
        json_encode($amounts, JSON_THROW_ON_ERROR),
    ], dirname(__DIR__, 2));
    $process->mustRun();

    expect(json_decode($process->getOutput(), true, flags: JSON_THROW_ON_ERROR))->toEqual($expected);
})->with([
    'payment and purchases' => ['754.75', ['-1302.00', '245.00', '1200.00'], [754.75, 2056.75, 1811.75]],
    'first loaded page' => ['754.75', ['-1302.00'], [754.75]],
    'negative and zero balances' => ['-10.00', ['-10.00', '20.00', '-5.00'], [-10, 0, -20]],
    'cent precision' => ['0.30', ['0.10', '0.20', '0.00'], [0.3, 0.2, 0]],
    'missing amount' => ['10.00', [null, '0.00'], [10, 10]],
    'no transactions' => ['100.00', [], []],
]);
