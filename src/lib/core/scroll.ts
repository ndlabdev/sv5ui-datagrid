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
    const rtl = getComputedStyle(element).direction === 'rtl'
    element.scrollLeft = rtl ? -value : value
}
