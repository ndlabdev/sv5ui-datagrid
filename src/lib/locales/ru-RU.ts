import type { DataGridLocalePack } from '../core/types/index.js'
import { plural } from '../core/interaction/plural.js'

/**
 * Russian. Three forms (1 строка, 2 строки, 5 строк) and picking the wrong one
 * reads as broken.
 */
const rows = plural('ru-RU', { one: 'строка', few: 'строки', other: 'строк' })

export const ruRU: DataGridLocalePack = {
    tag: 'ru-RU',
    labels: {
        search: 'Поиск...',
        activeFilters: 'Активные фильтры',
        removeFilter: (column) => `Снять фильтр ${column}`,
        clearAllFilters: 'Очистить все',
        chooseColumns: 'Выбрать столбцы',
        rowDensity: 'Высота строк',
        densityCompact: 'Компактные строки',
        densityStandard: 'Обычные строки',
        densityComfortable: 'Просторные строки',

        columnMenu: (column) => `Меню столбца ${column}`,
        resizeColumn: (column) => `Изменить ширину столбца ${column}`,
        resizeGroup: (group) => `Изменить ширину группы ${group}`,
        sortAscending: 'Сортировать по возрастанию',
        sortDescending: 'Сортировать по убыванию',
        clearSort: 'Сбросить сортировку',
        pinLeft: 'Закрепить слева',
        pinRight: 'Закрепить справа',
        unpin: 'Открепить',
        openFilter: 'Фильтр...',
        autosize: 'По содержимому',
        hideColumn: 'Скрыть столбец',
        collapseGroup: (group) => `Свернуть ${group}`,
        expandGroup: (group) => `Развернуть ${group}`,

        filterColumn: (column) => `Фильтр ${column}`,
        filterOperator: (ordinal) =>
            ordinal > 1 ? `Условие фильтра ${ordinal}` : 'Условие фильтра',
        filterValue: (ordinal) =>
            ordinal > 1 ? `Значение фильтра ${ordinal}` : 'Значение фильтра',
        filterRowValue: (column) => `Значение фильтра ${column}`,
        filterUpperBound: (ordinal) =>
            ordinal > 1 ? `Верхняя граница ${ordinal}` : 'Верхняя граница',
        valuePlaceholder: 'Значение...',
        upperBoundPlaceholder: 'До...',
        searchValues: 'Поиск значений...',
        blankValue: '(пусто)',
        anyValue: '(любое)',
        combineConditions: 'Объединение условий',
        addCondition: 'Добавить условие',
        removeCondition: 'Удалить условие',
        matchCase: 'Учитывать регистр',
        apply: 'Применить',
        clear: 'Очистить',
        and: 'И',
        or: 'Или',
        yes: 'Да',
        no: 'Нет',
        textOps: {
            contains: 'Содержит',
            notContains: 'Не содержит',
            equals: 'Равно',
            notEqual: 'Не равно',
            startsWith: 'Начинается с',
            endsWith: 'Заканчивается на',
            blank: 'Пусто',
            notBlank: 'Не пусто'
        },
        numberOps: {
            eq: '=',
            neq: '≠',
            gt: '>',
            gte: '≥',
            lt: '<',
            lte: '≤',
            between: 'Между',
            blank: 'Пусто',
            notBlank: 'Не пусто'
        },
        dateOps: {
            equals: 'Равно',
            before: 'До',
            after: 'После',
            between: 'Между',
            blank: 'Пусто',
            notBlank: 'Не пусто'
        },

        selectRow: (position) => `Выбрать строку ${position}`,
        selectAllRows: 'Выбрать все строки',
        rowActions: 'Действия со строкой',
        dragRow: (position) => `Переместить строку ${position}`,
        expandRow: 'Развернуть строку',
        collapseRow: 'Свернуть строку',

        rowsPerPage: 'Строк на странице',
        pageSizeOption: (size) => `${size} / стр.`,
        pageRange: (from, to, total) =>
            `${from.toLocaleString('ru-RU')}–${to.toLocaleString('ru-RU')} из ${total.toLocaleString('ru-RU')}`,
        totalRows: (total) => `${total.toLocaleString('ru-RU')} ${rows(total)}`,
        filteredRows: (filtered, total) =>
            `${filtered.toLocaleString('ru-RU')} из ${total.toLocaleString('ru-RU')} ${rows(total)}`,
        selectedRows: (count) => `Выбрано: ${count.toLocaleString('ru-RU')}`,
        noData: 'Нет данных',
        retry: 'Повторить',

        copy: 'Копировать',
        copyWithHeaders: 'Копировать с заголовками',
        exportCsv: 'Экспорт в CSV',
        exportAllRows: 'Все строки',
        exportLoadedRows: 'Загруженные строки',
        exportSelectedRows: 'Выбранные строки',
        clearSelection: 'Снять выделение'
    },
    announcer: {
        sorted: (column, direction) =>
            `отсортировано по ${column} ${direction === 'asc' ? 'по возрастанию' : 'по убыванию'}`,
        sortCleared: () => 'сортировка сброшена',
        filtered: (count) => `после фильтра ${count} ${rows(count)}`,
        page: (page) => `страница ${page}`,
        columnResized: (column, width) => `ширина столбца ${column} — ${width} пикселей`,
        columnMoved: (column, position) => `столбец ${column} перемещён на позицию ${position}`,
        columnPinned: (column, side) =>
            side ? `столбец ${column} закреплён` : `столбец ${column} откреплён`,
        groupCollapsed: (group, collapsed) => `${group} ${collapsed ? 'свёрнута' : 'развёрнута'}`,
        columnVisibility: (column, hidden) =>
            hidden ? `столбец ${column} скрыт` : `столбец ${column} показан`,
        selected: (count) => `выбрано ${count} ${rows(count)}`,
        copied: (count) => `скопировано ${count} ${rows(count)}`,
        rowExpanded: (expanded) => (expanded ? 'строка развёрнута' : 'строка свёрнута'),
        rowPinned: (side) => (side ? 'строка закреплена' : 'строка откреплена'),
        rowMoved: (position) => `строка перемещена на позицию ${position}`,
        editInvalid: (message) => message
    }
}
