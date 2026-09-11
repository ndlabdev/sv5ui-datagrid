export function scrollStart(element: HTMLElement): number {
    return Math.abs(element.scrollLeft)
}

export function setScrollStart(element: HTMLElement, value: number): void {
    element.scrollLeft = isRtl(element) ? -value : value
}

export function isRtl(element: HTMLElement): boolean {
    return getComputedStyle(element).direction === 'rtl'
}

export function inlineDelta(rtl: boolean, from: number, to: number): number {
    return rtl ? from - to : to - from
}

export function inlineOffset(rtl: boolean, rect: DOMRect, clientX: number): number {
    return rtl ? rect.right - clientX : clientX - rect.left
}
