/**
 * bits-ui renders popup content into a portal on the body rather than inside
 * the control that opened it, so a click on an option lands outside that
 * control and a keypress in it never reaches the grid.
 */
const PORTAL_SELECTOR = '[data-bits-floating-content-wrapper]'

export function isInPortal(target: EventTarget | null): boolean {
    return Boolean((target as Element | null)?.closest?.(PORTAL_SELECTOR))
}

/** True while any such popup is on screen. */
export function popupOpen(): boolean {
    return typeof document !== 'undefined' && document.querySelector(PORTAL_SELECTOR) !== null
}
