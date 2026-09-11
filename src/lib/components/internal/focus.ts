const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function notTabbable(node: HTMLElement, enabled: boolean = true) {
    if (!enabled) return
    for (const element of node.querySelectorAll<HTMLElement>(FOCUSABLE)) {
        if (element.tabIndex !== -1) element.tabIndex = -1
    }
}
