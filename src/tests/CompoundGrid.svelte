<script lang="ts">
    import { Grid, type GridState } from '$lib/index.js'

    interface Person {
        id: number
        name: string
        age: number
    }

    let { grid }: { grid: GridState<Person> } = $props()
</script>

<Grid.Root {grid}>
    <Grid.Viewport>
        <Grid.Header />
        <Grid.Body />
    </Grid.Viewport>
    <Grid.Pagination />
</Grid.Root>
