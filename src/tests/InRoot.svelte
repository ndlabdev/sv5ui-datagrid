<script lang="ts">
    import type { Component } from 'svelte'
    import { Grid } from '$lib/components/parts.js'
    import type { GridState } from '$lib/index.js'

    /**
     * A part, inside a grid. Every chrome and panel component takes its grid
     * from context rather than from a prop, so a test that mounts one alone
     * gets the error that says so; this is the smallest thing that stands in
     * for the application around it.
     */
    let {
        grid,
        component: Part,
        partProps = {}
    }: {
        grid: GridState<never>
        component: Component<Record<string, unknown>>
        partProps?: Record<string, unknown>
    } = $props()
</script>

<Grid.Root {grid}>
    <Part {...partProps} />
</Grid.Root>
