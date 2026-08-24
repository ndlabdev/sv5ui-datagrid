import type { DataGridLocalePack } from '../core/types/index.js'

/** Korean. */
export const koKR: DataGridLocalePack = {
    tag: 'ko-KR',
    labels: {
        search: '검색...',
        activeFilters: '적용된 필터',
        removeFilter: (column) => `${column} 필터 해제`,
        clearAllFilters: '모두 지우기',
        chooseColumns: '열 선택',
        rowDensity: '행 간격',
        densityCompact: '행 간격: 좁게',
        densityStandard: '행 간격: 보통',
        densityComfortable: '행 간격: 넓게',

        columnMenu: (column) => `${column} 열 메뉴`,
        resizeColumn: (column) => `${column} 열 너비 조정`,
        resizeGroup: (group) => `${group} 그룹 너비 조정`,
        sortAscending: '오름차순 정렬',
        sortDescending: '내림차순 정렬',
        clearSort: '정렬 해제',
        pinLeft: '왼쪽에 고정',
        pinRight: '오른쪽에 고정',
        unpin: '고정 해제',
        openFilter: '필터...',
        autosize: '내용에 맞추기',
        hideColumn: '열 숨기기',

        filterColumn: (column) => `${column} 필터`,
        filterOperator: (ordinal) => (ordinal > 1 ? `필터 조건 ${ordinal}` : '필터 조건'),
        filterValue: (ordinal) => (ordinal > 1 ? `필터 값 ${ordinal}` : '필터 값'),
        filterRowValue: (column) => `${column} 필터 값`,
        filterUpperBound: (ordinal) => (ordinal > 1 ? `최댓값 ${ordinal}` : '최댓값'),
        valuePlaceholder: '값...',
        upperBoundPlaceholder: '까지...',
        searchValues: '값 검색...',
        blankValue: '(비어 있음)',
        anyValue: '(전체)',
        combineConditions: '조건 결합',
        addCondition: '조건 추가',
        removeCondition: '조건 삭제',
        matchCase: '대소문자 구분',
        apply: '적용',
        clear: '지우기',
        and: '그리고',
        or: '또는',
        yes: '예',
        no: '아니요',
        textOps: {
            contains: '포함',
            notContains: '포함하지 않음',
            equals: '같음',
            notEqual: '같지 않음',
            startsWith: '다음으로 시작',
            endsWith: '다음으로 끝남',
            blank: '비어 있음',
            notBlank: '비어 있지 않음'
        },
        numberOps: {
            eq: '=',
            neq: '≠',
            gt: '>',
            gte: '≥',
            lt: '<',
            lte: '≤',
            between: '사이',
            blank: '비어 있음',
            notBlank: '비어 있지 않음'
        },
        dateOps: {
            equals: '같은 날짜',
            before: '이전',
            after: '이후',
            between: '사이',
            blank: '비어 있음',
            notBlank: '비어 있지 않음'
        },

        selectRow: (position) => `${position}행 선택`,
        selectAllRows: '모든 행 선택',
        rowActions: '행 작업',
        dragRow: (position) => `${position}행 이동`,
        expandRow: '행 펼치기',
        collapseRow: '행 접기',

        rowsPerPage: '페이지당 행 수',
        pageSizeOption: (size) => `${size}개씩`,
        pageRange: (from, to, total) =>
            `${total.toLocaleString('ko-KR')}개 중 ${from.toLocaleString('ko-KR')}–${to.toLocaleString('ko-KR')}`,
        totalRows: (total) => `${total.toLocaleString('ko-KR')}행`,
        filteredRows: (filtered, total) =>
            `${total.toLocaleString('ko-KR')}행 중 ${filtered.toLocaleString('ko-KR')}행`,
        selectedRows: (count) => `${count.toLocaleString('ko-KR')}개 선택됨`,
        noData: '데이터가 없습니다',
        retry: '다시 시도',

        copy: '복사',
        copyWithHeaders: '머리글 포함 복사',
        exportCsv: 'CSV 내보내기',
        exportAllRows: '모든 행',
        exportLoadedRows: '불러온 행',
        exportSelectedRows: '선택한 행',
        clearSelection: '선택 해제'
    },
    announcer: {
        sorted: (column, direction) =>
            `${column} 기준 ${direction === 'asc' ? '오름차순' : '내림차순'}으로 정렬했습니다`,
        sortCleared: () => '정렬을 해제했습니다',
        filtered: (count) => `${count}행으로 걸렀습니다`,
        page: (page) => `${page}페이지`,
        columnResized: (column, width) => `${column} 열 너비를 ${width}픽셀로 조정했습니다`,
        columnMoved: (column, position) => `${column} 열을 ${position}번째로 옮겼습니다`,
        columnPinned: (column, side) =>
            side ? `${column} 열을 고정했습니다` : `${column} 열 고정을 해제했습니다`,
        columnVisibility: (column, hidden) =>
            hidden ? `${column} 열을 숨겼습니다` : `${column} 열을 표시했습니다`,
        selected: (count) => `${count}행을 선택했습니다`,
        copied: (count) => `${count}행을 복사했습니다`,
        rowExpanded: (expanded) => (expanded ? '행을 펼쳤습니다' : '행을 접었습니다'),
        rowPinned: (side) => (side ? '행을 고정했습니다' : '행 고정을 해제했습니다'),
        rowMoved: (position) => `행을 ${position}번째로 옮겼습니다`,
        editInvalid: (message) => message
    }
}
