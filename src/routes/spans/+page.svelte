<script lang="ts">
    import { Card, Container, Link, ThemeModeButton } from 'sv5ui'
    import {
        columnOps,
        createDataGrid,
        DataGrid,
        selection,
        sorting,
        virtualization,
        type ColumnDef,
        type GridState
    } from '$lib/index.js'

    interface Entry {
        id: number
        region: string
        country: string
        city: string
        quarter: string
        revenue: number
    }

    const regions = [
        { region: 'APAC', countries: ['Vietnam', 'Japan', 'Singapore'] },
        { region: 'EMEA', countries: ['Germany', 'France'] },
        { region: 'Americas', countries: ['Brazil', 'Canada', 'Mexico', 'USA'] }
    ]
    const cities: Record<string, string[]> = {
        Vietnam: ['Hanoi', 'Da Nang', 'Ho Chi Minh'],
        Japan: ['Tokyo', 'Osaka'],
        Singapore: ['Singapore'],
        Germany: ['Berlin', 'Munich', 'Hamburg'],
        France: ['Paris', 'Lyon'],
        Brazil: ['Sao Paulo', 'Rio'],
        Canada: ['Toronto'],
        Mexico: ['Mexico City', 'Monterrey'],
        USA: ['New York', 'Austin', 'Seattle']
    }

    // Rows arrive grouped, the way a report does: region, then country, then a
    // row per city. That ordering is what makes the spans meaningful.
    const entries: Entry[] = []
    let id = 0
    for (let cycle = 0; cycle < 40; cycle++) {
        for (const { region, countries } of regions) {
            for (const country of countries) {
                for (const city of cities[country]) {
                    id += 1
                    entries.push({
                        id,
                        region,
                        country,
                        city,
                        quarter: `Q${(id % 4) + 1}`,
                        revenue: 12_000 + ((id * 371) % 90_000)
                    })
                }
            }
        }
    }

    /** How many rows from `index` share the same value of `key`. */
    function runLength(index: number, key: 'region' | 'country'): number {
        // A run only starts where the value changes; inside one, the cell is
        // covered and its span is never asked for.
        if (index > 0 && entries[index - 1][key] === entries[index][key]) return 1
        let n = 1
        while (index + n < entries.length && entries[index + n][key] === entries[index][key]) n++
        return n
    }

    const columns: ColumnDef<Entry>[] = [
        {
            id: 'region',
            header: 'Region',
            width: 130,
            pinned: 'left',
            rowSpan: (ctx) => runLength(ctx.rowIndex, 'region')
        },
        {
            id: 'country',
            header: 'Country',
            width: 150,
            rowSpan: (ctx) => runLength(ctx.rowIndex, 'country')
        },
        { id: 'city', header: 'City', flex: 1, minWidth: 160 },
        { id: 'quarter', header: 'Quarter', width: 110, align: 'center' },
        {
            id: 'revenue',
            header: 'Revenue',
            width: 150,
            align: 'right',
            sortable: true,
            type: 'currency',
            typeOptions: { currency: 'USD' }
        }
    ]

    const grid: GridState<Entry> = createDataGrid<Entry>({
        data: entries,
        columns,
        getRowId: (entry) => String(entry.id),
        features: [sorting(), columnOps(), selection(), virtualization({ rowHeight: 40 })]
    })
</script>

<Container class="space-y-6 py-10">
    <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">Spanning — rowSpan & colSpan</h1>
            <p class="max-w-3xl text-sm text-on-surface-variant">
                <code>rowSpan(ctx)</code> trả về số dòng ô này phủ; các ô bị phủ không render. Span tính
                trên toàn bộ danh sách nên vẫn đúng khi cuộn — cuộn vào giữa một span, ô chủ nằm trên
                vùng hiển thị vẫn được vẽ đúng chỗ. Cột Region còn được ghim trái để kiểm tra span không
                đè lên cột ghim.
            </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
            <Link href="/">← Home</Link>
            <ThemeModeButton />
        </div>
    </div>

    <DataGrid {grid} class="h-130" />

    <Card class="space-y-2 p-4">
        <h2 class="font-medium text-on-surface">Cần soi</h2>
        <ul class="list-inside list-disc space-y-1 text-sm text-on-surface-variant">
            <li>Ô Region/Country cao bằng đúng số dòng nó phủ, không hở và không lệch.</li>
            <li>Đường kẻ ngang giữa các dòng bị span che, không xuyên qua ô.</li>
            <li>Cuộn dọc vào giữa một span — ô vẫn liền mạch, không nhảy.</li>
            <li>Cuộn ngang — cột Region ghim trái vẫn nằm trên các ô span khác.</li>
            <li>Sắp xếp theo Revenue làm span vỡ thành từng dòng, đúng như dữ liệu.</li>
            <li>Bàn phím: mũi tên xuống đi qua vùng bị phủ vẫn dừng ở ô chủ.</li>
        </ul>
    </Card>
</Container>
