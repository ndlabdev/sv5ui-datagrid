<script lang="ts" generics="TRow">
    import { untrack } from 'svelte'
    import { type GridState, normalizeSnapshot } from '../../core/grid/index.js'
    import type { GridSnapshot, PersistStateOptions } from '../../core/types/index.js'

    let { grid, options }: { grid: GridState<TRow>; options: PersistStateOptions } = $props()

    const WRITE_INTERVAL_MS = 200

    const key = untrack(() => options.key)

    untrack(() => {
        if (typeof localStorage === 'undefined') return
        try {
            const raw = localStorage.getItem(key)
            if (raw === null) return
            const snapshot = normalizeSnapshot(JSON.parse(raw) as unknown, options.migrate)
            if (snapshot) grid.setState(snapshot)
        } catch {}
    })

    let timer: ReturnType<typeof setTimeout> | null = null
    let pending: GridSnapshot | null = null

    function flush() {
        if (timer !== null) {
            clearTimeout(timer)
            timer = null
        }
        if (pending === null) return
        try {
            localStorage.setItem(key, JSON.stringify(pending))
        } catch {}
        pending = null
    }

    let mounted = false

    $effect(() => {
        const snapshot = grid.getState()
        if (!mounted) {
            mounted = true
            return
        }
        pending = snapshot
        timer ??= setTimeout(flush, WRITE_INTERVAL_MS)
    })

    $effect(() => flush)
</script>
