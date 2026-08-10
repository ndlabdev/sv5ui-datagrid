<script lang="ts">
    import { onMount, tick, untrack } from 'svelte'
    import { Button, Container, Link, ThemeModeButton } from 'sv5ui'
    import {
        createDataGrid,
        getVirtualization,
        Grid,
        virtualization,
        type ColumnDef
    } from '$lib/index.js'

    interface Event {
        id: number
        actor: string
        action: string
        at: string
    }

    const actions = ['created', 'updated', 'archived', 'restored', 'exported']
    const TOTAL = 1_000_000
    const CHUNK = 200
    /** How close to the end of what is loaded the window may come. */
    const THRESHOLD = 60

    function rowAt(index: number): Event {
        return {
            id: index + 1,
            actor: `user-${(index * 7919) % 5000}`,
            action: actions[index % 5],
            at: new Date(1_700_000_000_000 + index * 60_000).toISOString().slice(0, 19)
        }
    }

    /** One chunk of the log, oldest first, the way a cursor API hands it over. */
    function fetchChunk(from: number): Event[] {
        const rows: Event[] = []
        for (let index = from; index < Math.min(from + CHUNK, TOTAL); index++) {
            rows.push(rowAt(index))
        }
        return rows
    }

    const columns: ColumnDef<Event>[] = [
        { id: 'id', header: '#', align: 'right', width: 110 },
        { id: 'actor', header: 'Actor', width: 160 },
        { id: 'action', header: 'Action', flex: 1, minWidth: 140 },
        { id: 'at', header: 'At', width: 200 }
    ]

    const grid = createDataGrid<Event>({
        data: [],
        columns,
        getRowId: (event) => String(event.id),
        rowModel: 'server',
        features: [virtualization({ rowHeight: 36, overscan: 8 })]
    })

    const virtual = getVirtualization(grid)!

    let chunks = $state(0)
    let loading = $state(false)
    let domRows = $state(0)
    let worstFrame = $state(0)
    let frames = $state(0)

    function loadMore(): void {
        if (loading || grid.data.length >= TOTAL) return
        loading = true
        chunks += 1
        grid.data = [...grid.data, ...fetchChunk(grid.data.length)]
        loading = false
    }

    /**
     * Reads the window the virtualizer asks for and appends when it comes
     * within `THRESHOLD` of the end. The write feeds the read — the row count
     * is what the window is measured against — so the append is untracked and
     * the guard has to settle, which it does as soon as the window fits.
     */
    $effect(() => {
        const end = virtual.virtualizer.range.end
        untrack(() => {
            if (end + THRESHOLD >= grid.data.length) loadMore()
        })
    })

    /** Frame times across a scripted scroll: what a fling actually costs. */
    async function measureScroll(): Promise<void> {
        const element = virtual.element
        if (!element) return
        worstFrame = 0
        frames = 0

        let last = performance.now()
        let running = true
        const tick = () => {
            const now = performance.now()
            const elapsed = now - last
            last = now
            frames += 1
            worstFrame = Math.max(worstFrame, elapsed)
            if (running) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)

        for (let step = 0; step < 60; step++) {
            element.scrollTop += 600
            await new Promise((resolve) => requestAnimationFrame(resolve))
        }
        running = false
        domRows = document.querySelectorAll('[role="row"][data-dg-row-id]').length
    }

    async function reset(): Promise<void> {
        virtual.element?.scrollTo({ top: 0 })
        grid.data = []
        chunks = 0
        worstFrame = 0
        frames = 0
        await tick()
        loadMore()
    }

    // No initial fetch here: the effect above already sees an empty grid as a
    // window standing at the end of what is loaded, and asks for the chunk.
    onMount(() => {
        void tick().then(() => {
            domRows = document.querySelectorAll('[role="row"][data-dg-row-id]').length
        })
    })
</script>

<Container class="space-y-6 py-10">
    <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">
                Server row model — infinite scroll
            </h1>
            <p class="text-sm text-on-surface-variant">
                Một triệu dòng log phía "server", lấy về từng khối {CHUNK} dòng khi cửa sổ của virtualizer
                chạm gần cuối phần đã tải. Không phân trang: đây là hình thái còn lại của server row model.
            </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
            <Link href="/server">← Server demo</Link>
            <ThemeModeButton />
        </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" label="Scroll 60 frames" onclick={measureScroll} />
        <Button variant="ghost" size="sm" label="Reset" onclick={reset} />
        <span data-testid="infinite-state" class="text-xs text-on-surface-variant">
            {chunks} chunks · {grid.data.length.toLocaleString()} of {TOTAL.toLocaleString()} rows held
            · {domRows} rows in the DOM · worst frame {worstFrame.toFixed(1)}ms over {frames}
        </span>
    </div>

    <Grid.Root {grid}>
        <Grid.Viewport class="h-140">
            <Grid.Header />
            <Grid.Body />
        </Grid.Viewport>
    </Grid.Root>

    <p class="text-xs text-on-surface-variant">
        Số dòng trong DOM đứng yên dù cuộn bao xa — virtualizer chỉ dựng phần nhìn thấy. Số dòng
        <em>held</em> thì tăng theo từng khối: đó là bộ nhớ app chấp nhận đánh đổi để cuộn liên tục,
        và là khác biệt duy nhất so với <Link href="/server/big">phân trang</Link>, nơi grid vứt
        trang cũ đi.
    </p>
</Container>
