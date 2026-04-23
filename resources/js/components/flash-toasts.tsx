import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { toast } from 'sonner';

const TOAST_ID = 'inertia-flash';

/**
 * Fires toasts for Laravel session flash data shared as Inertia `flash`.
 * Mount in layouts that render inside the Inertia tree; pair with a single shadcn `Toaster` in app.tsx.
 */
export function FlashToasts() {
    const { flash } = usePage<SharedData>().props;

    useEffect(() => {
        const options = {
            id: TOAST_ID,
            position: 'top-center' as const,
        };

        if (flash?.error) {
            toast.error(flash.error, { ...options, duration: 8000 });
            return;
        }
        if (flash?.success) {
            toast.success(flash.success, { ...options, duration: 5000 });
        }
    }, [flash?.error, flash?.success]);

    return null;
}
