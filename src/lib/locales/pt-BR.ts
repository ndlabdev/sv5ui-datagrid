import type { DataGridLocalePack } from '../core/types/index.js'
import { plural } from '../core/interaction/plural.js'

const rows = plural('pt-BR', { one: 'linha', other: 'linhas' })
// O particípio concorda em número, não apenas o substantivo.
const selectedRows = plural('pt-BR', { one: 'linha selecionada', other: 'linhas selecionadas' })
const copiedRows = plural('pt-BR', { one: 'linha copiada', other: 'linhas copiadas' })

/** Brazilian Portuguese. */
export const ptBR: DataGridLocalePack = {
    tag: 'pt-BR',
    labels: {
        search: 'Pesquisar...',
        activeFilters: 'Filtros ativos',
        removeFilter: (column) => `Remover o filtro ${column}`,
        clearAllFilters: 'Limpar tudo',
        chooseColumns: 'Escolher colunas',
        rowDensity: 'Densidade das linhas',
        densityCompact: 'Densidade compacta',
        densityStandard: 'Densidade padrão',
        densityComfortable: 'Densidade ampla',

        columnMenu: (column) => `Menu da coluna ${column}`,
        resizeColumn: (column) => `Redimensionar a coluna ${column}`,
        resizeGroup: (group) => `Redimensionar o grupo ${group}`,
        sortAscending: 'Classificar em ordem crescente',
        sortDescending: 'Classificar em ordem decrescente',
        clearSort: 'Remover a classificação',
        pinLeft: 'Fixar à esquerda',
        pinRight: 'Fixar à direita',
        unpin: 'Desafixar',
        openFilter: 'Filtrar…',
        autosize: 'Ajustar ao conteúdo',
        hideColumn: 'Ocultar a coluna',

        filterColumn: (column) => `Filtrar ${column}`,
        filterOperator: (ordinal) =>
            ordinal > 1 ? `Operador do filtro ${ordinal}` : 'Operador do filtro',
        filterValue: (ordinal) => (ordinal > 1 ? `Valor do filtro ${ordinal}` : 'Valor do filtro'),
        filterRowValue: (column) => `Valor do filtro ${column}`,
        filterUpperBound: (ordinal) =>
            ordinal > 1 ? `Limite superior ${ordinal}` : 'Limite superior',
        valuePlaceholder: 'Valor...',
        upperBoundPlaceholder: 'Até...',
        searchValues: 'Pesquisar valores...',
        blankValue: '(vazio)',
        anyValue: '(qualquer)',
        combineConditions: 'Combinar condições',
        addCondition: 'Adicionar condição',
        removeCondition: 'Remover condição',
        matchCase: 'Diferenciar maiúsculas',
        apply: 'Aplicar',
        clear: 'Limpar',
        and: 'E',
        or: 'Ou',
        yes: 'Verdadeiro',
        no: 'Falso',
        textOps: {
            contains: 'Contém',
            notContains: 'Não contém',
            equals: 'É igual a',
            notEqual: 'É diferente de',
            startsWith: 'Começa com',
            endsWith: 'Termina com',
            blank: 'Está vazio',
            notBlank: 'Não está vazio'
        },
        numberOps: {
            eq: '=',
            neq: '≠',
            gt: '>',
            gte: '≥',
            lt: '<',
            lte: '≤',
            between: 'Entre',
            blank: 'Está vazio',
            notBlank: 'Não está vazio'
        },
        dateOps: {
            equals: 'É igual a',
            before: 'Antes de',
            after: 'Depois de',
            between: 'Entre',
            blank: 'Está vazio',
            notBlank: 'Não está vazio'
        },

        selectRow: (position) => `Selecionar a linha ${position}`,
        selectAllRows: 'Selecionar todas as linhas',
        rowActions: 'Ações da linha',
        dragRow: (position) => `Mover a linha ${position}`,
        expandRow: 'Expandir a linha',
        collapseRow: 'Recolher a linha',

        rowsPerPage: 'Linhas por página',
        pageSizeOption: (size) => `${size} / página`,
        pageRange: (from, to, total) =>
            `${from.toLocaleString('pt-BR')}–${to.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')}`,
        totalRows: (total) =>
            `${total.toLocaleString('pt-BR')} ${total === 1 ? 'linha' : 'linhas'}`,
        filteredRows: (filtered, total) =>
            `${filtered.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')} linhas`,
        selectedRows: (count) =>
            `${count.toLocaleString('pt-BR')} ${count === 1 ? 'selecionada' : 'selecionadas'}`,
        noData: 'Sem dados',
        retry: 'Tentar novamente',

        copy: 'Copiar',
        copyWithHeaders: 'Copiar com cabeçalhos',
        exportCsv: 'Exportar CSV',
        exportAllRows: 'Todas as linhas',
        exportLoadedRows: 'Linhas carregadas',
        exportSelectedRows: 'Linhas selecionadas',
        clearSelection: 'Limpar a seleção'
    },
    announcer: {
        sorted: (column, direction) =>
            `classificado por ${column} em ordem ${direction === 'asc' ? 'crescente' : 'decrescente'}`,
        sortCleared: () => 'classificação removida',
        filtered: (count) => `${count} ${rows(count)} após o filtro`,
        page: (page) => `página ${page}`,
        columnResized: (column, width) => `coluna ${column} redimensionada para ${width} pixels`,
        columnMoved: (column, position) => `coluna ${column} movida para a posição ${position}`,
        columnPinned: (column, side) =>
            side ? `coluna ${column} fixada` : `coluna ${column} desafixada`,
        columnVisibility: (column, hidden) =>
            hidden ? `coluna ${column} oculta` : `coluna ${column} visível`,
        selected: (count) => `${count} ${selectedRows(count)}`,
        copied: (count) => `${count} ${copiedRows(count)}`,
        rowExpanded: (expanded) => (expanded ? 'linha expandida' : 'linha recolhida'),
        rowPinned: (side) => (side ? 'linha fixada' : 'linha desafixada'),
        rowMoved: (position) => `linha movida para a posição ${position}`,
        editInvalid: (message) => message
    }
}
