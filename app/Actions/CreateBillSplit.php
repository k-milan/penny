<?php

declare(strict_types=1);

namespace App\Actions;

use App\Enums\AccountType;
use App\Models\Account;
use App\Models\Allocation;
use App\Models\BillSplit;
use App\Models\BillSplitParticipant;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final readonly class CreateBillSplit
{
    public function __construct(private CreateTransaction $createTransaction) {}

    /** @param array<string, mixed> $data */
    public function handle(User $user, array $data): Transaction
    {
        return DB::transaction(function () use ($user, $data): Transaction {
            $totalCents = self::cents($data['total']);
            $serviceCents = self::cents($data['service_charge'] ?? 0);
            $items = $data['items'];
            $subtotalCents = array_sum(array_map(
                static fn (array $item): int => self::cents($item['unit_price']) * (int) $item['quantity'],
                $items
            ));

            if ($subtotalCents + $serviceCents !== $totalCents) {
                throw ValidationException::withMessages([
                    'total' => 'Item totals plus service charge must equal the receipt total.',
                ]);
            }

            /** @var array<string, array{type: string, id: int, item_cents: int, service_cents: int}> $participants */
            $participants = [];
            /** @var list<array{description: string, amount_cents: int, shares: array<string, int>}> $calculatedItems */
            $calculatedItems = [];
            /** @var array<string, int> $newPeople */
            $newPeople = [];

            foreach ($items as $itemIndex => $item) {
                $itemAmountCents = self::cents($item['unit_price']) * (int) $item['quantity'];
                $keys = [];
                foreach ($item['assignees'] as $assigneeIndex => $assignee) {
                    $resolved = $this->resolveAssignee(
                        $user,
                        $assignee,
                        "items.{$itemIndex}.assignees.{$assigneeIndex}",
                        $newPeople
                    );
                    $key = "{$resolved['type']}:{$resolved['id']}";
                    if (in_array($key, $keys, true)) {
                        throw ValidationException::withMessages([
                            "items.{$itemIndex}.assignees" => 'An assignee can only appear once on an item.',
                        ]);
                    }
                    $keys[] = $key;
                    $participants[$key] ??= [
                        ...$resolved,
                        'item_cents' => 0,
                        'service_cents' => 0,
                    ];
                }

                $shares = self::splitEvenly($itemAmountCents, count($keys));
                $itemShares = [];
                foreach ($keys as $i => $key) {
                    $participants[$key]['item_cents'] += $shares[$i];
                    $itemShares[$key] = $shares[$i];
                }
                $calculatedItems[] = [
                    'description' => mb_trim((string) $item['description']),
                    'quantity' => (int) $item['quantity'],
                    'unit_price_cents' => self::cents($item['unit_price']),
                    'amount_cents' => $itemAmountCents,
                    'shares' => $itemShares,
                ];
            }

            $serviceShares = self::splitProportionally(
                $serviceCents,
                array_map(static fn (array $p): int => $p['item_cents'], $participants)
            );
            foreach ($serviceShares as $key => $cents) {
                $participants[$key]['service_cents'] = $cents;
            }

            $accountLines = [[
                'account_id' => (int) $data['payment_account_id'],
                'amount' => self::money(-$totalCents),
            ]];
            $allocationLines = [];
            foreach ($participants as $participant) {
                $participantTotal = $participant['item_cents'] + $participant['service_cents'];
                if ($participant['type'] === 'account') {
                    $accountLines[] = [
                        'account_id' => $participant['id'],
                        'amount' => self::money($participantTotal),
                    ];
                } else {
                    $allocationLines[] = [
                        'allocation_id' => $participant['id'],
                        'amount' => self::money(-$participantTotal),
                    ];
                }
            }

            $transaction = $this->createTransaction->handle($user, [
                'date' => $data['date'],
                'description' => mb_trim((string) $data['description']),
                'note' => $data['note'] ?? null,
                'accounts' => $accountLines,
                'allocations' => $allocationLines,
            ]);

            $bill = BillSplit::query()->create([
                'transaction_id' => $transaction->id,
                'subtotal' => self::money($subtotalCents),
                'service_charge' => self::money($serviceCents),
                'discount' => '0.00',
                'total' => self::money($totalCents),
            ]);

            /** @var array<string, BillSplitParticipant> $participantModels */
            $participantModels = [];
            foreach ($participants as $key => $participant) {
                $participantModels[$key] = $bill->participants()->create([
                    'account_id' => $participant['type'] === 'account' ? $participant['id'] : null,
                    'allocation_id' => $participant['type'] === 'allocation' ? $participant['id'] : null,
                    'item_subtotal' => self::money($participant['item_cents']),
                    'service_charge' => self::money($participant['service_cents']),
                    'discount' => '0.00',
                    'total' => self::money($participant['item_cents'] + $participant['service_cents']),
                ]);
            }

            foreach ($calculatedItems as $position => $item) {
                $itemModel = $bill->items()->create([
                    'description' => $item['description'],
                    'quantity' => $item['quantity'],
                    'unit_price' => self::money($item['unit_price_cents']),
                    'amount' => self::money($item['amount_cents']),
                    'position' => $position,
                ]);
                foreach ($item['shares'] as $key => $cents) {
                    $itemModel->participants()->attach($participantModels[$key]->id, [
                        'amount' => self::money($cents),
                    ]);
                }
            }

            return $transaction->load('billSplit.items', 'billSplit.participants');
        });
    }

    /** @return list<int> */
    private static function splitEvenly(int $cents, int $count): array
    {
        $base = intdiv($cents, $count);
        $remainder = $cents % $count;

        return array_map(
            static fn (int $i): int => $base + ($i < $remainder ? 1 : 0),
            range(0, $count - 1)
        );
    }

    /** @param array<string, int> $weights @return array<string, int> */
    private static function splitProportionally(int $cents, array $weights): array
    {
        $result = array_fill_keys(array_keys($weights), 0);
        $totalWeight = array_sum($weights);
        if ($cents === 0 || $totalWeight === 0) {
            return $result;
        }
        $used = 0;
        $remainders = [];
        foreach ($weights as $key => $weight) {
            $product = $cents * $weight;
            $result[$key] = intdiv($product, $totalWeight);
            $used += $result[$key];
            $remainders[$key] = $product % $totalWeight;
        }
        arsort($remainders, SORT_NUMERIC);
        foreach (array_keys($remainders) as $key) {
            if ($used >= $cents) {
                break;
            }
            $result[$key]++;
            $used++;
        }

        return $result;
    }

    private static function cents(mixed $amount): int
    {
        return (int) round((float) $amount * 100);
    }

    private static function money(int $cents): string
    {
        return number_format($cents / 100, 2, '.', '');
    }

    /** @param array<string, mixed> $assignee @return array{type: string, id: int} */
    private function resolveAssignee(User $user, array $assignee, string $path, array &$newPeople): array
    {
        $type = (string) ($assignee['type'] ?? '');
        if ($type === 'account') {
            $account = Account::query()
                ->where('user_id', $user->id)
                ->where('type', AccountType::Person)
                ->find($assignee['id'] ?? 0);
            if (! $account) {
                throw ValidationException::withMessages([$path => 'Select a valid person account.']);
            }

            return ['type' => 'account', 'id' => (int) $account->id];
        }
        if ($type === 'allocation') {
            $allocation = Allocation::query()->where('user_id', $user->id)->find($assignee['id'] ?? 0);
            if (! $allocation) {
                throw ValidationException::withMessages([$path => 'Select a valid allocation.']);
            }

            return ['type' => 'allocation', 'id' => (int) $allocation->id];
        }
        if ($type === 'new_person') {
            $name = mb_trim((string) ($assignee['name'] ?? ''));
            if ($name === '') {
                throw ValidationException::withMessages([$path => 'Enter a person name.']);
            }
            $normalizedName = mb_strtolower($name);
            if (isset($newPeople[$normalizedName])) {
                return ['type' => 'account', 'id' => $newPeople[$normalizedName]];
            }
            $existing = Account::query()
                ->where('user_id', $user->id)
                ->where('type', AccountType::Person)
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
                ->first();
            if ($existing) {
                throw ValidationException::withMessages([
                    $path => 'A person with this name already exists. Select them instead.',
                ]);
            }
            $account = Account::query()->create([
                'user_id' => $user->id,
                'name' => $name,
                'type' => AccountType::Person,
                'balance' => '0.00',
            ]);
            $newPeople[$normalizedName] = (int) $account->id;

            return ['type' => 'account', 'id' => (int) $account->id];
        }

        throw ValidationException::withMessages([$path => 'Select a valid assignee.']);
    }
}
