/**
 * Takes an element's interactive descendants out of the tab order.
 *
 * The grid is one tab stop: cells carry the roving tabindex and everything
 * inside them answers the keyboard through it. Most controls take a `tabindex`
 * prop, but the sv5ui `Checkbox` spreads unknown props onto the wrapper it
 * renders rather than onto the control inside, so the prop never lands — and a
 * thousand-row grid became a thousand tab stops.
 */
const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function notTabbable(node: HTMLElement) {
    for (const element of node.querySelectorAll<HTMLElement>(FOCUSABLE)) {
        if (element.tabIndex !== -1) element.tabIndex = -1
    }
}
