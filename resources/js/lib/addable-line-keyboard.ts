import type { KeyboardEvent, MouseEvent } from 'react';

let addButtonFocusedFromLastRow: HTMLButtonElement | null = null;

const listFor = (
    form: HTMLFormElement,
    name: string,
): HTMLUListElement | null =>
    form.querySelector<HTMLUListElement>(
        `[data-addable-line-list="${CSS.escape(name)}"]`,
    );

const addButtonFor = (
    form: HTMLFormElement,
    name: string,
): HTMLButtonElement | null =>
    form.querySelector<HTMLButtonElement>(
        `[data-addable-line-add="${CSS.escape(name)}"]:not(:disabled)`,
    );

const groupName = (element: Element, attribute: string): string | null =>
    element.getAttribute(attribute);

const isBefore = (first: Element, second: Element): boolean =>
    Boolean(
        first.compareDocumentPosition(second) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    );

export const handleAddableLineKeyDown = (
    event: KeyboardEvent<HTMLFormElement>,
): void => {
    if (event.key !== 'Tab' || !(event.target instanceof HTMLElement)) {
        return;
    }

    const form = event.currentTarget;
    const target = event.target;

    if (target !== addButtonFocusedFromLastRow) {
        addButtonFocusedFromLastRow = null;
    }

    const list = target.closest<HTMLUListElement>('[data-addable-line-list]');
    const line = target.closest('li');

    if (
        !event.shiftKey &&
        list &&
        line === list.lastElementChild &&
        target.matches('input[inputmode="decimal"]')
    ) {
        const name = groupName(list, 'data-addable-line-list');
        const addButton = name ? addButtonFor(form, name) : null;

        if (addButton) {
            event.preventDefault();
            addButtonFocusedFromLastRow = addButton;
            addButton.focus();
        }

        return;
    }

    if (!(target instanceof HTMLButtonElement)) {
        return;
    }

    const name = groupName(target, 'data-addable-line-add');
    const targetList = name ? listFor(form, name) : null;

    if (
        !targetList ||
        !isBefore(target, targetList) ||
        target !== addButtonFocusedFromLastRow
    ) {
        return;
    }

    addButtonFocusedFromLastRow = null;

    const focusableAfterList = [
        ...form.querySelectorAll<HTMLElement>(
            'input, button, select, textarea, [tabindex]',
        ),
    ].find(
        (candidate) =>
            isBefore(targetList, candidate) &&
            candidate.tabIndex >= 0 &&
            !candidate.matches(':disabled') &&
            candidate.getClientRects().length > 0,
    );

    if (focusableAfterList) {
        event.preventDefault();
        focusableAfterList.focus();
    }
};

export const handleAddableLineClick = (
    event: MouseEvent<HTMLFormElement>,
): void => {
    if (!(event.target instanceof Element)) {
        return;
    }

    const button = event.target.closest<HTMLButtonElement>(
        '[data-addable-line-add]',
    );
    const name = button ? groupName(button, 'data-addable-line-add') : null;
    const list = name ? listFor(event.currentTarget, name) : null;

    if (!button || !list) {
        return;
    }

    const previousLastLine = list.lastElementChild;

    window.setTimeout(() => {
        const lastLine = list.lastElementChild;

        if (
            lastLine === previousLastLine ||
            lastLine?.contains(document.activeElement)
        ) {
            return;
        }

        lastLine
            ?.querySelector<HTMLElement>(
                'input:not([type="hidden"]), button[role="combobox"], select',
            )
            ?.focus();
    }, 0);
};
