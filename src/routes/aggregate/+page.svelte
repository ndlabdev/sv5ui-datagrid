<script lang="ts">
    import {
        Grid,
        columnOps,
        createDataGrid,
        filtering,
        sorting,
        virtualization,
        type ColumnDef,
        type DataGridCellContext
    } from '$lib/index.js'
    import { Badge, Button, Container, Link, ThemeModeButton } from 'sv5ui'
    import { aggregate, DataGrid, getGrouping, grouping } from '$lib/index.js'

    interface Employee {
        id: number
        name: string
        dept: string
        country: string
        level: string
        salary: number
        bonus: number
        rating: number
        tenure: number
    }

    const firstNames = ['Alice', 'Bao', 'Chi', 'Diana', 'Ethan', 'Fiona', 'Giang', 'Hana']
    const lastNames = ['Nguyen', 'Tran', 'Le', 'Pham', 'Vo', 'Dang', 'Ho', 'Bui']
    const depts = ['Core', 'Platform', 'Growth', 'Data', 'Infra']
    const levels = ['Junior', 'Mid', 'Senior', 'Staff']

    const deptCountries: Record<string, string[]> = {
        Core: ['VN', 'US', 'DE', 'JP', 'SG'],
        Platform: ['VN', 'US', 'DE'],
        Growth: ['VN', 'SG'],
        Data: ['US', 'DE', 'JP', 'SG'],
        Infra: ['VN']
    }

    function deptOf(i: number): string {
        if (i % 17 === 0) return 'Infra'
        if (i % 5 === 0) return 'Data'
        if (i % 3 === 0) return 'Growth'
        if (i % 2 === 0) return 'Platform'
        return 'Core'
    }

    const employees: Employee[] = Array.from({ length: 320 }, (_, i) => {
        const dept = deptOf(i)
        const rank = depts.indexOf(dept)
        const homes = deptCountries[dept]!

        return {
            id: i + 1,
            name: `${firstNames[i % 8]} ${lastNames[Math.floor(i / 8) % 8]}`,
            dept,
            country: homes[i % homes.length]!,
            level: levels[(i + rank) % 4]!,
            salary: 52_000 + rank * 9_000 + (i % 13) * 1_450 + (i % 5) * 700,
            bonus: 900 + rank * 1_400 + (i % 19) * 310,
            rating: 2.6 + ((i * 3 + rank) % 22) / 10,
            tenure: 1 + ((i + rank * 3) % 12)
        }
    })

    const money = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    })

    const oneDecimal = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    })

    const columns: ColumnDef<Employee>[] = [
        { id: 'dept', header: 'Dept', sortable: true, flex: 1, minWidth: 200, cell: labelCell },
        { id: 'headcount', header: 'Headcount', align: 'right', width: 120 },
        { id: 'name', header: 'Name (first)', flex: 1, minWidth: 170 },
        { id: 'level', header: 'Level (last)', width: 140 },
        { id: 'country', header: 'Countries (distinct)', align: 'right', width: 180 },
        { id: 'salary', header: 'Salary (median)', align: 'right', width: 170, cell: moneyCell },
        { id: 'bonus', header: 'Bonus (p90)', align: 'right', width: 150, cell: moneyCell },
        {
            id: 'rating',
            header: 'Rating (weighted by tenure)',
            align: 'right',
            width: 230,
            cell: ratingCell
        },
        { id: 'tenure', header: 'Tenure (max)', align: 'right', width: 150 }
    ]

    const grid = createDataGrid<Employee>({
        data: employees,
        columns,
        getRowId: (employee) => String(employee.id),
        features: [
            filtering(),
            sorting(),
            columnOps(),
            grouping<Employee>({
                by: ['dept'],
                expandedByDefault: false,
                groupFooters: true,
                grandTotal: true,
                aggregations: {
                    headcount: 'count',
                    name: 'first',
                    level: 'last',
                    country: 'distinctCount',
                    salary: 'median',
                    bonus: { kind: 'percentile', p: 0.9 },
                    rating: { kind: 'weightedAvg', weight: (row) => row.tenure },
                    tenure: 'max'
                }
            }),
            virtualization({ rowHeight: 40, overscan: 8 })
        ]
    })

    const groupingState = getGrouping(grid)!

    const ALL = 'Total'
    let scope = $state(ALL)

    const scopeRows = $derived(
        scope === ALL ? employees : employees.filter((employee) => employee.dept === scope)
    )

    function sortedList(values: number[], format: (value: number) => string): string {
        const sorted = [...values].sort((left, right) => left - right)
        if (sorted.length <= 6) return sorted.map(format).join(' | ')
        return [
            ...sorted.slice(0, 3).map(format),
            `... (${sorted.length - 6} nữa)`,
            ...sorted.slice(-3).map(format)
        ].join(' | ')
    }

    function medianMath(values: number[], format: (value: number) => string): string {
        const sorted = [...values].sort((left, right) => left - right)
        const n = sorted.length
        if (n % 2 === 1) return `n = ${n} lẻ → lấy thẳng giá trị thứ ${(n + 1) / 2}`
        const low = format(sorted[n / 2 - 1]!)
        const high = format(sorted[n / 2]!)
        return `n = ${n} chẵn → trung bình hai giá trị giữa: (${low} + ${high}) / 2`
    }

    function percentileMath(
        values: number[],
        p: number,
        format: (value: number) => string
    ): string {
        const sorted = [...values].sort((left, right) => left - right)
        const position = (sorted.length - 1) * p
        const lower = Math.floor(position)
        const upper = Math.ceil(position)
        if (lower === upper) return `vị trí ${position} rơi đúng vào giá trị thứ ${lower + 1}`
        const fraction = (position - lower).toFixed(2)
        return `vị trí ${p} x (${sorted.length} - 1) = ${position.toFixed(2)} → nội suy ${fraction} đoạn giữa giá trị thứ ${lower + 1} (${format(sorted[lower]!)}) và thứ ${upper + 1} (${format(sorted[upper]!)})`
    }

    const rows = $derived.by(() => {
        const list = scopeRows
        const salaries = list.map((employee) => employee.salary)
        const bonuses = list.map((employee) => employee.bonus)
        const ratings = list.map((employee) => employee.rating)
        const tenures = list.map((employee) => employee.tenure)
        const countries = list.map((employee) => employee.country)
        const weighted = list.reduce((total, row) => total + row.rating * row.tenure, 0)
        const weights = list.reduce((total, row) => total + row.tenure, 0)
        const asMoney = (value: number) => money.format(value)

        return [
            {
                aggregation: 'count',
                column: 'Headcount',
                input: `${list.length} hàng trong phạm vi này`,
                math: 'đếm hàng, không nhìn vào giá trị ô nào cả',
                result: String(aggregate('count', [], list))
            },
            {
                aggregation: 'first',
                column: 'Name',
                input: `theo thứ tự dữ liệu: ${list[0]?.name} ... ${list.at(-1)?.name}`,
                math: 'ô không rỗng đầu tiên',
                result: String(
                    aggregate(
                        'first',
                        list.map((employee) => employee.name),
                        list
                    )
                )
            },
            {
                aggregation: 'last',
                column: 'Level',
                input: `theo thứ tự dữ liệu: ${list[0]?.level} ... ${list.at(-1)?.level}`,
                math: 'ô không rỗng cuối cùng',
                result: String(
                    aggregate(
                        'last',
                        list.map((employee) => employee.level),
                        list
                    )
                )
            },
            {
                aggregation: 'distinctCount',
                column: 'Countries',
                input: [...new Set(countries)].join(' | '),
                math: 'đếm số giá trị khác nhau, bỏ qua ô rỗng',
                result: String(aggregate('distinctCount', countries, list))
            },
            {
                aggregation: 'median',
                column: 'Salary',
                input: sortedList(salaries, asMoney),
                math: medianMath(salaries, asMoney),
                result: money.format(Number(aggregate('median', salaries, list)))
            },
            {
                aggregation: 'percentile p = 0.9',
                column: 'Bonus',
                input: sortedList(bonuses, asMoney),
                math: percentileMath(bonuses, 0.9, asMoney),
                result: money.format(
                    Number(aggregate({ kind: 'percentile', p: 0.9 }, bonuses, list))
                )
            },
            {
                aggregation: 'weightedAvg (tenure)',
                column: 'Rating',
                input: `sum(rating x tenure) = ${weighted.toFixed(1)} | sum(tenure) = ${weights}`,
                math: `${weighted.toFixed(1)} / ${weights}`,
                result: oneDecimal.format(
                    Number(
                        aggregate(
                            { kind: 'weightedAvg', weight: (row: Employee) => row.tenure },
                            ratings,
                            list
                        )
                    )
                )
            },
            {
                aggregation: 'max',
                column: 'Tenure',
                input: `${Math.min(...tenures)} tới ${Math.max(...tenures)} năm`,
                math: 'lớn nhất - một trong năm cái đã có từ đầu, để so sánh',
                result: String(aggregate('max', tenures, list))
            }
        ]
    })
</script>

{#snippet labelCell({ value }: DataGridCellContext<Employee>)}
    {@const text = String(value ?? '')}
    {#if text === ''}{:else if text.includes('(') || text.startsWith('Total')}
        <span class="font-medium text-on-surface">{text}</span>
    {:else}
        <Badge label={text} color="primary" size="sm" />
    {/if}
{/snippet}

{#snippet moneyCell({ value }: DataGridCellContext<Employee>)}
    {value === null || value === undefined ? '' : money.format(Number(value))}
{/snippet}

{#snippet ratingCell({ value }: DataGridCellContext<Employee>)}
    {value === null || value === undefined ? '' : oneDecimal.format(Number(value))}
{/snippet}

<Container class="space-y-6 py-10">
    <div class="flex items-center justify-between">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">
                Aggregation nâng cao - @sv5ui/datagrid
            </h1>
            <p class="text-sm text-on-surface-variant">
                320 nhân sự, gộp theo phòng ban. <strong
                    >Mỗi cột dùng một aggregator khác nhau</strong
                >
                - tên aggregator nằm ngay trong tiêu đề cột. Bảng dưới lưới bóc từng con số ra cho kiểm
                chứng bằng mắt.
            </p>
        </div>
        <div class="flex items-center gap-2">
            <Link href="/">← Grouping</Link>
            <Link href="/range">Range editing →</Link>
            <ThemeModeButton />
        </div>
    </div>

    <div
        class="rounded-lg border border-outline-variant bg-surface-container p-3 text-xs text-on-surface-variant"
    >
        Ba loại hàng trong lưới, đọc từ trái sang: <strong class="text-on-surface">hàng nhóm</strong
        >
        (<code>Core (81)</code>) tổng hợp 81 hàng của phòng đó |
        <strong class="text-on-surface">hàng footer</strong> đóng lại mỗi nhóm khi mở ra |
        <strong class="text-on-surface">hàng Total</strong> ở đáy là grand total:
        <strong class="text-on-surface">cùng những aggregator đó</strong>, nhưng chạy trên cả 320
        hàng. Nên <code>Total | Salary $75,700</code> nghĩa là "trung vị lương của toàn bộ 320
        người", không phải "tổng lương" - cột đó khai
        <code>median</code>, không phải <code>sum</code>.
    </div>

    <div class="flex flex-wrap items-center gap-2">
        <Button
            variant="outline"
            size="sm"
            label="Expand all"
            onclick={groupingState.expandAllGroups}
        />
        <Button
            variant="outline"
            size="sm"
            label="Collapse all"
            onclick={groupingState.collapseAllGroups}
        />
    </div>

    <Grid.GroupPanel {grid} />

    <DataGrid {grid} toolbar class="h-100" />

    <div class="space-y-3">
        <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm font-medium text-on-surface">Bóc con số của:</span>
            {#each [ALL, ...depts] as name (name)}
                <Button
                    variant={scope === name ? 'solid' : 'outline'}
                    size="sm"
                    label={name === ALL ? 'Total (cả 320 hàng)' : name}
                    onclick={() => (scope = name)}
                />
            {/each}
        </div>

        <div class="overflow-x-auto rounded-lg border border-outline-variant">
            <table class="w-full text-left text-xs">
                <thead class="bg-surface-container text-on-surface">
                    <tr>
                        <th class="px-3 py-2 font-medium">Cột</th>
                        <th class="px-3 py-2 font-medium">Aggregation</th>
                        <th class="px-3 py-2 font-medium">Đầu vào</th>
                        <th class="px-3 py-2 font-medium">Tính thế nào</th>
                        <th class="px-3 py-2 text-right font-medium">Ra số nào</th>
                    </tr>
                </thead>
                <tbody class="text-on-surface-variant">
                    {#each rows as row (row.aggregation)}
                        <tr class="border-t border-outline-variant align-top">
                            <td class="px-3 py-2 whitespace-nowrap text-on-surface">{row.column}</td
                            >
                            <td class="px-3 py-2 whitespace-nowrap"
                                ><code>{row.aggregation}</code></td
                            >
                            <td class="px-3 py-2">{row.input}</td>
                            <td class="px-3 py-2">{row.math}</td>
                            <td
                                class="px-3 py-2 text-right font-medium whitespace-nowrap text-on-surface"
                                >{row.result}</td
                            >
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>

        <p class="text-xs text-on-surface-variant">
            Bảng này gọi thẳng <code>aggregate()</code> mà lưới đang dùng, nên số ở cột phải phải khớp
            từng chữ số với hàng nhóm tương ứng trên lưới. Nếu lệch thì là thư viện sai, không phải trang
            demo sai.
        </p>
    </div>
</Container>
