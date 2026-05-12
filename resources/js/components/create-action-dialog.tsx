import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';

export type CreateActionItem = {
    id: string;
    title: string;
    description?: string;
    icon: LucideIcon;
    disabled?: boolean;
    href?: string;
    onSelect?: () => void;
};

export function CreateActionDialog({
    open,
    onOpenChange,
    title = 'What do you want to create?',
    description = 'Choose the workflow that matches what you want to record.',
    items,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title?: string;
    description?: string;
    items: CreateActionItem[];
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader className="text-left">
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-2 md:grid-cols-2">
                    {items.map((item) => {
                        const Icon = item.icon;
                        const content = (
                            <>
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
                                    <Icon className="size-5" aria-hidden />
                                </span>
                                <span className="min-w-0 flex-1 overflow-hidden text-left">
                                    <span className="block leading-tight font-medium break-words whitespace-normal">
                                        {item.title}
                                    </span>
                                    {item.description ? (
                                        <span className="mt-0.5 block text-xs leading-snug break-words whitespace-normal text-muted-foreground">
                                            {item.description}
                                        </span>
                                    ) : null}
                                </span>
                            </>
                        );
                        const className = cn(
                            'h-auto min-w-0 items-start justify-start gap-3 overflow-hidden rounded-lg border border-border bg-card px-3 py-3 text-left whitespace-normal shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.04]',
                            item.disabled &&
                                'cursor-not-allowed opacity-50 hover:border-border hover:bg-card',
                        );

                        if (item.href && !item.disabled) {
                            return (
                                <Button
                                    key={item.id}
                                    variant="ghost"
                                    className={className}
                                    asChild
                                    onClick={() => onOpenChange(false)}
                                >
                                    <Link href={item.href}>{content}</Link>
                                </Button>
                            );
                        }

                        return (
                            <Button
                                key={item.id}
                                type="button"
                                variant="ghost"
                                className={className}
                                disabled={item.disabled}
                                onClick={() => {
                                    item.onSelect?.();
                                    onOpenChange(false);
                                }}
                            >
                                {content}
                            </Button>
                        );
                    })}
                </div>
            </DialogContent>
        </Dialog>
    );
}
