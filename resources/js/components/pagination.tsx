import { Button } from '@/components/ui/button';
import { Link } from '@inertiajs/react';

type LinkItem = { url: string | null; label: string; active: boolean };

function isPageNumber(label: string): boolean {
    return /^\d+$/.test(label.trim());
}

export function Pagination({ links }: { links: LinkItem[] }) {
    return (
        <div className="flex flex-wrap items-center justify-center gap-1">
            {links.map((link, i) => {
                const numeric = isPageNumber(link.label);

                if (link.url === null) {
                    return (
                        <span
                            key={i}
                            className="flex h-9 items-center justify-center px-2 text-sm text-muted-foreground"
                        >
                            <span
                                dangerouslySetInnerHTML={{ __html: link.label }}
                            />
                        </span>
                    );
                }

                return (
                    <Button
                        key={i}
                        asChild
                        size={numeric ? 'icon' : 'sm'}
                        variant={link.active ? 'default' : 'outline'}
                    >
                        <Link href={link.url} preserveState>
                            <span
                                dangerouslySetInnerHTML={{ __html: link.label }}
                            />
                        </Link>
                    </Button>
                );
            })}
        </div>
    );
}
