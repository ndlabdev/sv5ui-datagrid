/**
 * bits-ui renders popup content - select listboxes, menus, calendars - into a
 * portal on the body rather than inside the element that opened it. A click on
 * an option therefore lands *outside* that element, and a naive click-outside
 * handler would treat picking a value as leaving the surface.
 *
 * Anything under the floating wrapper belongs to a control the surface itself
 * opened, so click-outside handlers skip it.
 */
const PORTAL_SELECTOR = '[data-bits-floating-content-wrapper]'

export function isInPortal(target: EventTarget | null): boolean {
    return Boolean((target as Element | null)?.closest?.(PORTAL_SELECTOR))
}

/**
 * Moves a node to the end of `<body>`.
 *
 * A header cell clips its overflow and the wrapper around its controls fades
 * with `opacity`, which opens a stacking context - a popup left inside would
 * be clipped, painted under the pinned header cells, and would inherit the
 * wrapper's transparency. The popup positions itself in viewport coordinates,
 * so moving it does not move it on screen.
 */
export function portal(node: HTMLElement) {
    document.body.appendChild(node)
    return {
        destroy: () => node.remove()
    }
}
