export function rafBatch(apply: (value: number) => void): (value: number) => void {
    let pending: number | null = null

    return (value: number) => {
        if (typeof requestAnimationFrame !== 'function') {
            apply(value)
            return
        }

        const hadPending = pending !== null
        pending = value
        if (hadPending) return

        requestAnimationFrame(() => {
            if (pending === null) return
            apply(pending)
            pending = null
        })
    }
}
