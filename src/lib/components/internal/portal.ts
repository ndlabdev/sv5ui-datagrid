export { isInPortal } from '../../core/utils/popup.js'

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
