import type { DataGridLocalePack } from '../core/types/index.js'
import { plural } from '../core/interaction/plural.js'

const rows = plural('es-ES', { one: 'fila', other: 'filas' })
// El participio concuerda con el número, no solo el sustantivo.
const selectedRows = plural('es-ES', { one: 'fila seleccionada', other: 'filas seleccionadas' })
const copiedRows = plural('es-ES', { one: 'fila copiada', other: 'filas copiadas' })

/** Spanish. */
export const esES: DataGridLocalePack = {
    tag: 'es-ES',
    labels: {
        search: 'Buscar...',
        activeFilters: 'Filtros activos',
        removeFilter: (column) => `Quitar el filtro ${column}`,
        clearAllFilters: 'Borrar todo',
        chooseColumns: 'Elegir columnas',
        rowDensity: 'Densidad de filas',
        densityCompact: 'Densidad compacta',
        densityStandard: 'Densidad estándar',
        densityComfortable: 'Densidad amplia',

        columnMenu: (column) => `Menú de la columna ${column}`,
        resizeColumn: (column) => `Cambiar el ancho de la columna ${column}`,
        resizeGroup: (group) => `Cambiar el ancho del grupo ${group}`,
        sortAscending: 'Ordenar de forma ascendente',
        sortDescending: 'Ordenar de forma descendente',
        clearSort: 'Quitar el orden',
        pinLeft: 'Fijar a la izquierda',
        pinRight: 'Fijar a la derecha',
        unpin: 'Dejar de fijar',
        openFilter: 'Filtrar…',
        autosize: 'Ajustar al contenido',
        hideColumn: 'Ocultar la columna',
        collapseGroup: (group) => `Contraer ${group}`,
        expandGroup: (group) => `Expandir ${group}`,

        filterColumn: (column) => `Filtrar ${column}`,
        filterOperator: (ordinal) =>
            ordinal > 1 ? `Operador del filtro ${ordinal}` : 'Operador del filtro',
        filterValue: (ordinal) =>
            ordinal > 1 ? `Valor del filtro ${ordinal}` : 'Valor del filtro',
        filterUpperBound: (ordinal) =>
            ordinal > 1 ? `Límite superior ${ordinal}` : 'Límite superior',
        valuePlaceholder: 'Valor...',
        upperBoundPlaceholder: 'Hasta...',
        searchValues: 'Buscar valores...',
        blankValue: '(vacío)',
        combineConditions: 'Combinar condiciones',
        addCondition: 'Añadir condición',
        removeCondition: 'Quitar condición',
        matchCase: 'Distinguir mayúsculas',
        apply: 'Aplicar',
        clear: 'Borrar',
        and: 'Y',
        or: 'O',
        yes: 'Verdadero',
        no: 'Falso',
        textOps: {
            contains: 'Contiene',
            notContains: 'No contiene',
            equals: 'Es igual a',
            notEqual: 'No es igual a',
            startsWith: 'Empieza por',
            endsWith: 'Termina en',
            blank: 'Está vacío',
            notBlank: 'No está vacío'
        },
        numberOps: {
            eq: '=',
            neq: '≠',
            gt: '>',
            gte: '≥',
            lt: '<',
            lte: '≤',
            between: 'Entre',
            blank: 'Está vacío',
            notBlank: 'No está vacío'
        },
        dateOps: {
            equals: 'Es igual a',
            before: 'Antes de',
            after: 'Después de',
            between: 'Entre',
            blank: 'Está vacío',
            notBlank: 'No está vacío'
        },

        selectRow: (position) => `Seleccionar la fila ${position}`,
        selectAllRows: 'Seleccionar todas las filas',
        rowActions: 'Acciones de la fila',
        dragRow: (position) => `Mover la fila ${position}`,
        expandRow: 'Expandir la fila',
        collapseRow: 'Contraer la fila',

        rowsPerPage: 'Filas por página',
        pageSizeOption: (size) => `${size} / página`,
        pageRange: (from, to, total) =>
            `${from.toLocaleString('es-ES')}–${to.toLocaleString('es-ES')} de ${total.toLocaleString('es-ES')}`,
        totalRows: (total) => `${total.toLocaleString('es-ES')} ${total === 1 ? 'fila' : 'filas'}`,
        filteredRows: (filtered, total) =>
            `${filtered.toLocaleString('es-ES')} de ${total.toLocaleString('es-ES')} filas`,
        selectedRows: (count) =>
            `${count.toLocaleString('es-ES')} ${count === 1 ? 'seleccionada' : 'seleccionadas'}`,
        noData: 'Sin datos',
        retry: 'Reintentar',

        copy: 'Copiar',
        copyWithHeaders: 'Copiar con encabezados',
        exportCsv: 'Exportar a CSV',
        exportAllRows: 'Todas las filas',
        exportLoadedRows: 'Filas cargadas',
        exportSelectedRows: 'Filas seleccionadas',
        clearSelection: 'Quitar la selección'
    },
    announcer: {
        sorted: (column, direction) =>
            `ordenado por ${column} de forma ${direction === 'asc' ? 'ascendente' : 'descendente'}`,
        sortCleared: () => 'orden quitado',
        filtered: (count) => `${count} ${rows(count)} tras el filtrado`,
        page: (page) => `página ${page}`,
        columnResized: (column, width) => `columna ${column} ajustada a ${width} píxeles`,
        columnMoved: (column, position) => `columna ${column} movida a la posición ${position}`,
        columnPinned: (column, side) =>
            side ? `columna ${column} fijada` : `columna ${column} ya no está fijada`,
        groupCollapsed: (group, collapsed) => `${group} ${collapsed ? 'contraído' : 'expandido'}`,
        columnVisibility: (column, hidden) =>
            hidden ? `columna ${column} oculta` : `columna ${column} visible`,
        selected: (count) => `${count} ${selectedRows(count)}`,
        copied: (count) => `${count} ${copiedRows(count)}`,
        rowExpanded: (expanded) => (expanded ? 'fila expandida' : 'fila contraída'),
        rowPinned: (side) => (side ? 'fila fijada' : 'fila ya no está fijada'),
        rowMoved: (position) => `fila movida a la posición ${position}`,
        editInvalid: (message) => message
    }
}
