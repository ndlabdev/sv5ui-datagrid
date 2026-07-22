/**
 * Horizontal scrolling is measured as distance from the inline start, which is
 * always positive. The DOM does not agree: under `dir="rtl"` browsers report
 * `scrollLeft` as zero at the right edge and negative as you scroll away from
 * it. Everything inside the grid works in the positive space and converts at
 * the DOM boundary through these two helpers.
 */
export function scrollStart(element: HTMLElement): number {
    return Math.abs(element.scrollLeft)
}

export function setScrollStart(element: HTMLElement, value: number): void {
    element.scrollLeft = isRtl(element) ? -value : value
}

export function isRtl(element: HTMLElement): boolean {
    return getComputedStyle(element).direction === 'rtl'
}

/**
 * Turns a pointer's horizontal travel into travel along the inline axis, so a
 * drag toward the inline end always reads as positive.
 */
export function inlineDelta(rtl: boolean, from: number, to: number): number {
    return rtl ? from - to : to - from
}

/** A client x as an offset from the element's inline start. */
export function inlineOffset(rtl: boolean, rect: DOMRect, clientX: number): number {
    return rtl ? rect.right - clientX : clientX - rect.left
}
