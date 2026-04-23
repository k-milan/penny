import { cn } from '@/lib/utils';
import {
    CircleCheck,
    Info,
    Loader2,
    OctagonX,
    TriangleAlert,
} from 'lucide-react';
import * as React from 'react';
import { useSyncExternalStore } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

function useHtmlDarkClass(): boolean {
    return useSyncExternalStore(
        (onChange) => {
            const el = document.documentElement;
            const observer = new MutationObserver(onChange);
            observer.observe(el, {
                attributeFilter: ['class'],
                attributes: true,
            });
            return () => {
                observer.disconnect();
            };
        },
        () => document.documentElement.classList.contains('dark'),
        () => false,
    );
}

const Toaster = ({ className, theme, ...props }: ToasterProps) => {
    const isDark = useHtmlDarkClass();
    const resolvedTheme =
        theme === undefined || theme === 'system'
            ? (isDark ? 'dark' : 'light')
            : theme;

    return (
        <Sonner
            className={cn('toaster group', className)}
            theme={resolvedTheme}
            icons={{
                success: <CircleCheck className="size-4" />,
                info: <Info className="size-4" />,
                warning: <TriangleAlert className="size-4" />,
                error: <OctagonX className="size-4" />,
                loading: <Loader2 className="size-4 animate-spin" />,
            }}
            style={
                {
                    '--border-radius': 'var(--radius)',
                    '--normal-bg': 'var(--popover)',
                    '--normal-text': 'var(--popover-foreground)',
                    '--normal-border': 'var(--border)',
                } as React.CSSProperties
            }
            toastOptions={{
                classNames: {
                    toast: cn(
                        'group toast group-[.toaster]:border-border',
                        'group-[.toaster]:bg-background group-[.toaster]:text-foreground',
                        'group-[.toaster]:shadow-lg',
                    ),
                    title: 'group-[.toast]:text-foreground',
                    description: 'group-[.toast]:text-muted-foreground',
                    actionButton:
                        'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
                    cancelButton:
                        'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
                },
            }}
            {...props}
        />
    );
};

export { Toaster };
export type { ToasterProps } from 'sonner';
