<script lang="ts">
    import { createDataGrid, DataGrid, isPivotColumn, pivot } from '$lib/index.js'
    import { Button } from 'sv5ui'
    import Case from '../Case.svelte'
    import { columns, rowId, sales, type Sale } from '../demo-data.js'

    const grid = createDataGrid<Sale>({
        data: sales,
        columns,
        getRowId: rowId,
        features: [
            pivot<Sale>({
                rows: ['region'],
                columns: ['quarter'],
                values: [
                    { field: 'amount', agg: 'sum', header: 'Tiền' },
                    { field: 'units', agg: 'sum', header: 'Cái' },
                    { field: 'amount', agg: 'avg', header: 'Tiền TB' }
                ],
                valuesOn: 'rows'
            })
        ]
    })

    const where = $derived(grid.api.pivotValuesOn?.() ?? 'columns')
    const leaves = $derived(grid.columns.visible.filter((c) => isPivotColumn(c.id)).length)

    const code = "valuesOn: 'rows'"
</script>

<Case
    title="Xếp measure xuống dọc"
    what="Mặc định measure chồng lên trục cột, nên bảng rộng bằng số phép giao nhân số measure. valuesOn 'rows' chặn phép nhân ấy: mỗi phép giao còn một cột, mỗi nhóm nở ra một hàng cho mỗi measure."
    look="Đổi trục và nhìn con số cạnh hai nút: 3 measure chạy ngang thành 9 cột, chạy dọc còn 4. Mọi tầng nhóm đều nở, nên gập lại vẫn đọc được."
    {code}
>
    {#snippet controls()}
        <Button
            variant={where === 'columns' ? 'solid' : 'outline'}
            size="sm"
            label="Chạy ngang"
            onclick={() => grid.api.setPivotValuesOn?.('columns')}
        />
        <Button
            variant={where === 'rows' ? 'solid' : 'outline'}
            size="sm"
            label="Chạy dọc"
            onclick={() => grid.api.setPivotValuesOn?.('rows')}
        />
        <span class="text-sm text-on-surface-variant">{leaves} cột sinh ra</span>
    {/snippet}

    <DataGrid {grid} />

    {#snippet after()}
        <div class="space-y-2 rounded-lg border border-outline-variant p-4 text-sm">
            <h2 class="font-medium text-on-surface">Cách nó chạy</h2>
            <p class="text-on-surface-variant">
                Đổi chỗ measure không đổi phép đo nào. Vẫn chừng ấy con số, chỉ khác chúng nằm ở ô
                nào. Chạy ngang thì mỗi phép giao nở thành nhiều cột; chạy dọc thì mỗi phép giao còn
                một cột, và mỗi nhóm hàng nở thêm một dòng cho mỗi measure.
            </p>
            <p class="text-on-surface-variant">
                Phép toán vì thế đổi từ nhân sang cộng. Ba quý với ba measure: chạy ngang là 3 nhân
                3 thành 9 cột, chạy dọc là 3 cột và mỗi nhóm thêm 3 dòng. Bảng cao lên thay vì rộng
                ra, mà cuộn dọc bao giờ cũng dễ hơn cuộn ngang.
            </p>
            <p class="text-on-surface-variant">
                Dòng measure mọc ở mọi tầng nhóm, kể cả tầng trong cùng và kể cả hàng tổng. Nhờ vậy
                gập một nhóm lại vẫn còn đọc được từng measure của chính nhóm ấy, chứ không mất
                chúng theo.
            </p>
            <p class="text-on-surface-variant">
                Những dòng này không phải dòng dữ liệu. Chúng không mở ra được, không sửa được, và
                mang id riêng để không đụng id của nhóm. Mọi thứ đọc theo tỉ lệ vẫn chạy bình thường
                trên chúng.
            </p>
        </div>
    {/snippet}
</Case>
