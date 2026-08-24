import type { DataGridLocalePack } from '../core/types/index.js'

/** Japanese. */
export const jaJP: DataGridLocalePack = {
    tag: 'ja-JP',
    labels: {
        search: '検索...',
        activeFilters: '適用中のフィルター',
        removeFilter: (column) => `${column}のフィルターを解除`,
        clearAllFilters: 'すべて解除',
        chooseColumns: '列の選択',
        rowDensity: '行の高さ',
        densityCompact: '行の高さ: 狭い',
        densityStandard: '行の高さ: 標準',
        densityComfortable: '行の高さ: 広い',

        columnMenu: (column) => `${column}列のメニュー`,
        resizeColumn: (column) => `${column}列の幅を変更`,
        resizeGroup: (group) => `${group}グループの幅を変更`,
        sortAscending: '昇順に並べ替え',
        sortDescending: '降順に並べ替え',
        clearSort: '並べ替えを解除',
        pinLeft: '左に固定',
        pinRight: '右に固定',
        unpin: '固定を解除',
        openFilter: 'フィルター...',
        autosize: '内容に合わせる',
        hideColumn: '列を非表示',
        collapseGroup: (group) => `${group}を折りたたむ`,
        expandGroup: (group) => `${group}を展開`,

        filterColumn: (column) => `${column}をフィルター`,
        filterOperator: (ordinal) => (ordinal > 1 ? `フィルター条件 ${ordinal}` : 'フィルター条件'),
        filterValue: (ordinal) => (ordinal > 1 ? `フィルターの値 ${ordinal}` : 'フィルターの値'),
        filterRowValue: (column) => `${column}のフィルターの値`,
        filterUpperBound: (ordinal) => (ordinal > 1 ? `上限値 ${ordinal}` : '上限値'),
        valuePlaceholder: '値...',
        upperBoundPlaceholder: 'まで...',
        searchValues: '値を検索...',
        blankValue: '(空白)',
        anyValue: '(すべて)',
        combineConditions: '条件の組み合わせ',
        addCondition: '条件を追加',
        removeCondition: '条件を削除',
        matchCase: '大文字と小文字を区別',
        apply: '適用',
        clear: 'クリア',
        and: 'かつ',
        or: 'または',
        yes: 'はい',
        no: 'いいえ',
        textOps: {
            contains: '含む',
            notContains: '含まない',
            equals: '等しい',
            notEqual: '等しくない',
            startsWith: '前方一致',
            endsWith: '後方一致',
            blank: '空白',
            notBlank: '空白でない'
        },
        numberOps: {
            eq: '=',
            neq: '≠',
            gt: '>',
            gte: '≥',
            lt: '<',
            lte: '≤',
            between: '範囲内',
            blank: '空白',
            notBlank: '空白でない'
        },
        dateOps: {
            equals: '同じ日',
            before: 'より前',
            after: 'より後',
            between: '範囲内',
            blank: '空白',
            notBlank: '空白でない'
        },

        selectRow: (position) => `${position}行目を選択`,
        selectAllRows: 'すべての行を選択',
        rowActions: '行の操作',
        dragRow: (position) => `${position}行目を移動`,
        expandRow: '行を展開',
        collapseRow: '行を折りたたむ',

        rowsPerPage: '1ページの行数',
        pageSizeOption: (size) => `${size}件`,
        pageRange: (from, to, total) =>
            `${total.toLocaleString('ja-JP')}件中 ${from.toLocaleString('ja-JP')}–${to.toLocaleString('ja-JP')}件`,
        totalRows: (total) => `${total.toLocaleString('ja-JP')}行`,
        filteredRows: (filtered, total) =>
            `${total.toLocaleString('ja-JP')}行中 ${filtered.toLocaleString('ja-JP')}行`,
        selectedRows: (count) => `${count.toLocaleString('ja-JP')}行を選択中`,
        noData: 'データがありません',
        retry: '再試行',

        copy: 'コピー',
        copyWithHeaders: '見出し付きでコピー',
        exportCsv: 'CSVで書き出し',
        exportAllRows: 'すべての行',
        exportLoadedRows: '読み込み済みの行',
        exportSelectedRows: '選択した行',
        clearSelection: '選択を解除'
    },
    announcer: {
        sorted: (column, direction) =>
            `${column}を${direction === 'asc' ? '昇順' : '降順'}に並べ替えました`,
        sortCleared: () => '並べ替えを解除しました',
        filtered: (count) => `${count}行に絞り込みました`,
        page: (page) => `${page}ページ`,
        columnResized: (column, width) => `${column}列の幅を${width}ピクセルに変更しました`,
        columnMoved: (column, position) => `${column}列を${position}番目に移動しました`,
        columnPinned: (column, side) =>
            side ? `${column}列を固定しました` : `${column}列の固定を解除しました`,
        groupCollapsed: (group, collapsed) =>
            `${group}を${collapsed ? '折りたたみました' : '展開しました'}`,
        columnVisibility: (column, hidden) =>
            hidden ? `${column}列を非表示にしました` : `${column}列を表示しました`,
        selected: (count) => `${count}行を選択しました`,
        copied: (count) => `${count}行をコピーしました`,
        rowExpanded: (expanded) => (expanded ? '行を展開しました' : '行を折りたたみました'),
        rowPinned: (side) => (side ? '行を固定しました' : '行の固定を解除しました'),
        rowMoved: (position) => `行を${position}番目に移動しました`,
        editInvalid: (message) => message
    }
}
