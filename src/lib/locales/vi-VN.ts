import type { DataGridLocalePack } from '../core/types/index.js'

/** Vietnamese. Number and date formatting follow the same tag through `Intl`. */
export const viVN: DataGridLocalePack = {
    tag: 'vi-VN',
    labels: {
        search: 'Tìm kiếm...',
        activeFilters: 'Bộ lọc đang bật',
        removeFilter: (column) => `Bỏ lọc ${column}`,
        clearAllFilters: 'Xoá hết',
        chooseColumns: 'Chọn cột',
        rowDensity: 'Mật độ dòng',
        densityCompact: 'Dày',
        densityStandard: 'Vừa',
        densityComfortable: 'Thưa',

        columnMenu: (column) => `Menu cột ${column}`,
        resizeColumn: (column) => `Đổi rộng cột ${column}`,
        resizeGroup: (group) => `Đổi rộng nhóm ${group}`,
        sortAscending: 'Sắp xếp tăng dần',
        sortDescending: 'Sắp xếp giảm dần',
        clearSort: 'Bỏ sắp xếp',
        pinLeft: 'Ghim trái',
        pinRight: 'Ghim phải',
        unpin: 'Bỏ ghim',
        openFilter: 'Lọc…',
        autosize: 'Vừa nội dung',
        hideColumn: 'Ẩn cột',

        filterColumn: (column) => `Lọc ${column}`,
        filterOperator: (ordinal) => (ordinal > 1 ? `Toán tử lọc ${ordinal}` : 'Toán tử lọc'),
        filterValue: (ordinal) => (ordinal > 1 ? `Giá trị lọc ${ordinal}` : 'Giá trị lọc'),
        filterRowValue: (column) => `Giá trị lọc ${column}`,
        filterUpperBound: (ordinal) => (ordinal > 1 ? `Giá trị đến ${ordinal}` : 'Giá trị đến'),
        valuePlaceholder: 'Giá trị...',
        upperBoundPlaceholder: 'Đến...',
        searchValues: 'Tìm giá trị...',
        blankValue: '(trống)',
        anyValue: '(bất kỳ)',
        combineConditions: 'Kết hợp điều kiện',
        addCondition: 'Thêm điều kiện',
        removeCondition: 'Bớt điều kiện',
        matchCase: 'Phân biệt hoa thường',
        apply: 'Áp dụng',
        clear: 'Xoá',
        and: 'Và',
        or: 'Hoặc',
        yes: 'Có',
        no: 'Không',
        textOps: {
            contains: 'Chứa',
            notContains: 'Không chứa',
            equals: 'Bằng',
            notEqual: 'Khác',
            startsWith: 'Bắt đầu bằng',
            endsWith: 'Kết thúc bằng',
            blank: 'Đang trống',
            notBlank: 'Không trống'
        },
        numberOps: {
            eq: '=',
            neq: '≠',
            gt: '>',
            gte: '≥',
            lt: '<',
            lte: '≤',
            between: 'Trong khoảng',
            blank: 'Đang trống',
            notBlank: 'Không trống'
        },
        dateOps: {
            equals: 'Đúng ngày',
            before: 'Trước ngày',
            after: 'Sau ngày',
            between: 'Trong khoảng',
            blank: 'Đang trống',
            notBlank: 'Không trống'
        },

        selectRow: (position) => `Chọn dòng ${position}`,
        selectAllRows: 'Chọn tất cả các dòng',
        rowActions: 'Thao tác dòng',
        dragRow: (position) => `Chuyển dòng ${position}`,
        expandRow: 'Mở dòng',
        collapseRow: 'Thu dòng',

        rowsPerPage: 'Số dòng mỗi trang',
        pageSizeOption: (size) => `${size} dòng/trang`,
        pageRange: (from, to, total) =>
            `${from.toLocaleString('vi-VN')}–${to.toLocaleString('vi-VN')} trên ${total.toLocaleString('vi-VN')}`,
        totalRows: (total) => `${total.toLocaleString('vi-VN')} dòng`,
        filteredRows: (filtered, total) =>
            `${filtered.toLocaleString('vi-VN')} / ${total.toLocaleString('vi-VN')} dòng`,
        selectedRows: (count) => `đã chọn ${count.toLocaleString('vi-VN')}`,
        noData: 'Không có dữ liệu',
        retry: 'Thử lại',

        copy: 'Sao chép',
        copyWithHeaders: 'Sao chép kèm tiêu đề',
        exportCsv: 'Xuất CSV',
        exportAllRows: 'Tất cả các dòng',
        exportLoadedRows: 'Các dòng đã tải',
        exportSelectedRows: 'Các dòng đã chọn',
        clearSelection: 'Bỏ chọn'
    },
    announcer: {
        sorted: (column, direction) =>
            `đã sắp xếp theo ${column} ${direction === 'asc' ? 'tăng dần' : 'giảm dần'}`,
        sortCleared: () => 'đã bỏ sắp xếp',
        filtered: (count) => `còn ${count} dòng`,
        page: (page) => `trang ${page}`,
        columnResized: (column, width) => `cột ${column} rộng ${width} pixel`,
        columnMoved: (column, position) => `cột ${column} chuyển tới vị trí ${position}`,
        columnPinned: (column, side) =>
            side ? `đã ghim cột ${column}` : `đã bỏ ghim cột ${column}`,
        columnVisibility: (column, hidden) =>
            hidden ? `đã ẩn cột ${column}` : `đã hiện cột ${column}`,
        selected: (count) => `đã chọn ${count} dòng`,
        copied: (count) => `đã sao chép ${count} dòng`,
        rowExpanded: (expanded) => (expanded ? 'đã mở dòng' : 'đã thu dòng'),
        rowPinned: (side) => (side ? 'đã ghim dòng' : 'đã bỏ ghim dòng'),
        rowMoved: (position) => `dòng chuyển tới vị trí ${position}`,
        editInvalid: (message) => message
    }
}
