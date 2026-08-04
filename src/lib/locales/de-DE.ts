import type { DataGridLocalePack } from '../core/types/index.js'

/** German. */
export const deDE: DataGridLocalePack = {
    tag: 'de-DE',
    labels: {
        search: 'Suchen...',
        activeFilters: 'Aktive Filter',
        removeFilter: (column) => `Filter ${column} entfernen`,
        clearAllFilters: 'Alle löschen',
        chooseColumns: 'Spalten auswählen',
        rowDensity: 'Zeilenhöhe',
        densityCompact: 'Kompakte Zeilenhöhe',
        densityStandard: 'Standard-Zeilenhöhe',
        densityComfortable: 'Große Zeilenhöhe',

        columnMenu: (column) => `Spaltenmenü ${column}`,
        resizeColumn: (column) => `Breite der Spalte ${column} ändern`,
        resizeGroup: (group) => `Breite der Gruppe ${group} ändern`,
        sortAscending: 'Aufsteigend sortieren',
        sortDescending: 'Absteigend sortieren',
        clearSort: 'Sortierung aufheben',
        pinLeft: 'Links anheften',
        pinRight: 'Rechts anheften',
        unpin: 'Lösen',
        openFilter: 'Filtern…',
        autosize: 'An Inhalt anpassen',
        hideColumn: 'Spalte ausblenden',

        filterColumn: (column) => `${column} filtern`,
        filterOperator: (ordinal) => (ordinal > 1 ? `Filteroperator ${ordinal}` : 'Filteroperator'),
        filterValue: (ordinal) => (ordinal > 1 ? `Filterwert ${ordinal}` : 'Filterwert'),
        filterUpperBound: (ordinal) => (ordinal > 1 ? `Obergrenze ${ordinal}` : 'Obergrenze'),
        valuePlaceholder: 'Wert...',
        upperBoundPlaceholder: 'Bis...',
        searchValues: 'Werte suchen...',
        blankValue: '(leer)',
        combineConditions: 'Bedingungen verknüpfen',
        addCondition: 'Bedingung hinzufügen',
        removeCondition: 'Bedingung entfernen',
        matchCase: 'Groß-/Kleinschreibung beachten',
        apply: 'Anwenden',
        clear: 'Löschen',
        and: 'Und',
        or: 'Oder',
        yes: 'Wahr',
        no: 'Falsch',
        textOps: {
            contains: 'Enthält',
            notContains: 'Enthält nicht',
            equals: 'Ist gleich',
            notEqual: 'Ist ungleich',
            startsWith: 'Beginnt mit',
            endsWith: 'Endet mit',
            blank: 'Ist leer',
            notBlank: 'Ist nicht leer'
        },
        numberOps: {
            eq: '=',
            neq: '≠',
            gt: '>',
            gte: '≥',
            lt: '<',
            lte: '≤',
            between: 'Zwischen',
            blank: 'Ist leer',
            notBlank: 'Ist nicht leer'
        },
        dateOps: {
            equals: 'Ist gleich',
            before: 'Vor',
            after: 'Nach',
            between: 'Zwischen',
            blank: 'Ist leer',
            notBlank: 'Ist nicht leer'
        },

        selectRow: (position) => `Zeile ${position} auswählen`,
        selectAllRows: 'Alle Zeilen auswählen',
        rowActions: 'Zeilenaktionen',
        dragRow: (position) => `Zeile ${position} verschieben`,
        expandRow: 'Zeile aufklappen',
        collapseRow: 'Zeile zuklappen',

        rowsPerPage: 'Zeilen pro Seite',
        pageSizeOption: (size) => `${size} / Seite`,
        pageRange: (from, to, total) =>
            `${from.toLocaleString('de-DE')}–${to.toLocaleString('de-DE')} von ${total.toLocaleString('de-DE')}`,
        totalRows: (total) =>
            `${total.toLocaleString('de-DE')} ${total === 1 ? 'Zeile' : 'Zeilen'}`,
        filteredRows: (filtered, total) =>
            `${filtered.toLocaleString('de-DE')} von ${total.toLocaleString('de-DE')} Zeilen`,
        selectedRows: (count) => `${count.toLocaleString('de-DE')} ausgewählt`,
        noData: 'Keine Daten',
        retry: 'Erneut versuchen',

        copy: 'Kopieren',
        copyWithHeaders: 'Mit Überschriften kopieren',
        exportCsv: 'CSV exportieren',
        clearSelection: 'Auswahl aufheben'
    },
    announcer: {
        sorted: (column, direction) =>
            `nach ${column} ${direction === 'asc' ? 'aufsteigend' : 'absteigend'} sortiert`,
        sortCleared: () => 'Sortierung aufgehoben',
        filtered: (count) => `${count} Zeilen nach dem Filtern`,
        page: (page) => `Seite ${page}`,
        columnResized: (column, width) => `Spalte ${column} auf ${width} Pixel geändert`,
        columnMoved: (column, position) => `Spalte ${column} an Position ${position} verschoben`,
        columnPinned: (column, side) =>
            side ? `Spalte ${column} angeheftet` : `Spalte ${column} gelöst`,
        columnVisibility: (column, hidden) =>
            hidden ? `Spalte ${column} ausgeblendet` : `Spalte ${column} eingeblendet`,
        selected: (count) => `${count} Zeilen ausgewählt`,
        copied: (count) => `${count} Zeilen kopiert`,
        rowExpanded: (expanded) => (expanded ? 'Zeile aufgeklappt' : 'Zeile zugeklappt'),
        rowPinned: (side) => (side ? 'Zeile angeheftet' : 'Zeile gelöst'),
        rowMoved: (position) => `Zeile an Position ${position} verschoben`,
        editInvalid: (message) => message
    }
}
