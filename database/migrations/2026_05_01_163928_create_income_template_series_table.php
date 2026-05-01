<?php

declare(strict_types=1);

use App\Models\IncomeTemplate;
use App\Models\IncomeTemplateSeries;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('income_template_series', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
        });

        Schema::table('income_templates', function (Blueprint $table): void {
            $table->foreignId('series_id')
                ->nullable()
                ->after('user_id')
                ->constrained('income_template_series')
                ->cascadeOnDelete();
            $table->unsignedInteger('version')->default(1)->after('series_id');
        });

        IncomeTemplate::query()->orderBy('id')->each(function (IncomeTemplate $template): void {
            $series = IncomeTemplateSeries::query()->create([
                'user_id' => $template->user_id,
            ]);
            $template->forceFill([
                'series_id' => $series->id,
                'version' => 1,
            ])->save();
        });

        Schema::table('income_templates', function (Blueprint $table): void {
            $table->unsignedInteger('version')->default(1)->nullable(false)->change();
            $table->foreignId('series_id')->nullable(false)->change();
            $table->unique(['series_id', 'version'], 'inc_tmpl_ser_ver_uq');
        });
    }

    public function down(): void
    {
        Schema::table('income_templates', function (Blueprint $table): void {
            $table->dropUnique('inc_tmpl_ser_ver_uq');
        });

        Schema::table('income_templates', function (Blueprint $table): void {
            $table->dropForeign(['series_id']);
            $table->dropColumn(['series_id', 'version']);
        });

        Schema::dropIfExists('income_template_series');
    }
};
