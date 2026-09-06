<script lang="ts">
    import type { Component } from 'svelte'
    import { Grid } from '$lib/components/parts.js'
    import type { DataGridUi, GridState } from '$lib/index.js'

    let {
        grid,
        component: Part,
        partProps = {},
        ui
    }: {
        grid: GridState<never>
        ui?: DataGridUi
        component?: Component<Record<string, unknown>>
        partProps?: Record<string, unknown>
    } = $props()
</script>

<Grid.Root {grid} {ui}>
    {#if Part}
        <Part {...partProps} />
    {/if}
</Grid.Root>
