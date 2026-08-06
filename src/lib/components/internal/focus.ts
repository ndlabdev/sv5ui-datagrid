/**
 * Takes an element's interactive descendants out of the tab order. The grid is
 * one tab stop; sv5ui's `Checkbox` drops a `tabindex` prop on its wrapper, so
 * a thousand-row grid became a thousand tab stops.
 */
const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function notTabbable(node: HTMLElement) {
    for (const element of node.querySelectorAll<HTMLElement>(FOCUSABLE)) {
        if (element.tabIndex !== -1) element.tabIndex = -1
    }
}
