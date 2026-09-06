<script lang="ts">
    import type { Component } from 'svelte'
    import { Grid } from '$lib/components/parts.js'
    import type { DataGridUi, GridState } from '$lib/index.js'

    /**
     * A part, inside a grid. Every chrome and panel component takes its grid
     * from context rather than from a prop, so a test that mounts one alone
     * gets the error that says so; this is the smallest thing that stands in
     * for the application around it.
     */
    let {
        grid,
        component: Part,
        partProps = {},
        ui
    }: {
        grid: GridState<never>
        /** The per-grid class overrides, which reach a part through the root. */
        ui?: DataGridUi
        /** Omit it to mount nothing but the root, which is what a feature that
         * contributes its own component needs. */
        component?: Component<Record<string, unknown>>
        partProps?: Record<string, unknown>
    } = $props()
</script>

<Grid.Root {grid} {ui}>
    {#if Part}
        <Part {...partProps} />
    {/if}
</Grid.Root>
