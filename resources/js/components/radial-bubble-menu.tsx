import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { type LucideIcon, Plus, X } from 'lucide-react';
import {
    useCallback,
    useEffect,
    useId,
    useRef,
    type CSSProperties,
} from 'react';

const RADIUS_PX = 124;

/** Where the + sits: fans away from the nearest viewport edge so bubbles stay on screen. LTR. */
export type RadialBubblePlacement =
    | 'top-end'
    | 'top-start'
    | 'bottom-end'
    | 'bottom-start';

function positionOnArc(
    index: number,
    total: number,
    arc: { startDeg: number; endDeg: number },
): { x: number; y: number } {
    if (total <= 0) {
        return { x: 0, y: 0 };
    }
    const { startDeg, endDeg } = arc;
    const t = total === 1 ? 0.5 : index / (total - 1);
    const deg = startDeg + t * (endDeg - startDeg);
    const rad = (deg * Math.PI) / 180;
    return {
        x: RADIUS_PX * Math.sin(rad),
        y: -RADIUS_PX * Math.cos(rad),
    };
}

function placementToFlips(placement: RadialBubblePlacement): {
    flipX: boolean;
    flipY: boolean;
} {
    switch (placement) {
        case 'top-end':
            return { flipX: true, flipY: false };
        case 'top-start':
            return { flipX: false, flipY: false };
        case 'bottom-end':
            return { flipX: true, flipY: true };
        case 'bottom-start':
            return { flipX: false, flipY: true };
    }
}

const ARC_TOP = { startDeg: 8, endDeg: 132 };
const ARC_BOTTOM = { startDeg: 8, endDeg: 132 };

function positionForIndex(
    index: number,
    total: number,
    placement: RadialBubblePlacement,
): { x: number; y: number } {
    const arc =
        placement === 'bottom-end' || placement === 'bottom-start'
            ? ARC_BOTTOM
            : ARC_TOP;
    const p = positionOnArc(index, total, arc);
    const { flipX, flipY } = placementToFlips(placement);
    return {
        x: flipX ? -p.x : p.x,
        y: flipY ? -p.y : p.y,
    };
}

function captionForItem(item: RadialBubbleItem): string {
    if (item.caption != null && item.caption !== '') {
        return item.caption;
    }
    return item.label.replace(/^New\s+/i, '').trim() || item.label;
}

export type RadialBubbleItem = {
    id: string;
    label: string;
    /** Shorter text to the left of the icon (e.g. “Transaction”). Falls back to trimming “New …” from `label`. */
    caption?: string;
    icon: LucideIcon;
    onSelect?: () => void;
    disabled?: boolean;
    href?: string;
};

const bubbleCircleClass =
    'inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border bg-background text-sm font-medium shadow-md';

const bubbleControlBase =
    'text-foreground border-border focus-visible:ring-ring relative flex items-center justify-center overflow-visible rounded-lg p-0.5 text-left transition-transform duration-200 ease-out will-change-transform focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none';

const captionLeftClass =
    'text-foreground/90 absolute right-full top-1/2 z-0 mr-1.5 max-w-[5.5rem] -translate-y-1/2 text-right text-[0.7rem] font-medium leading-tight sm:max-w-[6.5rem]';

type RadialBubbleMenuProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    items: RadialBubbleItem[];
    placement?: RadialBubblePlacement;
    triggerLabel?: string;
    className?: string;
};

/**
 * A + control that fans action buttons in an arc (bubble / speed-dial style).
 */
export function RadialBubbleMenu({
    open,
    onOpenChange,
    items,
    placement = 'top-end',
    triggerLabel = 'Add',
    className,
}: RadialBubbleMenuProps) {
    const listId = useId();
    const close = useCallback(() => onOpenChange(false), [onOpenChange]);
    /** Trigger + item bubbles (not the full-screen dim layer), so we can “click outside” even when the dim layer is painted under later page siblings. */
    const menuSurfaceRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) {
            return;
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                close();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, close]);

    useEffect(() => {
        if (!open) {
            return;
        }
        const onPointerDown = (e: PointerEvent) => {
            const surface = menuSurfaceRef.current;
            if (surface == null) {
                return;
            }
            if (e.target instanceof Node && surface.contains(e.target)) {
                return;
            }
            close();
        };
        document.addEventListener('pointerdown', onPointerDown, true);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown, true);
        };
    }, [open, close]);

    const total = items.length;

    return (
        <div
            className={cn(
                'relative z-50 flex items-center justify-center',
                className,
            )}
        >
            {open ? (
                <div
                    role="presentation"
                    className="fixed inset-0 z-40 cursor-default bg-black/20 backdrop-blur-[0.5px] transition-opacity duration-200"
                    onClick={close}
                    aria-hidden
                />
            ) : null}

            <div
                ref={menuSurfaceRef}
                className="relative z-50 flex h-10 w-10 items-center justify-center"
            >
                {open
                    ? items.map((item, index) => {
                          const { x, y } = positionForIndex(
                              index,
                              total,
                              placement,
                          );
                          const Icon = item.icon;
                          const groupStyle: CSSProperties = {
                              transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                          };
                          const caption = captionForItem(item);
                          const popDelay = `${index * 48}ms`;
                          const popClass =
                              'origin-center [animation:radial-bubble-pop_0.48s_cubic-bezier(0.22,1.2,0.36,1)_both] motion-reduce:animate-none motion-reduce:scale-100 motion-reduce:opacity-100';

                          return (
                              <div
                                  key={item.id}
                                  className="pointer-events-none absolute left-1/2 top-1/2"
                                  style={groupStyle}
                              >
                                  <div
                                      className={cn(
                                          popClass,
                                          'pointer-events-auto',
                                      )}
                                      style={{ animationDelay: popDelay }}
                                  >
                                      {item.href && !item.disabled ? (
                                          <Link
                                              href={item.href}
                                              className={cn(
                                                  bubbleControlBase,
                                                  'ring-offset-background hover:scale-110',
                                              )}
                                              title={item.label}
                                              aria-label={item.label}
                                              onClick={close}
                                          >
                                              <span
                                                  className={captionLeftClass}
                                              >
                                                  {caption}
                                              </span>
                                              <span
                                                  className={bubbleCircleClass}
                                              >
                                                  <Icon
                                                      className="size-4"
                                                      aria-hidden
                                                  />
                                              </span>
                                          </Link>
                                      ) : (
                                          <Button
                                              type="button"
                                              variant="secondary"
                                              className={cn(
                                                  bubbleControlBase,
                                                  'h-auto min-h-0 w-auto min-w-0 border-0 bg-transparent p-0.5 shadow-none enabled:hover:scale-110 enabled:hover:bg-transparent disabled:bg-transparent',
                                              )}
                                              title={item.label}
                                              aria-label={item.label}
                                              disabled={item.disabled}
                                              onClick={() => {
                                                  if (!item.disabled) {
                                                      item.onSelect?.();
                                                      close();
                                                  }
                                              }}
                                          >
                                              <span className={captionLeftClass}>
                                                  {caption}
                                              </span>
                                              <span className={bubbleCircleClass}>
                                                  <Icon
                                                      className="size-4"
                                                      aria-hidden
                                                  />
                                              </span>
                                          </Button>
                                      )}
                                  </div>
                              </div>
                          );
                      })
                    : null}

                <Button
                    type="button"
                    size="icon"
                    variant={open ? 'secondary' : 'default'}
                    className="relative z-10 rounded-full shadow-sm transition-transform duration-200 hover:scale-105"
                    aria-label={open ? 'Close' : triggerLabel}
                    aria-expanded={open}
                    aria-haspopup="true"
                    aria-controls={open ? listId : undefined}
                    onClick={() => onOpenChange(!open)}
                >
                    {open ? (
                        <X className="size-4" />
                    ) : (
                        <Plus className="size-4" />
                    )}
                </Button>
            </div>

            {open ? (
                <ul
                    id={listId}
                    className="sr-only"
                    role="menu"
                    aria-label="Quick add"
                >
                    {items.map((item) => (
                        <li key={item.id} role="menuitem">
                            {item.label}
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}
