import { createInertiaApp, type ResolvedComponent } from '@inertiajs/react';
import createServer from '@inertiajs/react/server';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import ReactDOMServer from 'react-dom/server';

const appName = import.meta.env.VITE_APP_NAME || 'Penny';

createServer((page) =>
    createInertiaApp({
        page,
        render: ReactDOMServer.renderToString,
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
        setup: ({ App, props }) => {
            return <App {...props} />;
        },
    }),
);
