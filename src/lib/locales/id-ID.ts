import type { DataGridLocalePack } from '../core/types/index.js'

/** Indonesian. */
export const idID: DataGridLocalePack = {
    tag: 'id-ID',
    labels: {
        search: 'Cari...',
        activeFilters: 'Filter aktif',
        removeFilter: (column) => `Hapus filter ${column}`,
        clearAllFilters: 'Hapus semua',
        chooseColumns: 'Pilih kolom',
        rowDensity: 'Kerapatan baris',
        densityCompact: 'Kerapatan rapat',
        densityStandard: 'Kerapatan standar',
        densityComfortable: 'Kerapatan renggang',

        columnMenu: (column) => `Menu kolom ${column}`,
        resizeColumn: (column) => `Ubah lebar kolom ${column}`,
        resizeGroup: (group) => `Ubah lebar grup ${group}`,
        sortAscending: 'Urutkan menaik',
        sortDescending: 'Urutkan menurun',
        clearSort: 'Hapus urutan',
        pinLeft: 'Sematkan di kiri',
        pinRight: 'Sematkan di kanan',
        unpin: 'Lepas sematan',
        openFilter: 'Filter...',
        autosize: 'Sesuaikan dengan isi',
        hideColumn: 'Sembunyikan kolom',

        filterColumn: (column) => `Filter ${column}`,
        filterOperator: (ordinal) =>
            ordinal > 1 ? `Operator filter ${ordinal}` : 'Operator filter',
        filterValue: (ordinal) => (ordinal > 1 ? `Nilai filter ${ordinal}` : 'Nilai filter'),
        filterUpperBound: (ordinal) => (ordinal > 1 ? `Batas atas ${ordinal}` : 'Batas atas'),
        valuePlaceholder: 'Nilai...',
        upperBoundPlaceholder: 'Sampai...',
        searchValues: 'Cari nilai...',
        blankValue: '(kosong)',
        combineConditions: 'Gabungkan kondisi',
        addCondition: 'Tambah kondisi',
        removeCondition: 'Hapus kondisi',
        matchCase: 'Bedakan huruf besar/kecil',
        apply: 'Terapkan',
        clear: 'Hapus',
        and: 'Dan',
        or: 'Atau',
        yes: 'Benar',
        no: 'Salah',
        textOps: {
            contains: 'Mengandung',
            notContains: 'Tidak mengandung',
            equals: 'Sama dengan',
            notEqual: 'Tidak sama dengan',
            startsWith: 'Diawali dengan',
            endsWith: 'Diakhiri dengan',
            blank: 'Kosong',
            notBlank: 'Tidak kosong'
        },
        numberOps: {
            eq: '=',
            neq: '≠',
            gt: '>',
            gte: '≥',
            lt: '<',
            lte: '≤',
            between: 'Di antara',
            blank: 'Kosong',
            notBlank: 'Tidak kosong'
        },
        dateOps: {
            equals: 'Sama dengan',
            before: 'Sebelum',
            after: 'Sesudah',
            between: 'Di antara',
            blank: 'Kosong',
            notBlank: 'Tidak kosong'
        },

        selectRow: (position) => `Pilih baris ${position}`,
        selectAllRows: 'Pilih semua baris',
        rowActions: 'Tindakan baris',
        dragRow: (position) => `Pindahkan baris ${position}`,
        expandRow: 'Buka baris',
        collapseRow: 'Tutup baris',

        rowsPerPage: 'Baris per halaman',
        pageSizeOption: (size) => `${size} / halaman`,
        pageRange: (from, to, total) =>
            `${from.toLocaleString('id-ID')}–${to.toLocaleString('id-ID')} dari ${total.toLocaleString('id-ID')}`,
        totalRows: (total) => `${total.toLocaleString('id-ID')} baris`,
        filteredRows: (filtered, total) =>
            `${filtered.toLocaleString('id-ID')} dari ${total.toLocaleString('id-ID')} baris`,
        selectedRows: (count) => `${count.toLocaleString('id-ID')} dipilih`,
        noData: 'Tidak ada data',
        retry: 'Coba lagi',

        copy: 'Salin',
        copyWithHeaders: 'Salin dengan judul kolom',
        exportCsv: 'Ekspor CSV',
        exportAllRows: 'Semua baris',
        exportLoadedRows: 'Baris yang dimuat',
        exportSelectedRows: 'Baris terpilih',
        clearSelection: 'Batalkan pilihan'
    },
    announcer: {
        sorted: (column, direction) =>
            `diurutkan menurut ${column} secara ${direction === 'asc' ? 'menaik' : 'menurun'}`,
        sortCleared: () => 'urutan dihapus',
        filtered: (count) => `${count} baris setelah difilter`,
        page: (page) => `halaman ${page}`,
        columnResized: (column, width) => `lebar kolom ${column} menjadi ${width} piksel`,
        columnMoved: (column, position) => `kolom ${column} dipindahkan ke posisi ${position}`,
        columnPinned: (column, side) =>
            side ? `kolom ${column} disematkan` : `sematan kolom ${column} dilepas`,
        columnVisibility: (column, hidden) =>
            hidden ? `kolom ${column} disembunyikan` : `kolom ${column} ditampilkan`,
        selected: (count) => `${count} baris dipilih`,
        copied: (count) => `${count} baris disalin`,
        rowExpanded: (expanded) => (expanded ? 'baris dibuka' : 'baris ditutup'),
        rowPinned: (side) => (side ? 'baris disematkan' : 'sematan baris dilepas'),
        rowMoved: (position) => `baris dipindahkan ke posisi ${position}`,
        editInvalid: (message) => message
    }
}
