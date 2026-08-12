<script lang="ts">
    import { Badge, Container, Link, ThemeModeButton } from 'sv5ui'
    import {
        columnOps,
        createDataGrid,
        DataGrid,
        filtering,
        pagination,
        sorting,
        type ColumnDef,
        type DataGridCellContext
    } from '$lib/index.js'

    interface Member {
        id: number
        name: string
        avatar: string
        role: string
        team: string
        salary: number
        share: number
        joined: string
        lastSeen: string
        active: boolean
        completion: number
        rating: number
        profile: string
    }

    const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Ethan', 'Fiona', 'George', 'Hana']
    const lastNames = ['Nguyen', 'Tran', 'Le', 'Pham', 'Vo', 'Dang', 'Ho', 'Bui']
    const roles = ['Engineer', 'Designer', 'Manager', 'Analyst']
    const teams = ['Core', 'Platform', 'Growth', 'Data']

    const members: Member[] = Array.from({ length: 40 }, (_, i) => ({
        id: i + 1,
        name: `${firstNames[i % 8]} ${lastNames[Math.floor(i / 8) % 8]}`,
        avatar: `https://i.pravatar.cc/64?img=${(i % 60) + 1}`,
        role: roles[i % 4],
        team: teams[i % 4],
        salary: 68_000 + (i % 20) * 4_300,
        share: (((i * 7) % 85) + 12) / 100,
        joined: new Date(Date.UTC(2021 + (i % 5), i % 12, (i % 27) + 1)).toISOString(),
        lastSeen: new Date(
            Date.UTC(2026, 6, (i % 20) + 1, (i * 3) % 24, (i * 7) % 60)
        ).toISOString(),
        active: i % 4 !== 0,
        completion: ((i * 13) % 88) + 12,
        rating: (i % 5) + 1,
        profile: `https://example.com/team/${i + 1}`
    }))

    let lastAction = $state('')

    const columns: ColumnDef<Member>[] = [
        {
            id: 'name',
            header: 'Member',
            type: 'user',
            sortable: true,
            width: 230,
            typeOptions: {
                avatar: (member) => member.avatar,
                description: (member) => member.role
            }
        },
        {
            id: 'team',
            header: 'Team',
            type: 'badge',
            sortable: true,
            width: 120,
            typeOptions: {
                colors: {
                    Core: 'primary',
                    Platform: 'tertiary',
                    Growth: 'success',
                    Data: 'info'
                }
            }
        },
        {
            id: 'salary',
            header: 'Salary',
            type: 'currency',
            sortable: true,
            align: 'right',
            width: 130,
            typeOptions: { currency: 'USD', numberFormat: { maximumFractionDigits: 0 } },
            // Says what the cell says — the formatted amount, not the number
            // behind it — through the sv5ui tooltip.
            tooltip: true
        },
        {
            id: 'budget',
            header: 'Budget',
            accessor: (member) => member.salary * 3,
            sortable: true,
            align: 'right',
            width: 150,
            // `type` says what the value is and the snippet decorates it: the
            // snippet reads `formatted` rather than restating typeOptions.
            type: 'currency',
            typeOptions: { currency: 'USD', numberFormat: { maximumFractionDigits: 0 } },
            cell: budgetCell
        },
        {
            id: 'share',
            header: 'Share',
            type: 'percent',
            sortable: true,
            align: 'right',
            width: 100
        },
        { id: 'joined', header: 'Joined', type: 'date', sortable: true, width: 140 },
        { id: 'lastSeen', header: 'Last seen', type: 'datetime', sortable: true, width: 190 },
        { id: 'active', header: 'Active', type: 'boolean', align: 'center', width: 110 },
        { id: 'completion', header: 'Completion', type: 'progress', width: 150 },
        { id: 'rating', header: 'Rating', type: 'rating', width: 140 },
        { id: 'profile', header: 'Profile', type: 'link', width: 200 },
        {
            id: 'actions',
            header: '',
            type: 'actions',
            align: 'center',
            width: 70,
            typeOptions: {
                actions: (member) => [
                    {
                        label: 'Edit',
                        icon: 'lucide:pencil',
                        onSelect: () => (lastAction = `Edit ${member.name}`)
                    },
                    {
                        label: 'Duplicate',
                        icon: 'lucide:copy',
                        onSelect: () => (lastAction = `Duplicate ${member.name}`)
                    },
                    {
                        label: 'Delete',
                        icon: 'lucide:trash-2',
                        destructive: true,
                        onSelect: () => (lastAction = `Delete ${member.name}`)
                    }
                ]
            }
        }
    ]

    const grid = createDataGrid<Member>({
        data: members,
        columns,
        getRowId: (member) => String(member.id),
        features: [filtering(), sorting(), columnOps(), pagination({ pageSize: 8 })]
    })

    const localeGrid = createDataGrid<Member>({
        data: members.slice(0, 4),
        columns: [
            { id: 'name-0', header: 'Member', width: 180, accessor: (m) => m.name },
            {
                id: 'eur',
                header: 'de-DE / EUR',
                type: 'currency',
                align: 'right',
                width: 170,
                accessor: (m) => m.salary,
                typeOptions: { locale: 'de-DE', currency: 'EUR' }
            },
            {
                id: 'jpy',
                header: 'ja-JP / JPY',
                type: 'currency',
                align: 'right',
                width: 170,
                accessor: (m) => m.salary,
                typeOptions: { locale: 'ja-JP', currency: 'JPY' }
            },
            {
                id: 'fr',
                header: 'fr-FR full date',
                type: 'date',
                width: 240,
                accessor: (m) => m.joined,
                typeOptions: { locale: 'fr-FR', dateFormat: { dateStyle: 'full' } }
            }
        ],
        getRowId: (member) => String(member.id)
    })
</script>

{#snippet budgetCell({ value, formatted }: DataGridCellContext<Member>)}
    <span class="inline-flex items-center gap-1.5" data-testid="budget-cell">
        {formatted}
        {#if Number(value) > 300000}
            <Badge label="high" color="warning" size="xs" />
        {/if}
    </span>
{/snippet}

<Container class="space-y-8 py-10">
    <div class="flex items-center justify-between">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">Cell renderers — sv5ui showcase</h1>
            <p class="text-sm text-on-surface-variant">
                Đặt <code>type</code> trên cột là xong — không cần viết snippet. 11 renderer dựng
                sẵn bằng chính component sv5ui: <code>user</code>, <code>badge</code>,
                <code>currency</code>, <code>percent</code>, <code>date</code>,
                <code>datetime</code>, <code>boolean</code>, <code>progress</code>,
                <code>rating</code>, <code>link</code>, <code>actions</code>.
            </p>
            <p class="text-sm text-on-surface-variant">
                Cột <strong>Salary</strong> bật <code>tooltip: true</code> — di chuột vào ô để thấy
                tooltip sv5ui nói đúng chữ ô đang hiện (<code>$204,000</code>), không phải số thô
                phía sau. Cột <strong>Budget</strong> vừa khai <code>type</code> vừa có
                <code>cell</code>: snippet đọc <code>formatted</code> rồi gắn thêm badge.
            </p>
        </div>
        <div class="flex items-center gap-2">
            <Link href="/">← Home</Link>
            <ThemeModeButton />
        </div>
    </div>

    <section class="space-y-3">
        <DataGrid {grid} toolbar />
        <p class="text-xs text-on-surface-variant">
            {lastAction
                ? `Hành động gần nhất: ${lastAction}`
                : 'Mở menu ⋯ ở cột cuối để thử actions.'}
        </p>
    </section>

    <section class="space-y-3">
        <div class="space-y-1">
            <h2 class="text-lg font-medium text-on-surface">Locale và Intl</h2>
            <p class="text-sm text-on-surface-variant">
                Cùng một dữ liệu, khác <code>locale</code> / <code>currency</code> /
                <code>dateFormat</code>. Formatter được memo hoá nên đổi trang hay cuộn không dựng
                lại
                <code>Intl</code>.
            </p>
        </div>
        <DataGrid grid={localeGrid} />
    </section>
</Container>
