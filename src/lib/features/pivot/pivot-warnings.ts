export const RESHAPES_THE_ROWS: Record<string, string> = {
    grouping: 'gathers the rows the same way pivot does',
    tree: 'draws a hierarchy out of the rows pivot would gather',
    masterDetail: 'opens a panel under a row, and a pivot row is a total, not a row'
}

export const SERVER_REFUSAL =
    'pivot() does not cross a grid on rowModel: "server": every cell would be a total over the ' +
    'blocks this client happens to hold, and a table measured that way looks exactly like a ' +
    'correct one. The server is the only side that can answer it. Register serverRowModel() and ' +
    'the crossing goes out on every request as `pivot`, with the keys coming back as ' +
    '`pivotColumns`.'

export const SERVER_TOTAL_ROW =
    'pivot() draws no totalRow on rowModel: "server": the row would hold a total over the blocks ' +
    'this client happens to hold. Have the server return it as a row of its own, the way it ' +
    'returns every other row, and leave totalRow off.'

export const SERVER_DRILL =
    'pivot() cannot say which rows are behind a cell on rowModel: "server": the client holds the ' +
    'crossed rows the server sent, not the rows they were measured from. Ask the server for them ' +
    'with the same crossing, or cross on the client.'

export const SERVER_VALUES_ON_ROWS =
    'pivot() keeps its measures on the column axis on rowModel: "server". Putting them down the ' +
    'page means one row per measure, and the client only holds the blocks the server sent, so it ' +
    'cannot split a row it did not build. The crossing still draws, with a leaf per measure.'

export const SORT_BY_FIRST_MEASURE =
    'pivot() has its measures on the row axis, where a column header names a crossing rather ' +
    'than a measure, so sorting by one sorts the groups by the first measure. Put the measure ' +
    'you mean first in values, or move the measures back to the column axis to sort by each.'

export const rankOutOfRange = (at: number, many: number): string =>
    `pivot(): keepRows ranks by values[${at}], and there ${many === 1 ? 'is' : 'are'} only ` +
    `${many}. Nothing ranks the rows, so the ones kept are whichever the data listed first. ` +
    'Point measure at one of the measures, or leave it out to rank by the first.'

export const SERVER_ORDER_COLUMNS =
    'pivot() keeps the order the server sent on rowModel: "server". The column axis comes back ' +
    'with the rows, and ranking it means measuring every row behind every key, which the client ' +
    'cannot do over the blocks it happens to hold. Ask the server for the order.'

export const SERVER_KEEP_ROWS =
    'pivot() keeps every row it is given on rowModel: "server". Ranking the gathered rows means ' +
    'measuring all of them, and the client holds only the blocks the server sent, so the ten ' +
    'largest of what it happens to hold are not the ten largest. Ask the server for them.'

export const RUNNING_AGG =
    'pivot() left a runningTotal empty: it runs only a sum or a count of one column, the ' +
    'reductions where adding the cells and measuring the rows give the same answer. A ratio does ' +
    'not add up at all, and anything else would be a guess at what running it should mean.'

export const UNNAMED_AGG =
    'pivot() sent no crossing to the server: a measure reduces with a function or a ' +
    'parameterised aggregation, and only the named ones cross the wire. The grid sends no pivot ' +
    'at all rather than one missing a measure. Name the reduction, or cross on the client.'

export const missing = (fields: string[]): string =>
    `pivot() found no column defined for ${fields.join(', ')}, so there is nothing to cross and ` +
    'the grid is drawing its rows unchanged. A pivot field names a column id, not a row property.'

export const overflowed = (limit: number, measures: number): string =>
    `pivot() refused to draw: the column fields cross into more than ${limit} leaf columns` +
    (measures > 1 ? `, counting ${measures} per crossing for the measures` : '') +
    '. Pick fields with fewer values, narrow the data first, or raise maxColumns and accept the ' +
    'table that comes out.'
