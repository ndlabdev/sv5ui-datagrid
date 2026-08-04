/**
 * bits-ui portals popup content to the body, so a click on an option lands
 * outside the element that opened it. Click-outside handlers skip these.
 */
const PORTAL_SELECTOR = '[data-bits-floating-content-wrapper]'

export function isInPortal(target: EventTarget | null): boolean {
    return Boolean((target as Element | null)?.closest?.(PORTAL_SELECTOR))
}

/**
 * Moves a node to the end of `<body>`. A header cell clips its overflow and
 * fades its controls with `opacity`, which would clip the popup and drag it
 * under the pinned headers. It positions itself in viewport coordinates, so
 * moving it does not move it on screen.
 */
export function portal(node: HTMLElement) {
    document.body.appendChild(node)
    return {
        destroy: () => node.remove()
    }
}
