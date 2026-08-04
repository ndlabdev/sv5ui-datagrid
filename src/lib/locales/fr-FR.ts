import type { DataGridLocalePack } from '../core/types/index.js'

/** French. */
export const frFR: DataGridLocalePack = {
    tag: 'fr-FR',
    labels: {
        search: 'Rechercher...',
        activeFilters: 'Filtres actifs',
        removeFilter: (column) => `Supprimer le filtre ${column}`,
        clearAllFilters: 'Tout effacer',
        chooseColumns: 'Choisir les colonnes',
        rowDensity: 'Densité des lignes',
        densityCompact: 'Densité compacte',
        densityStandard: 'Densité standard',
        densityComfortable: 'Densité confortable',

        columnMenu: (column) => `Menu de la colonne ${column}`,
        resizeColumn: (column) => `Redimensionner la colonne ${column}`,
        resizeGroup: (group) => `Redimensionner le groupe ${group}`,
        sortAscending: 'Trier par ordre croissant',
        sortDescending: 'Trier par ordre décroissant',
        clearSort: 'Annuler le tri',
        pinLeft: 'Épingler à gauche',
        pinRight: 'Épingler à droite',
        unpin: 'Détacher',
        openFilter: 'Filtrer…',
        autosize: 'Ajuster au contenu',
        hideColumn: 'Masquer la colonne',

        filterColumn: (column) => `Filtrer ${column}`,
        filterOperator: (ordinal) =>
            ordinal > 1 ? `Opérateur de filtre ${ordinal}` : 'Opérateur de filtre',
        filterValue: (ordinal) =>
            ordinal > 1 ? `Valeur du filtre ${ordinal}` : 'Valeur du filtre',
        filterUpperBound: (ordinal) =>
            ordinal > 1 ? `Borne supérieure ${ordinal}` : 'Borne supérieure',
        valuePlaceholder: 'Valeur...',
        upperBoundPlaceholder: 'Jusqu’à...',
        searchValues: 'Rechercher des valeurs...',
        blankValue: '(vide)',
        combineConditions: 'Combiner les conditions',
        addCondition: 'Ajouter une condition',
        removeCondition: 'Supprimer la condition',
        matchCase: 'Respecter la casse',
        apply: 'Appliquer',
        clear: 'Effacer',
        and: 'Et',
        or: 'Ou',
        yes: 'Vrai',
        no: 'Faux',
        textOps: {
            contains: 'Contient',
            notContains: 'Ne contient pas',
            equals: 'Égal à',
            notEqual: 'Différent de',
            startsWith: 'Commence par',
            endsWith: 'Se termine par',
            blank: 'Est vide',
            notBlank: 'N’est pas vide'
        },
        numberOps: {
            eq: '=',
            neq: '≠',
            gt: '>',
            gte: '≥',
            lt: '<',
            lte: '≤',
            between: 'Entre',
            blank: 'Est vide',
            notBlank: 'N’est pas vide'
        },
        dateOps: {
            equals: 'Égal à',
            before: 'Avant',
            after: 'Après',
            between: 'Entre',
            blank: 'Est vide',
            notBlank: 'N’est pas vide'
        },

        selectRow: (position) => `Sélectionner la ligne ${position}`,
        selectAllRows: 'Sélectionner toutes les lignes',
        rowActions: 'Actions de la ligne',
        dragRow: (position) => `Déplacer la ligne ${position}`,
        expandRow: 'Développer la ligne',
        collapseRow: 'Réduire la ligne',

        rowsPerPage: 'Lignes par page',
        pageSizeOption: (size) => `${size} / page`,
        pageRange: (from, to, total) =>
            `${from.toLocaleString('fr-FR')}–${to.toLocaleString('fr-FR')} sur ${total.toLocaleString('fr-FR')}`,
        totalRows: (total) => `${total.toLocaleString('fr-FR')} ${total > 1 ? 'lignes' : 'ligne'}`,
        filteredRows: (filtered, total) =>
            `${filtered.toLocaleString('fr-FR')} sur ${total.toLocaleString('fr-FR')} ${total > 1 ? 'lignes' : 'ligne'}`,
        selectedRows: (count) =>
            `${count.toLocaleString('fr-FR')} ${count > 1 ? 'sélectionnées' : 'sélectionnée'}`,
        noData: 'Aucune donnée',
        retry: 'Réessayer',

        copy: 'Copier',
        copyWithHeaders: 'Copier avec les en-têtes',
        exportCsv: 'Exporter en CSV',
        exportAllRows: 'Toutes les lignes',
        exportSelectedRows: 'Lignes sélectionnées',
        clearSelection: 'Annuler la sélection'
    },
    announcer: {
        sorted: (column, direction) =>
            `trié par ${column} par ordre ${direction === 'asc' ? 'croissant' : 'décroissant'}`,
        sortCleared: () => 'tri annulé',
        filtered: (count) => `${count} lignes après filtrage`,
        page: (page) => `page ${page}`,
        columnResized: (column, width) => `colonne ${column} redimensionnée à ${width} pixels`,
        columnMoved: (column, position) => `colonne ${column} déplacée en position ${position}`,
        columnPinned: (column, side) =>
            side ? `colonne ${column} épinglée` : `colonne ${column} détachée`,
        columnVisibility: (column, hidden) =>
            hidden ? `colonne ${column} masquée` : `colonne ${column} affichée`,
        selected: (count) => `${count} lignes sélectionnées`,
        copied: (count) => `${count} lignes copiées`,
        rowExpanded: (expanded) => (expanded ? 'ligne développée' : 'ligne réduite'),
        rowPinned: (side) => (side ? 'ligne épinglée' : 'ligne détachée'),
        rowMoved: (position) => `ligne déplacée en position ${position}`,
        editInvalid: (message) => message
    }
}
