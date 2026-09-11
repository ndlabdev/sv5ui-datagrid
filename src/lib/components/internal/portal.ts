export { isInPortal } from '../../core/utils/index.js'

export function portal(node: HTMLElement) {
    document.body.appendChild(node)
    return {
        destroy: () => node.remove()
    }
}
