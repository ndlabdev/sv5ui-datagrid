export function rafBatch(apply: (value: number) => void): (value: number) => void {
    let pending: number | null = null

    return (value: number) => {
        if (typeof requestAnimationFrame !== 'function') {
            apply(value)
            return
        }

        const scheduled = pending !== null
        pending = value
        if (scheduled) return

        requestAnimationFrame(() => {
            const next = pending
            pending = null
            if (next !== null) apply(next)
        })
    }
}
