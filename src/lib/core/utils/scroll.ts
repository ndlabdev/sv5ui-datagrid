/**
 * The grid measures horizontal scroll from the inline start, always positive.
 * Under `dir="rtl"` the DOM reports `scrollLeft` as zero at the right edge and
 * negative away from it, so these two convert at the boundary.
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

/** Pointer travel along the inline axis, positive toward the inline end. */
export function inlineDelta(rtl: boolean, from: number, to: number): number {
    return rtl ? from - to : to - from
}

/** A client x as an offset from the element's inline start. */
export function inlineOffset(rtl: boolean, rect: DOMRect, clientX: number): number {
    return rtl ? rect.right - clientX : clientX - rect.left
}
