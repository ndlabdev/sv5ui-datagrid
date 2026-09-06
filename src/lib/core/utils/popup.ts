const PORTAL_SELECTOR = '[data-bits-floating-content-wrapper]'

export function isInPortal(target: EventTarget | null): boolean {
    return Boolean((target as Element | null)?.closest?.(PORTAL_SELECTOR))
}

/** True while any such popup is on screen. */
export function popupOpen(): boolean {
    return typeof document !== 'undefined' && document.querySelector(PORTAL_SELECTOR) !== null
}
