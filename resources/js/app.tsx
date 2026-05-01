import '../css/app.css';
import 'sonner/dist/styles.css';

import { Toaster } from '@/components/ui/sonner';
import { createInertiaApp, type ResolvedComponent } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { initializeTheme } from './hooks/use-appearance';

const appName = import.meta.env.VITE_APP_NAME || 'Penny';

createInertiaApp({
    title: (title) => (title ? `${appName} - ${title}` : appName),
    resolve: async (name) => {
        const raw = await resolvePageComponent(
            `./pages/${name}.tsx`,
            import.meta.glob('./pages/**/*.tsx'),
        );
        const mod =
            typeof raw === 'object' &&
            raw !== null &&
            'then' in raw &&
            typeof (raw as { then: unknown }).then === 'function'
                ? await raw
                : raw;
        if (mod && typeof mod === 'object' && 'default' in mod) {
            return (mod as { default: ResolvedComponent }).default;
        }
        return mod as ResolvedComponent;
    },
    setup({ el, App, props }) {
        const root = createRoot(el);

        // One host for all Sonner toasts (same role as `<Toaster />` in a Next.js root layout).
        root.render(
            <>
                <App {...props} />
                <Toaster richColors />
            </>,
        );
    },
    progress: {
        color: '#7a6554',
    },
});

// This will set light / dark mode on load...
initializeTheme();
