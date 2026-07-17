<script lang="ts">
    import { Grid, type GridState } from '$lib/index.js'

    interface Row {
        id: number
        name: string
        value: number
    }

    let { grid, viewportClass = 'h-100' }: { grid: GridState<Row>; viewportClass?: string } =
        $props()
</script>

<Grid.Root {grid}>
    <Grid.Viewport class={viewportClass}>
        <Grid.Header />
        <Grid.Body />
    </Grid.Viewport>
</Grid.Root>
