<script lang="ts">
    import { Grid, type GridState } from '$lib/index.js'

    interface Row {
        id: number
        name: string
        value: number
    }

    let { grid }: { grid: GridState<Row> } = $props()
</script>

<Grid.Root {grid}>
    <Grid.Viewport class="h-[400px]">
        <Grid.Header />
        <Grid.Body />
    </Grid.Viewport>
</Grid.Root>
