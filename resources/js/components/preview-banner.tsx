import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';

export function PreviewBanner() {
    const { preview } = usePage<SharedData>().props;

    if (!preview?.enabled) {
        return null;
    }

    return (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
            Preview mode. Changes are saved temporarily and will be cleared
            automatically.
        </div>
    );
}
