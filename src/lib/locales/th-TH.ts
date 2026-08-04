import type { DataGridLocalePack } from '../core/types/index.js'

/** Thai. */
export const thTH: DataGridLocalePack = {
    tag: 'th-TH',
    labels: {
        search: 'ค้นหา...',
        activeFilters: 'ตัวกรองที่ใช้อยู่',
        removeFilter: (column) => `ล้างตัวกรอง ${column}`,
        clearAllFilters: 'ล้างทั้งหมด',
        chooseColumns: 'เลือกคอลัมน์',
        rowDensity: 'ความหนาแน่นของแถว',
        densityCompact: 'ความหนาแน่น: แน่น',
        densityStandard: 'ความหนาแน่น: มาตรฐาน',
        densityComfortable: 'ความหนาแน่น: โปร่ง',

        columnMenu: (column) => `เมนูคอลัมน์ ${column}`,
        resizeColumn: (column) => `ปรับความกว้างคอลัมน์ ${column}`,
        resizeGroup: (group) => `ปรับความกว้างกลุ่ม ${group}`,
        sortAscending: 'เรียงจากน้อยไปมาก',
        sortDescending: 'เรียงจากมากไปน้อย',
        clearSort: 'ยกเลิกการเรียง',
        pinLeft: 'ปักหมุดด้านซ้าย',
        pinRight: 'ปักหมุดด้านขวา',
        unpin: 'ยกเลิกการปักหมุด',
        openFilter: 'ตัวกรอง…',
        autosize: 'พอดีกับเนื้อหา',
        hideColumn: 'ซ่อนคอลัมน์',

        filterColumn: (column) => `กรอง ${column}`,
        filterOperator: (ordinal) =>
            ordinal > 1 ? `เงื่อนไขตัวกรอง ${ordinal}` : 'เงื่อนไขตัวกรอง',
        filterValue: (ordinal) => (ordinal > 1 ? `ค่าที่ใช้กรอง ${ordinal}` : 'ค่าที่ใช้กรอง'),
        filterUpperBound: (ordinal) => (ordinal > 1 ? `ค่าสูงสุด ${ordinal}` : 'ค่าสูงสุด'),
        valuePlaceholder: 'ค่า...',
        upperBoundPlaceholder: 'ถึง...',
        searchValues: 'ค้นหาค่า...',
        blankValue: '(ว่าง)',
        combineConditions: 'รวมเงื่อนไข',
        addCondition: 'เพิ่มเงื่อนไข',
        removeCondition: 'ลบเงื่อนไข',
        matchCase: 'ตรงตามตัวพิมพ์ใหญ่-เล็ก',
        apply: 'ใช้งาน',
        clear: 'ล้าง',
        and: 'และ',
        or: 'หรือ',
        yes: 'ใช่',
        no: 'ไม่ใช่',
        textOps: {
            contains: 'มีคำว่า',
            notContains: 'ไม่มีคำว่า',
            equals: 'เท่ากับ',
            notEqual: 'ไม่เท่ากับ',
            startsWith: 'ขึ้นต้นด้วย',
            endsWith: 'ลงท้ายด้วย',
            blank: 'ว่าง',
            notBlank: 'ไม่ว่าง'
        },
        numberOps: {
            eq: '=',
            neq: '≠',
            gt: '>',
            gte: '≥',
            lt: '<',
            lte: '≤',
            between: 'อยู่ระหว่าง',
            blank: 'ว่าง',
            notBlank: 'ไม่ว่าง'
        },
        dateOps: {
            equals: 'ตรงกับวันที่',
            before: 'ก่อนวันที่',
            after: 'หลังวันที่',
            between: 'อยู่ระหว่าง',
            blank: 'ว่าง',
            notBlank: 'ไม่ว่าง'
        },

        selectRow: (position) => `เลือกแถวที่ ${position}`,
        selectAllRows: 'เลือกทุกแถว',
        rowActions: 'การทำงานของแถว',
        dragRow: (position) => `ย้ายแถวที่ ${position}`,
        expandRow: 'ขยายแถว',
        collapseRow: 'ยุบแถว',

        rowsPerPage: 'จำนวนแถวต่อหน้า',
        pageSizeOption: (size) => `${size} แถว/หน้า`,
        pageRange: (from, to, total) =>
            `${from.toLocaleString('th-TH')}–${to.toLocaleString('th-TH')} จาก ${total.toLocaleString('th-TH')}`,
        totalRows: (total) => `${total.toLocaleString('th-TH')} แถว`,
        filteredRows: (filtered, total) =>
            `${filtered.toLocaleString('th-TH')} จาก ${total.toLocaleString('th-TH')} แถว`,
        selectedRows: (count) => `เลือกแล้ว ${count.toLocaleString('th-TH')}`,
        noData: 'ไม่มีข้อมูล',
        retry: 'ลองใหม่',

        copy: 'คัดลอก',
        copyWithHeaders: 'คัดลอกพร้อมหัวตาราง',
        exportCsv: 'ส่งออก CSV',
        clearSelection: 'ยกเลิกการเลือก'
    },
    announcer: {
        sorted: (column, direction) =>
            `เรียง ${column} ${direction === 'asc' ? 'จากน้อยไปมาก' : 'จากมากไปน้อย'} แล้ว`,
        sortCleared: () => 'ยกเลิกการเรียงแล้ว',
        filtered: (count) => `กรองแล้วเหลือ ${count} แถว`,
        page: (page) => `หน้า ${page}`,
        columnResized: (column, width) => `ปรับความกว้างคอลัมน์ ${column} เป็น ${width} พิกเซล`,
        columnMoved: (column, position) => `ย้ายคอลัมน์ ${column} ไปตำแหน่งที่ ${position}`,
        columnPinned: (column, side) =>
            side ? `ปักหมุดคอลัมน์ ${column} แล้ว` : `ยกเลิกการปักหมุดคอลัมน์ ${column} แล้ว`,
        columnVisibility: (column, hidden) =>
            hidden ? `ซ่อนคอลัมน์ ${column} แล้ว` : `แสดงคอลัมน์ ${column} แล้ว`,
        selected: (count) => `เลือก ${count} แถวแล้ว`,
        copied: (count) => `คัดลอก ${count} แถวแล้ว`,
        rowExpanded: (expanded) => (expanded ? 'ขยายแถวแล้ว' : 'ยุบแถวแล้ว'),
        rowPinned: (side) => (side ? 'ปักหมุดแถวแล้ว' : 'ยกเลิกการปักหมุดแถวแล้ว'),
        rowMoved: (position) => `ย้ายแถวไปตำแหน่งที่ ${position}`,
        editInvalid: (message) => message
    }
}
