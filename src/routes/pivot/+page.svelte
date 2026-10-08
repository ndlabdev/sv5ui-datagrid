<script lang="ts">
    import { Button, Card, Link, ThemeModeButton } from 'sv5ui'

    const groups = [
        {
            name: 'Nền tảng',
            demos: [
                [
                    '/pivot/crossing',
                    'Phép giao',
                    'Hai trục và một measure, cột do lưới đọc dữ liệu mà sinh ra'
                ],
                ['/pivot/totals', 'Tổng đo từ dòng', 'Vì sao trung bình là 110 chứ không phải 120'],
                ['/pivot/total-row', 'Hàng tổng và cột tổng', 'Khép cả hai chiều về ô góc 1050']
            ]
        },
        {
            name: 'Trục cột',
            demos: [
                [
                    '/pivot/nested',
                    'Trục cột lồng nhau',
                    'Nhiều trường ngang, và tổng con từng nhánh'
                ],
                ['/pivot/folding', 'Gập nhánh cột', 'Gập về tổng con, hoặc về một dải hẹp'],
                ['/pivot/keys', 'Tự khai khoá cột', 'Thứ tự riêng, và cột chưa có dòng nào'],
                ['/pivot/ordering', 'Khoá xếp theo giá trị', 'Trục ngày chạy theo thời gian'],
                ['/pivot/max-columns', 'Trần số cột', 'Từ chối chứ không cắt bớt'],
                ['/pivot/order-columns', 'Sắp cột theo measure', 'Quý nào bán tốt nhất đứng trước'],
                ['/pivot/header', 'Chữ trên header sinh ra', 'Giành lại quyền đặt tên cho cột'],
                [
                    '/pivot/header-height',
                    'Chiều cao của header',
                    'Tầng nhóm hạ riêng, hàng lá giữ nguyên'
                ],
                [
                    '/pivot/header-tall',
                    'Header lá cần cao hơn',
                    'Nới riêng hàng header cho tiêu đề dài'
                ]
            ]
        },
        {
            name: 'Measure',
            demos: [
                ['/pivot/measures', 'Nhiều measure', 'Mỗi phép giao tách thành nhiều lá'],
                ['/pivot/values-on-rows', 'Measure xếp dọc', 'Chặn trục cột nhân lên'],
                ['/pivot/shares', 'Đọc theo tỉ lệ', 'Phần trăm của hàng, của cột, của cả bảng'],
                ['/pivot/along-row', 'Đọc theo ô bên cạnh', 'Luỹ kế, chênh lệch, thứ hạng'],
                ['/pivot/ratio', 'Chia measure cho measure', 'Và vì sao không chia theo dòng']
            ]
        },
        {
            name: 'Người đọc làm gì với nó',
            demos: [
                [
                    '/pivot/keep-rows',
                    'Chỉ giữ hàng lớn nhất',
                    'Top N theo measure, tổng đo lại trên phần còn lại'
                ],
                ['/pivot/drill', 'Dòng sau một ô', 'Lối duy nhất đi xuống dữ liệu thô'],
                [
                    '/pivot/sorting',
                    'Sắp hàng theo cột giao',
                    'Sắp trong phạm vi anh em, không trộn nhóm'
                ],
                [
                    '/pivot/axes',
                    'Đổi trục, tắt bật, lưu lại',
                    'Phép giao nằm trong bản chụp trạng thái'
                ],
                ['/pivot/panel', 'Bảng điều khiển', 'Tự dựng phép giao lúc đang chạy']
            ]
        }
    ]

    const total = groups.reduce((sum, group) => sum + group.demos.length, 0)
</script>

<div class="mx-auto max-w-5xl space-y-6 px-4 py-8">
    <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">Pivot, từng tính năng một</h1>
            <p class="text-sm text-on-surface-variant">
                {total} trang, mỗi trang đúng một cơ chế của riêng pivot và mô tả chi tiết cách nó chạy.
                Tất cả dùng chung 10 dòng dữ liệu để bạn cộng nhẩm kiểm lại được.
            </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
            <Button variant="ghost" size="sm" label="Trang chủ" href="/" />
            <ThemeModeButton />
        </div>
    </div>

    {#each groups as group (group.name)}
        <section class="space-y-2">
            <h2 class="text-sm font-medium text-on-surface-variant">{group.name}</h2>
            <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {#each group.demos as [href, title, what] (href)}
                    <Card class="space-y-0.5 p-3">
                        <Link {href} class="text-sm font-medium">{title}</Link>
                        <p class="text-xs text-on-surface-variant">{what}</p>
                    </Card>
                {/each}
            </div>
        </section>
    {/each}
</div>
