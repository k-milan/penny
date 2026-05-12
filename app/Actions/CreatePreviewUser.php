<?php

declare(strict_types=1);

namespace App\Actions;

use App\Enums\AccountType;
use App\Enums\AllocationType;
use App\Enums\IncomePayoutFrequency;
use App\Models\Account;
use App\Models\Allocation;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

final readonly class CreatePreviewUser
{
    public function __construct(
        private CreateTransaction $createTransaction,
        private CreateIncomeTemplate $createIncomeTemplate,
    ) {
        //
    }

    public function handle(): User
    {
        return DB::transaction(function (): User {
            $user = User::query()->create([
                'name' => 'Preview Guest',
                'email' => 'preview+'.Str::uuid()->toString().'@penny.local',
                'email_verified_at' => now(),
                'preview_expires_at' => now()->addHours(6),
                'password' => Hash::make(Str::password(32)),
            ]);

            $checking = Account::query()->create([
                'user_id' => $user->id,
                'name' => 'Everyday Checking',
                'type' => AccountType::Bank,
                'balance' => '0.00',
            ]);
            $savings = Account::query()->create([
                'user_id' => $user->id,
                'name' => 'Emergency Savings',
                'type' => AccountType::Bank,
                'balance' => '0.00',
            ]);
            $card = Account::query()->create([
                'user_id' => $user->id,
                'name' => 'Rewards Card',
                'type' => AccountType::CreditCard,
                'balance' => '0.00',
            ]);

            $rent = Allocation::query()->create([
                'user_id' => $user->id,
                'name' => 'Rent',
                'type' => AllocationType::Bill,
                'due_date' => now()->addMonth()->day(1)->toDateString(),
                'goal_amount' => '1800.00',
                'balance' => '0.00',
            ]);
            $groceries = Allocation::query()->create([
                'user_id' => $user->id,
                'name' => 'Groceries',
                'type' => AllocationType::Normal,
                'due_date' => null,
                'goal_amount' => '650.00',
                'balance' => '0.00',
            ]);
            $travel = Allocation::query()->create([
                'user_id' => $user->id,
                'name' => 'Travel Fund',
                'type' => AllocationType::Savings,
                'due_date' => now()->addMonths(4)->toDateString(),
                'goal_amount' => '2400.00',
                'balance' => '0.00',
            ]);
            $unallocated = Allocation::query()
                ->where('user_id', $user->id)
                ->where('is_unallocated', true)
                ->firstOrFail();

            $this->createTransaction->handle($user, [
                'date' => now()->subDays(6)->toDateString(),
                'description' => 'Paycheck',
                'note' => 'Seeded preview income',
                'accounts' => [
                    ['account_id' => $checking->id, 'amount' => '3200.00'],
                    ['account_id' => $savings->id, 'amount' => '500.00'],
                ],
                'allocations' => [
                    ['allocation_id' => $rent->id, 'amount' => '1800.00'],
                    ['allocation_id' => $groceries->id, 'amount' => '450.00'],
                    ['allocation_id' => $travel->id, 'amount' => '500.00'],
                ],
            ]);

            $this->createTransaction->handle($user, [
                'date' => now()->subDays(3)->toDateString(),
                'description' => 'Neighborhood Market',
                'note' => null,
                'accounts' => [
                    ['account_id' => $card->id, 'amount' => '-84.37'],
                ],
                'allocations' => [
                    ['allocation_id' => $groceries->id, 'amount' => '-84.37'],
                ],
            ]);

            $this->createTransaction->handle($user, [
                'date' => now()->subDay()->toDateString(),
                'description' => 'Coffee with Sam',
                'note' => null,
                'accounts' => [
                    ['account_id' => $checking->id, 'amount' => '-12.50'],
                ],
                'allocations' => [
                    ['allocation_id' => $unallocated->id, 'amount' => '-12.50'],
                ],
            ]);

            $this->createIncomeTemplate->handle($user, [
                'name' => 'Primary paycheck',
                'description' => 'Preview income template',
                'company_name' => 'Acme Studio',
                'payout_frequency' => IncomePayoutFrequency::SemiMonthly,
                'expected_income' => '3700.00',
                'accounts' => [
                    ['account_id' => $checking->id, 'amount' => '3200.00'],
                    ['account_id' => $savings->id, 'amount' => '500.00'],
                ],
                'allocations' => [
                    ['allocation_id' => $rent->id, 'amount' => '1800.00'],
                    ['allocation_id' => $groceries->id, 'amount' => '450.00'],
                    ['allocation_id' => $travel->id, 'amount' => '500.00'],
                ],
            ]);

            return $user;
        });
    }
}
