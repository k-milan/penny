<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Enums\AccountType;
use App\Models\Account;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;
use Illuminate\Validation\Validator;

final class UpdateAccountRequest extends FormRequest
{
    /**
     * @return array<string, array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'type' => ['sometimes', new Enum(AccountType::class)],
            'is_pinned' => ['sometimes', 'boolean'],
            'opening_balance_items' => ['sometimes', 'array', 'max:50'],
            'opening_balance_items.*.description' => ['required_with:opening_balance_items', 'string', 'max:255'],
            'opening_balance_items.*.amount' => ['required_with:opening_balance_items', 'numeric', 'not_in:0'],
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if (! $this->has('opening_balance_items')) {
                return;
            }

            $account = $this->route('account');
            assert($account instanceof Account);

            $type = $this->input('type', $account->type->value);
            if ($type !== AccountType::Person->value) {
                $validator->errors()->add('opening_balance_items', 'Only person accounts can have an opening balance breakdown.');

                return;
            }

            $items = $this->input('opening_balance_items', []);
            assert(is_array($items));
            if ($items === [] && ! $account->openingBalanceItems()->exists()) {
                return;
            }

            $total = '0.00';
            foreach ($items as $item) {
                if (! is_array($item) || ! is_numeric($item['amount'] ?? null)) {
                    return;
                }

                $total = bcadd($total, (string) $item['amount'], 2);
            }

            $transactionTotal = (string) $account->transactionAccounts()->sum('amount');
            $openingBalance = bcsub((string) $account->balance, $transactionTotal, 2);
            if (bccomp($total, $openingBalance, 2) !== 0) {
                $validator->errors()->add('opening_balance_items', 'Opening balance items must add up to the account opening balance.');
            }
        }];
    }
}
