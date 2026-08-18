# Tổng kết tính năng — @sv5ui/datagrid (bản Community / MIT)

Tài liệu này liệt kê **toàn bộ** những gì bản miễn phí `@sv5ui/datagrid` hiện có,
đối chiếu trực tiếp với mã nguồn trong `src/lib` tại phiên bản **1.1.0**.

Nguyên tắc xuyên suốt của thư viện: **mọi thứ đều opt-in**. Feature nào không đăng ký
thì module đó không bao giờ được import, nên nó không nằm trong bundle của ứng dụng.

---

## Mục lục

1. [Kiến trúc hai tầng](#1-kiến-trúc-hai-tầng)
2. [Cài đặt và yêu cầu môi trường](#2-cài-đặt-và-yêu-cầu-môi-trường)
3. [Kernel headless — `createDataGrid`](#3-kernel-headless--createdatagrid)
4. [Định nghĩa cột (`ColumnDef`)](#4-định-nghĩa-cột-columndef)
5. [Bộ renderer dựng sẵn theo `type`](#5-bộ-renderer-dựng-sẵn-theo-type)
6. [Chín feature module](#6-chín-feature-module)
7. [Tầng component](#7-tầng-component)
8. [Bàn phím và điều hướng](#8-bàn-phím-và-điều-hướng)
9. [Khả năng tiếp cận (a11y)](#9-khả-năng-tiếp-cận-a11y)
10. [Đa ngôn ngữ](#10-đa-ngôn-ngữ)
11. [Theming](#11-theming)
12. [Lưu và khôi phục trạng thái](#12-lưu-và-khôi-phục-trạng-thái)
13. [Server row model](#13-server-row-model)
14. [Hiệu năng và giới hạn đã biết](#14-hiệu-năng-và-giới-hạn-đã-biết)
15. [Điểm mở rộng — tự viết feature](#15-điểm-mở-rộng--tự-viết-feature)
16. [Hợp đồng DOM và icon](#16-hợp-đồng-dom-và-icon)
17. [Bề mặt API public đầy đủ](#17-bề-mặt-api-public-đầy-đủ)
18. [Hạ tầng dự án](#18-hạ-tầng-dự-án)

---

## 1. Kiến trúc hai tầng

Gói này là hai tầng tách rời, mỗi tầng dùng độc lập được.

**Tầng lõi headless.** `createDataGrid` trả về một `GridState`: state bằng Svelte 5 runes
cộng một pipeline dòng dữ liệu dẫn xuất. Không DOM, không style. Có thể dùng nó để tự
render toàn bộ giao diện của riêng bạn (route `/headless` trong playground làm đúng việc đó).

**Tầng component.** `DataGrid` render trọn gói. Các phần `Grid.*` (`Root`, `Viewport`,
`Header`, `Body`, `Toolbar`, `Pagination`, `StatusBar`…) cho phép tự lắp ráp phần chrome.

### Pipeline dòng dữ liệu

Pipeline là một chuỗi phép biến đổi thuần trên `RowNode[]`. Mỗi feature chèn stage của
mình vào một vị trí đã khai báo, nên một stage không cần biết những stage khác có tồn tại
hay không. Thứ tự chuẩn nằm trong hằng số `PIPELINE_ORDER` (được export public):

| Stage      | Order | Ai đăng ký               |
| ---------- | ----- | ------------------------ |
| `filter`   | 100   | `filtering()`            |
| `sort`     | 200   | `sorting()`              |
| `group`    | 300   | dành cho feature mở rộng |
| `flatten`  | 400   | dành cho feature mở rộng |
| `pinSplit` | 500   | `rowPinning()`           |
| `window`   | 900   | `pagination()`           |

`GridState` phơi ra ba mốc của pipeline để feature và UI đọc đúng tập dòng mình cần:

- `grid.sourceNodes` — toàn bộ dòng gốc, chưa lọc.
- `grid.preWindowNodes` — đã lọc và sắp xếp, chưa cắt trang/cắt cửa sổ. Đây là tập mà
  selection và select-all làm việc trên đó.
- `grid.nodes` — tập cuối cùng đang được render.
- `grid.totalRows` — số dòng sau lọc.

---

## 2. Cài đặt và yêu cầu môi trường

```bash
pnpm add @sv5ui/datagrid sv5ui
```

```css
@import 'sv5ui/theme.css';
@import '@sv5ui/datagrid/theme.css';
```

Tailwind 4 bỏ qua `node_modules` khi quét class, nên mỗi file theme tự đăng ký output đã
biên dịch của mình qua `@source`. Không cần khai báo `@source` thủ công.

| Gói          | Phiên bản     |
| ------------ | ------------- |
| SvelteKit    | 2.x           |
| Svelte       | 5.x           |
| Tailwind CSS | 4.x           |
| sv5ui        | 2.5.0 trở lên |

SvelteKit là bắt buộc chứ không tuỳ chọn: sv5ui phân giải `$app/state`, thứ chỉ một ứng
dụng SvelteKit mới cung cấp. `@iconify/svelte` và `tailwindcss` khai báo dạng peer
dependency để grid và sv5ui dùng chung một instance duy nhất của mỗi gói.

Ba entry point được export:

- `@sv5ui/datagrid` — toàn bộ API
- `@sv5ui/datagrid/locales` — mười hai gói ngôn ngữ
- `@sv5ui/datagrid/theme.css` — file theme

Dependency runtime chỉ có bốn gói: `@internationalized/date`, `@standard-schema/spec`,
`tailwind-merge`, `tailwind-variants`.

---

## 3. Kernel headless — `createDataGrid`

### Tuỳ chọn khởi tạo (`DataGridOptions<TRow>`)

| Tuỳ chọn    | Kiểu                                       | Ý nghĩa                                                              |
| ----------- | ------------------------------------------ | -------------------------------------------------------------------- |
| `columns`   | `ColumnDef<TRow>[]`                        | Định nghĩa cột. Bắt buộc.                                            |
| `data`      | `TRow[]`                                   | Dòng dữ liệu (client row model).                                     |
| `getRowId`  | `(row) => string`                          | Id ổn định. Selection, editing và render theo key đều cần. Bắt buộc. |
| `features`  | `GridFeature<TRow>[]`                      | Các module đăng ký. Thứ tự khai báo không quan trọng.                |
| `density`   | `'compact' \| 'standard' \| 'comfortable'` | Chiều cao dòng và padding ô, qua CSS variable. Mặc định `standard`.  |
| `rowModel`  | `'client' \| 'server'`                     | Nơi lọc/sắp/cắt cửa sổ diễn ra. Mặc định `client`.                   |
| `locales`   | `DataGridLocalePack[]`                     | Các ngôn ngữ grid được phép dùng.                                    |
| `locale`    | `string`                                   | Ép một tag BCP-47; bỏ trống thì theo ngôn ngữ của trang.             |
| `labels`    | `DataGridLabelsInput`                      | Ghi đè từng chuỗi hiển thị, bất kỳ tập con nào.                      |
| `announcer` | `Partial<DataGridAnnouncerStrings>`        | Tương tự, cho chuỗi mà live region đọc lên.                          |
| `rowClass`  | `(node) => ClassNameValue`                 | Class theo từng dòng, chạy trên mỗi dòng được render.                |

### Bề mặt `GridState`

- `grid.data` / `grid.density` / `grid.locale` — state ghi được, gán trực tiếp.
- `grid.columns` — `ColumnModel`: `defs`, `leafDefs`, `all`, `visible`, `get(id)`,
  `indexOf(id)`, `trackWidths`, `offsets`, header group đã phân giải.
- `grid.events` — `EventBus` có kiểu (xem bảng sự kiện bên dưới).
- `grid.api` — túi phẳng các method mệnh lệnh, mỗi method optional.
- `grid.state[featureId]` — state thô của từng feature; đường có kiểu là `getX(grid)`.
- `grid.focus` — `FocusModel`: ô đang active, roving tabindex, `moveBy`, `focusCell`, `pageStep`.
- `grid.announcer` — vùng live region lịch sự.
- `grid.expansion` — `ExpansionModel`: `expand`, `collapse`, `toggle`, `expandAll`,
  `collapseAll`, `isExpanded`, `expandedIds`.
- `grid.feature<T>(id)` — lấy state của một feature bất kỳ.
- `grid.nodeById(id)` — phân giải một dòng theo nguồn chưa lọc, vì dòng đã bị lọc vẫn là
  dòng mà một lệnh edit có thể nhắm tới.

### Hai đường vào API

```ts
// Đường có kiểu: thu hẹp về đúng class của feature, generic theo TRow
getSorting(grid)!.setSort([{ columnId: 'name', direction: 'asc' }])

// Đường phẳng: mọi method của mọi feature trong một túi, mỗi cái optional
grid.api.setPage?.(2) // chỉ có khi đã đăng ký pagination()
grid.api.getState() // của kernel, luôn luôn có
```

Chín accessor: `getSorting`, `getFiltering`, `getPagination`, `getSelection`, `getEditing`,
`getColumnOps`, `getRowPinning`, `getRowReorder`, `getVirtualization`.

### Sự kiện (`GridEventMap`)

| Sự kiện                   | Payload                                                        |
| ------------------------- | -------------------------------------------------------------- |
| `sortChanged`             | `{ sort: SortState[] }`                                        |
| `filterChanged`           | `{ filter: FilterModel }`                                      |
| `pageChanged`             | `{ page, pageSize }`                                           |
| `rowCountChanged`         | `{ total }` — tổng phía server đổi, chỉ ở `rowModel: 'server'` |
| `columnResized`           | `{ columnId, width }`                                          |
| `columnMoved`             | `{ columnId, toIndex }`                                        |
| `columnPinned`            | `{ columnId, side }`                                           |
| `columnVisibilityChanged` | `{ columnId, hidden }`                                         |
| `selectionChanged`        | `{ selectedIds }`                                              |
| `rowsCopied`              | `{ count }`                                                    |
| `rowExpanded`             | `{ id, expanded }`                                             |
| `rowPinnedChanged`        | `{ id, side }`                                                 |
| `rowMoved`                | `{ id, from, to }`                                             |
| `cellEdited`              | `{ rowId, columnId, oldValue, newValue }`                      |
| `rowEdited`               | `{ rowId, changes }`                                           |

---

## 4. Định nghĩa cột (`ColumnDef`)

### Nhận dạng và dữ liệu

| Thuộc tính | Mô tả                                                              |
| ---------- | ------------------------------------------------------------------ |
| `id`       | Định danh duy nhất; cũng là key trên row khi không có `accessor`.  |
| `header`   | Nhãn dạng text thuần — đây là accessible name. Mặc định bằng `id`. |
| `accessor` | Trích giá trị từ row. Mặc định `(row) => row[id]`.                 |
| `meta`     | Dữ liệu ứng dụng đi kèm định nghĩa; grid không bao giờ đọc.        |

### Kích thước và bố cục

| Thuộc tính  | Mô tả                                                                   |
| ----------- | ----------------------------------------------------------------------- |
| `width`     | Bề rộng cố định (px), thắng `flex`.                                     |
| `flex`      | Trọng số chia phần rộng còn lại. Mặc định `1` khi không có `width`.     |
| `minWidth`  | Bề rộng tối thiểu. Mặc định `40`.                                       |
| `maxWidth`  | Bề rộng tối đa, áp cho width cố định.                                   |
| `align`     | `left` / `center` / `right` cho cả header lẫn ô. Mặc định `left`.       |
| `hidden`    | Ẩn khỏi render nhưng giữ trong model.                                   |
| `pinned`    | Ghim `left` hoặc `right`.                                               |
| `resizable` | Đặt `false` để khoá bề rộng một cột. Mặc định `true`.                   |
| `children`  | Cột con → biến cột này thành **header group**. Lồng không giới hạn cấp. |

### Render

| Thuộc tính    | Mô tả                                                                       |
| ------------- | --------------------------------------------------------------------------- |
| `type`        | Renderer dựng sẵn (13 loại, xem mục 5). Bỏ qua khi có `cell`.               |
| `typeOptions` | Cấu hình cho `type`.                                                        |
| `cell`        | Snippet render ô tuỳ ý. Luôn thắng `type`.                                  |
| `headerCell`  | Snippet vẽ nhãn header; grid vẫn vẽ control của nó xung quanh.              |
| `cellClass`   | Class theo từng dòng cho cột này. Chạy mỗi ô được render.                   |
| `tooltip`     | `true` = hiện đúng text của ô; hàm = tự quyết định nội dung; `false` = tắt. |
| `colSpan`     | Số cột hợp nhất từ ô hiện tại. Bị kẹp để không vượt ranh giới ghim.         |
| `rowSpan`     | Số dòng hợp nhất. Dừng ở dòng full-width, giữ nguyên khi cuộn qua.          |

**Về `cell` + `type` cùng lúc:** snippet nhận thêm `formatted` — chính là chuỗi mà
renderer dựng sẵn định in ra — nên có thể trang trí quanh nó mà không phải lặp lại
`typeOptions`. `formatted` là `undefined` ở những `type` vẽ widget (`boolean`, `badge`,
`user`, `progress`, `rating`, `link`, `actions`) vì không có chuỗi nào đại diện cho một
widget; nó chỉ được tính khi snippet thực sự đọc tới.

**Tooltip:** dùng `Tooltip` của design system chứ không phải `title` của trình duyệt.
Trigger bọc cả ô nên rê chuột ở đâu trong ô cũng mở, và trigger bị lấy khỏi tab order.
Riêng phần text bị cắt (mà cột không hề khai báo tooltip) thì nhận một `title` thuần, chỉ
đo khi hover — vì bọc mọi ô trong grid là không kham nổi.

**Ô rỗng:** `null`, `undefined` và chuỗi rỗng đều render thành em dash, bất kể `type`.
`typeOptions.emptyText` đổi chuỗi đó cho từng cột (khác với prop `emptyText` trên
`<DataGrid>`, vốn là thông báo cho grid không có dòng nào).

### Sắp xếp

| Thuộc tính  | Mô tả                                                                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `sortable`  | Bật click-để-sắp trên header. Mặc định `false`.                                                                                         |
| `sortFn`    | Comparator riêng; hệ số chiều sắp xếp được áp lên kết quả của nó.                                                                       |
| `sortField` | Trường thực sự dùng để sắp khi khác với thứ đang hiển thị. Ở `rowModel: 'server'` đây là thứ `toSortRequest` gửi đi. `sortFn` thắng nó. |

### Lọc

`filter` nhận một `FilterType` dựng sẵn, một `ColumnFilterDef` (có `predicate` riêng),
hoặc `false` để tắt.

### Chỉnh sửa

| Thuộc tính | Mô tả                                                                |
| ---------- | -------------------------------------------------------------------- |
| `editable` | `boolean` hoặc predicate nhận `{ row, node, value }`.                |
| `editor`   | Một `EditorType` dựng sẵn hoặc `ColumnEditorDef` có options/snippet. |
| `schema`   | Standard-schema kiểm tra khi commit; commit sai bị chặn.             |
| `validate` | Thay thế cho `schema`: trả về chuỗi lỗi, hoặc `null` khi hợp lệ.     |
| `parse`    | Chuyển output của editor thành giá trị lưu, chạy **trước** validate. |

### Header group

Khai báo `children` là có group. Grid tự dựng hàng header group với ô placeholder cho các
cột không thuộc group nào, tính `span`/`start`/`leafIds`, và resize group thì phân bổ đều
xuống các cột lá. Mỗi `HeaderGroupCell` mang cả `pinned` để group nằm đúng bên ghim.

---

## 5. Bộ renderer dựng sẵn theo `type`

Mười ba loại: `text`, `number`, `currency`, `percent`, `date`, `datetime`, `boolean`,
`badge`, `user`, `progress`, `rating`, `link`, `actions`.

`typeOptions` gom mọi cấu hình, mỗi renderer chỉ đọc trường của riêng nó:

| Trường                  | Áp cho                                    | Ý nghĩa                                                                      |
| ----------------------- | ----------------------------------------- | ---------------------------------------------------------------------------- |
| `locale`                | number, currency, percent, date, datetime | Tag BCP-47. Mặc định theo locale của grid/trình duyệt.                       |
| `numberFormat`          | number, currency, percent                 | Đưa thẳng vào `Intl.NumberFormat`.                                           |
| `currency`              | currency                                  | Mã ISO 4217. Mặc định `USD`.                                                 |
| `wholePercent`          | percent                                   | Đặt `true` khi giá trị đã là 0–100 thay vì 0–1.                              |
| `dateFormat`            | date, datetime                            | Đưa thẳng vào `Intl.DateTimeFormat`.                                         |
| `colors`                | badge                                     | Map giá trị → màu, để trạng thái đọc được ngay.                              |
| `fallbackColor`         | badge                                     | Màu cho giá trị không có trong `colors`. Mặc định `surface`.                 |
| `avatar`, `description` | user                                      | Ảnh đại diện và dòng phụ dưới tên.                                           |
| `max`                   | progress, rating                          | Cận trên. Mặc định 100 (progress) và 5 (rating).                             |
| `href`, `target`        | link                                      | Mặc định `href` lấy chính giá trị ô.                                         |
| `actions`               | actions                                   | Trả về danh sách `RowAction` (label, icon, onSelect, disabled, destructive). |
| `trueIcon`, `falseIcon` | boolean                                   | Icon cho hai trạng thái.                                                     |
| `emptyText`             | tất cả                                    | Text cho null/undefined. Mặc định em dash.                                   |

Renderer số và ngày đi qua `Intl`, với formatter được cache theo cấu hình vì renderer chạy
trên mọi ô đang hiển thị.

---

## 6. Chín feature module

### 6.1 `sorting()`

**Tuỳ chọn:** `initial` (danh sách sort ban đầu), `nulls` (`'first'` mặc định — null,
undefined và `''` đều tính là blank), `cycle` (thứ tự header click đi qua, mặc định
`['asc', 'desc', null]`; một cycle không có `null` thì không bao giờ xoá sort).

**Có gì:**

- Multi-sort với badge số thứ tự ưu tiên (chỉ hiện khi có từ 2 cột trở lên).
- Chu trình click header có thể cấu hình.
- Comparator theo kiểu dữ liệu, `sortFn` riêng cho cột, `sortField`.
- Vị trí của giá trị rỗng do `nulls` quyết định.
- `Shift+click` / `Shift+Enter` nối thêm một cột vào sort.
- Tự serialize/hydrate slice của mình vào snapshot.
- Ở `rowModel: 'server'` stage sort đi qua nguyên trạng — sắp lại một trang riêng lẻ sẽ
  làm nó lệch so với phần còn lại của tập dữ liệu.

**API:** `toggleSort(columnId, { append })`, `setSort(sort)`, `directionOf(columnId)`,
`priorityOf(columnId)`, state `sort`.

**Tiện ích:** `toSortRequest(sort, columns, nulls)` dựng payload chuẩn hoá cho server, tự phẳng
hoá header group để lấy đúng `sortField`.

### 6.2 `filtering()`

**Tuỳ chọn:** `initialQuick`, `initialColumns`.

**Có gì:**

- **Quick filter** khớp trên mọi cột đang hiển thị, có debounce (mặc định 200ms) ở tầng UI.
  Khớp cả **chữ đã định dạng** lẫn giá trị thô, nên ô hiện `5%` tìm được bằng `5%` và bằng
  `0.05`. Chuỗi tìm kiếm của mỗi dòng được dựng một lần rồi giữ theo row object.
- **Năm họ filter theo cột:**
    - `text` — `contains`, `notContains`, `equals`, `notEqual`, `startsWith`, `endsWith`,
      `blank`, `notBlank`; có ô tick **Match case**.
    - `number` — `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `between`, `blank`, `notBlank`.
    - `date` — `equals`, `before`, `after`, `between`, `blank`, `notBlank`.
    - `set` — chọn nhiều giá trị rời rạc, có ô tìm trong danh sách giá trị, giá trị phân biệt
      được tính và cache theo cột.
    - `boolean` — Yes/No.
- **Hai điều kiện trên một cột**, nối bằng `and` / `or`. Model chỉ chuyển sang dạng group
  khi điều kiện thứ hai được điền, nên một điều kiện đơn giữ nguyên hình dạng cũ và
  snapshot đời trước vẫn hydrate được.
- Toán tử `blank` / `notBlank` không hiện ô nhập giá trị.
- Predicate tuỳ biến cho từng cột qua `ColumnFilterDef.predicate`.
- **Chip filter** ở toolbar: xoá từng filter, hoặc "Clear all".
- Panel filter được portal ra ngoài, neo theo trigger, đi theo khi grid cuộn ngang, và vẽ
  đè lên header đã ghim.
- Filter model là JSON thuần → serialize vào snapshot.

**API:** `setQuickFilter`, `setColumnFilter`, `clearColumnFilters`, `getFilterModel`,
`applyFilterModel`, `distinctFor(columnId)`, state `quick` / `columnFilters` /
`activeCount` / `filterFor`.

**Tiện ích:** `toFilterRequest(model, quickFields)` chuẩn hoá thành `{ quick, quickFields, columns }` với mỗi cột
luôn là `{ join, conditions[] }`, kể cả khi chỉ có một điều kiện.

### 6.3 `columnOps()`

**Tuỳ chọn:** `resize`, `reorder`, `pin`, `hide` (đều mặc định `true`), `resizeStep`
(bước resize bằng bàn phím, mặc định 16px).

**Có gì:**

- **Resize** bằng kéo tay cầm, bằng bàn phím (`Shift+Arrow`), và **autosize** bằng
  double-click. Autosize đo cả header và chừa chỗ cho các control (sort, filter, menu).
- Resize trên ô header group phân bổ xuống các cột lá.
- **Reorder** bằng kéo thả (có drop indicator) và bằng bàn phím (`Alt+Arrow`).
- **Ghim trái/phải**, offset ghim tính qua CSS custom property từng cột.
- **Ẩn/hiện** qua column menu và qua **Column chooser** trên toolbar.
- **Column menu** mở bằng `Alt+ArrowDown` hoặc nút trên header: sort tăng/giảm, xoá sort,
  ghim trái/phải/bỏ ghim, mở filter, autosize, ẩn cột.
- Mọi thao tác đều phát sự kiện và được announcer đọc lên.

**API:** `setColumnWidth`, `autoSizeColumn`, `autoSizeColumns`, `moveColumn`, `pinColumn`,
`setColumnHidden`, `currentWidth(id)`.

### 6.4 `selection()`

**Tuỳ chọn:** `mode` (`'multiple'` mặc định, `'single'` giữ tối đa một dòng), `checkbox`
(render cột checkbox tổng hợp ghim trái, mặc định `true`), `isRowSelectable` (dòng không
chọn được sẽ bị select-all và range-select bỏ qua, checkbox bị disable).

**Có gì:**

- Cột checkbox tổng hợp (`SELECTION_COLUMN_ID`), checkbox căn giữa, vùng chết quanh
  checkbox vẫn bấm được để toggle.
- Select-all ba trạng thái `none` / `some` / `all`, có trạng thái indeterminate.
- `Shift+click` chọn dải, hoạt động cả từ checkbox lẫn từ ô.
- Selection sống theo id nên vẫn giữ khi filter ẩn rồi hiện lại dòng, và giữ qua các trang.
- **Copy TSV** qua `Ctrl+C`, kèm tuỳ chọn có/không hàng tiêu đề và có/không áp định dạng
  của cột.
- **Export CSV** với: `filename`, `headers`, `allRows` (mọi dòng đã lọc thay vì chỉ phần
  đang chọn), `delimiter` (Excel ở nhiều nước châu Âu cần `';'`), `columns` (chỉ định id
  và thứ tự, cột ẩn cũng xuất được), `formatValue`, `formatted`.
- Context menu chuột phải: Copy, Copy with headers, Export CSV, Clear selection.
- Export menu trên toolbar: xuất mọi dòng đã lọc hoặc chỉ phần đang chọn.
- Số dòng đang chọn hiện ở status bar và được announcer đọc (số ít/số nhiều đúng ngữ pháp).

**API trên `grid.api`:** `selectRow`, `deselectRow`, `toggleRow`, `selectAll`,
`clearSelection`, `isRowSelected`, `getSelectedRows`, `copySelection`, `exportCsv`.

**API trên `getSelection(grid)`** (đường có kiểu, biết `TRow` và nhận `formatValue`):
`select`, `deselect`, `toggle`, `toggleWithModifiers`, `selectRangeTo`, `selectAll`,
`toggleAll`, `clear`, `isSelected`, `copyText`, `copySelection`, `exportCsv`, cùng state
`selectedIds` / `count` / `allState` / `selectableNodes` / `selectedNodes`.

**Hàm thuần được export:** `toCsv`, `toTsv`, `rowsToMatrix`, `pickColumns`, `withHeaderRow` —
dùng được ngoài grid.

### 6.5 `editing()`

**Tuỳ chọn:** `mode` (`'cell'` mặc định, `'row'` mở mọi ô sửa được của một dòng cùng lúc),
`commitOnBlur` (mặc định `true`).

**Mười editor dựng sẵn**, mỗi cái ứng với một component sv5ui cùng tên: `text`, `number`,
`select`, `selectMenu`, `checkbox`, `date`, `time`, `textarea`, `rating`, `tags`.
Ngoài ra có thể truyền snippet editor tuỳ ý qua `ColumnEditorDef.editor`.

**Có gì:**

- Mở edit bằng double-click, `Enter`, `F2`, hoặc **gõ để sửa** — ký tự đã gõ được đưa
  thẳng vào draft, nhưng chỉ với editor nhận text (`text`, `number`, `textarea`); seed một
  select hay rating bằng ký tự sẽ tạo giá trị mà control của nó không biểu diễn được.
- `Enter` commit và xuống dòng dưới, `Tab` commit và sang phải, `Escape` huỷ.
- Editor "sở hữu" phím `Enter` (textarea, tags) thì `Ctrl`/`Cmd+Enter` là đường commit mà
  không rời ô.
- `Escape` đóng popup của editor trước, chỉ lần nhấn thứ hai mới bỏ edit.
- **Validation**: standard-schema (`schema`) hoặc `validate` trả chuỗi lỗi; commit sai bị
  chặn, giá trị cũ được giữ, thông báo lỗi hiện ngay dưới ô (ô ngừng clip khi đang sửa để
  lỗi hiện ra được), và announcer đọc lên. Validator bất đồng bộ được hỗ trợ.
- `parse` chạy trước validate, biến output của editor thành giá trị lưu.
- **Transaction**: `applyEdits(edits)` ghi nhiều ô một lần, mỗi ô qua `parse` + validate;
  một ô sai thì cả lô bị từ chối, một lô thành công là **một** bước undo.
- **Undo/redo** với stack riêng: `Ctrl+Z`, `Ctrl+Shift+Z`, `Ctrl+Y`. Undo phát lại qua
  đúng đường báo cáo của một edit thường, nên phía đồng bộ lên server thấy cả thay đổi bị
  hoàn tác.
- **Dán từ clipboard**: bắt sự kiện `paste` thật (đọc đồng bộ, không cần xin quyền, và
  bao luôn cả dán bằng chuột phải). Text trải sang phải và xuống dưới từ ô đang focus; ô
  rơi vào cột không sửa được hoặc vượt quá dòng cuối thì bị bỏ.
- **Row edit mode**: cả dòng vào chế độ sửa, caret vào field đầu tiên chứ không phải field
  mount cuối, click vào field nào thì trúng field đó, `commitRow()` ghi cả dòng.
- Edit sống sót qua virtualization: cuộn đi rồi cuộn lại vẫn còn.

**API:** `beginEdit`, `startEditing`, `stopEditing`, `getEditingCell`, `startRowEdit`,
`commitRow`, `applyEdits`, `pasteText`, `undo`, `redo`.

### 6.6 `pagination()`

**Tuỳ chọn:** `pageSize`, `page`, `rowCount` (tổng phía server).

**Có gì:**

- Phân trang phía client (stage `window`, order 900).
- Trang bị kẹp khi đọc: dòng có thể biến mất mà không đi qua `setPage`, và một trang vượt
  quá cuối danh sách sẽ để người dùng mắc kẹt ở vùng rỗng.
- Tự về trang 1 khi sort hoặc filter đổi.
- Footer: select số dòng mỗi trang (mặc định `[10, 25, 50, 100]`, một `pageSize` tuỳ ý sẽ
  được chèn vào danh sách và sắp lại), tóm tắt "1–25 of 300", nút chuyển trang.
- Status bar: tổng số dòng, số dòng sau lọc, số dòng đang chọn.
- Chỉ **page size** được lưu vào snapshot, không lưu số trang — khôi phục trang 7 của một
  danh sách mà người dùng đã lọc lại thì chẳng dẫn tới đâu.
- Ở `rowModel: 'server'` stage window đi qua nguyên trạng; `setRowCount` phát
  `rowCountChanged` khi tổng thực sự đổi.

**API:** `setPage`, `setPageSize`, `setRowCount`, state `page` / `pageSize` / `pageCount` /
`total` / `rowCount` / `server`.

### 6.7 `virtualization()`

**Tuỳ chọn:** `rowHeight` (mặc định 40), `getRowHeight` (số px theo dòng, hoặc `'auto'`),
`overscan` (mặc định 5 dòng), `initialRows` (số dòng render trước khi đo viewport — SSR và
frame đầu, mặc định 20), `columns` (`true` hoặc `{ overscanPx }`, mặc định 200px).

**Có gì:**

- **Ảo hoá dòng** vượt một triệu dòng: chỉ cửa sổ đang thấy được render.
- **Ảo hoá cột**: chỉ render cột cắt qua viewport cộng overscan; header và body giữ cùng
  một cửa sổ khi cuộn ngang, và hoạt động đúng cả dưới `dir="rtl"` nơi `scrollLeft` âm.
- **Chiều cao dòng thay đổi** và `'auto'` đo theo nội dung: dòng `'auto'` render ở
  `rowHeight` đúng một frame, được đo, rồi giữ chiều cao đó. Đo được lưu theo row id nên
  sống sót qua sắp xếp lại. Đường này dùng cây Fenwick để tra offset O(log n).
- Vượt quá chiều cao element tối đa của trình duyệt thì dải cuộn được **co tỉ lệ** thay vì
  cắt cụt, nên dòng cuối vẫn tới được.
- Điều hướng bàn phím kéo theo cả dòng và cột chưa render vào tầm nhìn.

**API:** `scrollToRow(index | id)`, `ensureVisible(index | id)`.

### 6.8 `rowPinning()`

**Tuỳ chọn:** `isRowPinned(row) => 'top' | 'bottom' | null`.

**Có gì:**

- Dòng ghim trên/dưới rời khỏi luồng cuộn, **bỏ qua filter và sort**.
- Mỗi khối ghim vẽ đường kẻ ở cạnh hướng vào phần thân.
- Dòng ghim vẫn tới được bằng bàn phím, kể cả khối dưới cùng nằm sau dòng cuối của body.
- Dòng ghim được vẽ trên toàn bộ chiều rộng cuộn, không chỉ phần đang thấy.
- Stage `pinSplit` (order 500).

**API:** `pinRow(id, side)`, `getPinnedRows()`.

### 6.9 `rowReorder()`

**Tuỳ chọn:** `handle` (cột tay cầm, mặc định `true`), `isRowDraggable`, `onReorder`
(callback nhận `{ node, from, to, data }` sau khi `data` đã được sắp lại).

**Có gì:**

- Kéo bằng grip có ghost dòng được nhấc lên, dòng gốc bị làm mờ, drop indicator, và
  **tự cuộn** khi kéo tới mép.
- Nhấn giữ mà gần như không di chuyển được xem là một cú chạm, không phải một lần reorder.
- Reorder bằng bàn phím: `Alt+ArrowUp` / `Alt+ArrowDown`.
- Dòng bị khoá (`isRowDraggable` trả `false`) từ chối tự di chuyển, nhưng dòng khác vẫn
  thả cạnh nó được.
- Cột grip là cột tổng hợp (`ROW_HANDLE_COLUMN_ID`).

**API:** `moveRow(id, toRenderedIndex)`, state `drag`.

> Lưu ý đã ghi trong kiểu: reorder ghi đè `data`, nên một sort đang bật sẽ sắp lại ngay lập
> tức — thứ tự lưu đổi mà màn hình không đổi. Hãy xoá sort trước khi mở grip.

---

## 7. Tầng component

### `<DataGrid>` — dùng nhanh

Props chia hai nhánh loại trừ nhau. **Nhánh tự dựng grid:** truyền `grid` từ
`createDataGrid`. **Nhánh khai báo nhanh:** truyền `data`, `columns`, `getRowId` và các cờ
tiện lợi:

| Prop        | Ý nghĩa                                                           |
| ----------- | ----------------------------------------------------------------- |
| `pageSize`  | Bật phân trang. Bỏ qua khi có `virtual`.                          |
| `selection` | `true` hoặc `SelectionOptions` — bật chọn dòng, copy, export.     |
| `editing`   | `true` hoặc `EditingOptions` — bật sửa inline.                    |
| `virtual`   | `true` hoặc `VirtualizationOptions` — ảo hoá thay cho phân trang. |
| `density`   | Mật độ khởi tạo.                                                  |
| `rowClass`  | Class theo dòng.                                                  |

Props dùng chung cho cả hai nhánh: `toolbar` (bật thanh công cụ mặc định: quick filter,
chip filter, export menu, column chooser, density toggle), `emptyText`, `exportFilename`,
`loading`, `loadingRows`, `error`, `onRetry`, `fullWidthRow`, `persistState`, `class`, `ui`.

**Trạng thái rỗng / đang tải / lỗi:** grid đổ đầy skeleton theo chiều cao viewport chứ
không phải một số dòng cố định; `error` thắng `loading` và thắng cả dòng dữ liệu, kèm nút
Retry khi có `onRetry`.

**Dòng full-width:** dòng có `meta.fullWidth` được render bằng snippet `fullWidthRow` trải
qua mọi cột — dùng cho panel chi tiết hoặc dòng nhóm.

### `Grid.*` — tự lắp ráp

Mười ba phần được export: `Root`, `Viewport`, `Header`, `Body`, `Pagination`, `Toolbar`,
`QuickFilter`, `DensityToggle`, `ColumnChooser`, `ExportMenu`, `ContextMenu`, `FilterChips`,
`StatusBar`.

Ví dụ những prop riêng đáng chú ý: `Grid.QuickFilter` có `placeholder` và `debounce`;
`Grid.Pagination` có `pageSizes`; `Grid.ExportMenu` và `Grid.ContextMenu` có tên file xuất;
`Grid.Body` có `fullWidthRow`, `emptyText`, `loading`, `loadingRows`, `error`, `onRetry`.

---

## 8. Bàn phím và điều hướng

Grid là **một tab stop duy nhất**: các ô dùng roving tabindex, mọi control bên trong đều
trả lời qua đó, nên rời khỏi một grid nghìn dòng chỉ tốn một lần nhấn Tab.

### Điều hướng lõi

| Phím                     | Hành động                         |
| ------------------------ | --------------------------------- |
| `↑` `↓` `←` `→`          | Di chuyển ô đang focus            |
| `Home` / `End`           | Đầu / cuối dòng hiện tại          |
| `Ctrl+Home` / `Ctrl+End` | Ô đầu tiên / ô cuối cùng của grid |
| `PageUp` / `PageDown`    | Nhảy theo trang màn hình          |
| `Enter` (trên header)    | Đổi sort cột                      |
| `Shift+Enter` (header)   | Nối thêm cột vào multi-sort       |

### Treegrid (khi dòng có `meta.expandable`)

| Phím    | Hành động                                             |
| ------- | ----------------------------------------------------- |
| `→`     | Mở dòng đang đóng                                     |
| `←`     | Đóng dòng đang mở, hoặc nhảy lên dòng cha khi đã đóng |
| `Enter` | Bật/tắt mở rộng                                       |

### Theo feature

| Phím                                 | Feature    | Hành động                                                         |
| ------------------------------------ | ---------- | ----------------------------------------------------------------- |
| `Space`                              | selection  | Bật/tắt chọn dòng (không cướp phím khi chính checkbox đang focus) |
| `Shift+Space`                        | selection  | Chọn dải                                                          |
| `Ctrl+A`                             | selection  | Chọn tất cả                                                       |
| `Ctrl+C`                             | selection  | Copy TSV                                                          |
| `Ctrl+V` (sự kiện `paste`)           | editing    | Dán trải từ ô đang focus                                          |
| `Enter` / `F2` / ký tự in được       | editing    | Mở editor                                                         |
| `Escape`                             | editing    | Huỷ (đóng popup trước, lần hai mới bỏ edit)                       |
| `Ctrl+Enter`                         | editing    | Commit mà không rời ô                                             |
| `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` | editing    | Undo / redo                                                       |
| `Shift+←` `Shift+→`                  | columnOps  | Resize cột theo `resizeStep`                                      |
| `Alt+←` `Alt+→`                      | columnOps  | Di chuyển cột                                                     |
| `Alt+↓`                              | columnOps  | Mở column menu                                                    |
| `Alt+↑` `Alt+↓` (trên grip)          | rowReorder | Di chuyển dòng                                                    |

---

## 9. Khả năng tiếp cận (a11y)

- ARIA `grid` dựng bằng `div`, tự chuyển thành `treegrid` khi dòng có phân cấp.
- Một tab stop duy nhất, roving tabindex trên ô.
- `aria-colspan` / `aria-rowspan` trên ô hợp nhất; ô hợp nhất là tab stop duy nhất của khối.
- `aria-level`, `aria-expanded`, `aria-setsize`, `aria-posinset` từ `RowMeta`.
- `aria-selected` trên ô do hook `cellDecoration` đặt.
- **Live region lịch sự** đọc lên: sort, xoá sort, số dòng sau lọc, đổi trang, resize cột,
  di chuyển cột, ghim cột, ẩn/hiện cột, số dòng chọn, số dòng đã copy, mở/đóng dòng, ghim
  dòng, di chuyển dòng, và lỗi validate — tất cả bằng ngôn ngữ đang dùng của grid.
- Bố cục dùng logical property, nên `dir="rtl"` lật gương toàn bộ grid, kể cả cột ghim.
  Cuộn ngang được chuẩn hoá qua `scrollStart` / `setScrollStart` vì trình duyệt báo
  `scrollLeft` âm dưới RTL; thao tác kéo resize cũng đo theo trục inline chứ không theo
  `clientX` thô.
- Mọi route demo đều được khẳng định sạch axe trong CI.

---

## 10. Đa ngôn ngữ

**Mười hai gói ngôn ngữ:** `en-US`, `vi-VN`, `zh-CN`, `ja-JP`, `ko-KR`, `fr-FR`, `de-DE`,
`es-ES`, `pt-BR`, `ru-RU`, `id-ID`, `th-TH`. Chỉ gói nào được import mới vào bundle — vì
thế cố ý không có export "tất cả ngôn ngữ".

```ts
import { enUS, jaJP, viVN } from '@sv5ui/datagrid/locales'
createDataGrid({ columns, data, getRowId, locales: [enUS, viVN, jaJP] })
```

- Grid tự chọn theo ngôn ngữ của trang; `locale` ép một tag cụ thể.
- Gán `grid.locale` đổi ngôn ngữ tại chỗ, giữ nguyên sort, filter và selection trên màn hình.
- Cùng tag đó điều khiển `Intl`, nên cột số, tiền tệ và ngày không tự khai locale sẽ đi
  theo grid và định dạng lại cùng lúc.
- Tag không ai trả lời thì rơi về tiếng Anh; `vi` được `vi-VN` trả lời.
- `labels` và `announcer` ghi đè từng chuỗi lẻ lên trên gói đã chọn.
- Một gói là `{ tag, labels, announcer }` và **nói những gì nó có**; tiếng Anh trả lời cho
  phần còn lại. Nên một gói năm chuỗi vẫn dùng được, và gói viết cho phiên bản cũ vẫn chạy
  khi phiên bản mới thêm chuỗi: chuỗi đó hiện tiếng Anh, không phải ô trống, cũng không phải
  build gãy. Những khoá gói **có** khai thì vẫn được kiểm kiểu.

`DataGridLabels` phủ: toolbar, header và column menu, panel filter (kể cả ba bảng tên toán
tử `textOps` / `numberOps` / `dateOps`), dòng, footer/status bar/overlay, context menu và
export menu. Chuỗi có nội suy được khai báo là hàm để mỗi ngôn ngữ đặt con số vào đúng chỗ
nó cần.

---

## 11. Theming

**58 slot** phủ mọi phần grid vẽ ra: `root`, `toolbar`, `viewport`, `header`, `headerRow`,
`groupRow`, `headerCell`, `groupCell`, `sortButton`, `resizeHandle`, `headerControls`,
`headerControlsPinned`, `menuButton`, `dropIndicator`, `rowHandle`, `rowDropIndicator`,
`rowGhost`, `rowDragging`, `pinnedCell`, `pinnedHeaderCell`, `chooserItem`, `body`,
`bodyOffset`, `row`, `cell`, `cellFocus`, `cellEditing`, `cellRowSpan`, `rowSpanFill`,
`rowSpanFillLast`, `rowSpanEdge`, `rowSpanEdgeStart`, `pinnedCellRaised`,
`pinnedCellSelected`, `empty`, `toggleButton`, `cellEditor`, `cellEditorFlat`,
`cellEditorInRow`, `cellEditorInRowDivider`, `cellEditorPad`, `cellEditorWide`,
`cellEditorField`, `cellError`, `cellEditable`, `tooltipTrigger`, `fullWidthCell`,
`pinnedRow`, `pinnedRowsTop`, `pinnedRowsBottom`, `rowSelected`, `rowEditing`,
`groupBoundary`, `headerDivider`, `filterPanel`, `filterChips`, `statusBar`, `footer`.

Ba tầng ghi đè, theo thứ tự áp dụng:

```ts
// 1. Toàn ứng dụng
defineDataGridConfig({
    defaultVariants: { density: 'compact' },
    slots: { cell: 'font-mono', headerCell: 'uppercase tracking-wide' }
})
```

```svelte
<!-- 2. Từng grid -->
<DataGrid {grid} ui={{ row: 'even:bg-surface-container-lowest' }} />
```

```ts
// 3. Theo dữ liệu
{ id: 'balance', cellClass: ({ value }) => Number(value) < 0 && 'text-error' }
createDataGrid({ rowClass: (node) => node.row.urgent && 'bg-error-container' })
```

`resetDataGridConfig()` khôi phục mặc định (chủ yếu cho test, để state không rò rỉ giữa
các bài).

**Variant:** `align` (`left` / `center` / `right`) và `density`. Density điều khiển
`--dg-row-h` và `--dg-cell-py`: compact 2rem/0.25rem, standard 2.5rem/0.5rem, comfortable
3rem/0.75rem. Toolbar có sẵn nút chuyển density.

Bảng màu lấy từ token của sv5ui (`surface`, `outline-variant`, `primary`, `error`…) nên
grid đổi màu theo theme sáng/tối cùng với phần còn lại của ứng dụng.

---

## 12. Lưu và khôi phục trạng thái

```svelte
<DataGrid {grid} persistState={{ key: 'orders-grid', migrate }} />
```

- Được lưu: **thứ tự cột, bề rộng, ẩn/hiện, ghim, density**, cộng slice của từng feature
  (`sorting` lưu danh sách sort, `filtering` lưu cả model, `pagination` lưu page size).
- Snapshot có `version` (`SNAPSHOT_VERSION = 1`) và là JSON thuần, nên gửi lên server hoặc
  nhét vào URL đều được.
- Cột định danh theo id: id đã biến mất thì bị bỏ, id mới thêm giữ mặc định của nó.
- `migrate` nâng cấp snapshot do phiên bản cũ của ứng dụng ghi ra; thứ nó từ chối sẽ rơi
  về mặc định của cột chứ không áp dụng nửa vời.
- Làm bằng tay: `grid.api.getState()` và `grid.api.setState(snapshot)`.
- Feature tự lưu phần của mình qua `serialize` / `hydrate`; feature mới thêm vào sau khởi
  động sạch.

> Khôi phục đọc `localStorage`, thứ server không đọc được. Hãy render grid có persist ở
> phía client (`export const ssr = false`) để tránh nháy layout mặc định khi tải lại.

---

## 13. Server row model

`rowModel: 'server'` báo cho pipeline biết `data` **đã** là đúng thứ cần hiển thị: các
stage filter, sort và window cho dòng đi qua nguyên trạng. Các feature vẫn được đăng ký,
vì state, UI và sự kiện của chúng chính là thứ một server model lắng nghe.

```ts
const grid = createDataGrid({
    columns,
    data: [],
    getRowId,
    rowModel: 'server',
    features: [sorting(), filtering(), pagination({ pageSize: 25 })]
})

for (const event of ['sortChanged', 'filterChanged', 'pageChanged'] as const) {
    grid.events.on(event, fetchPage)
}

async function fetchPage() {
    const { rows, total } = await api.load({
        filter: toFilterRequest(
            getFiltering(grid)!.model,
            grid.columns.visible.map((column) => column.id)
        ),
        sort: toSortRequest(getSorting(grid)!.sort, grid.columns.defs, getSorting(grid)!.nulls)
    })
    grid.data = rows
    getPagination(grid)!.setRowCount(total)
}
```

- Request mang theo cả những thứ backend không thể tự đoán: `nulls` đi kèm **từng** entry
  sort, ghi **phía mà ô rỗng thật sự rơi vào** chứ không phải chữ mà tuỳ chọn đặt tên (ô rỗng
  được coi là giá trị nhỏ nhất, nên `first` thành `last` khi sort giảm dần, còn `NULLS FIRST`
  của SQL thì không lật); `quickFields` nói rõ quick filter áp lên những cột nào.
- Hai thứ **không** truyền được vì chúng là hàm: `sortFn` của cột và `predicate` riêng của
  filter chỉ chạy ở client, dưới server model chúng không bao giờ được gọi.
- Những chỗ backend phải tự khớp: collation tự nhiên (`Item 2` trước `Item 10`), không phân
  biệt hoa thường trừ khi bật `caseSensitive`, blank gồm cả `''` chứ không chỉ `NULL`,
  `between` đóng hai đầu, điều kiện ngày nghĩa là **ngày lịch theo múi giờ người đọc**, và cột
  `percent` đi trên dây dưới dạng tỷ lệ (`5%` là `0.05`). Bảng đối chiếu đầy đủ nằm ở README;
  `src/tests/server-contract-ops.test.ts` là một backend viết đúng theo bảng đó.
- `toFilterRequest` và `toSortRequest` sinh ra shape truyền tải đã chuẩn hoá, cố ý tách rời
  khỏi model nội bộ để có thể đóng băng trong khi model nội bộ vẫn lớn lên.
- `sortField` của cột mới là thứ đi trên dây, nên một `id` thuần chuyện giao diện không
  buộc phải là thứ cơ sở dữ liệu nhận ra.
- Selection giữ qua các trang; phím mũi tên không tự nhảy trang ở server model; click vào
  ô nào thì ở lại đúng trang đó.
- Ba route demo đã dựng sẵn: `/server` (phân trang), `/server/big` (một trang trong một
  triệu dòng), `/server/infinite` (cuộn vô hạn, nạp thêm khi cửa sổ tới gần cuối mà DOM
  không nhảy).

---

## 14. Hiệu năng và giới hạn đã biết

Đo trên Chromium, viewport 1500×950, 39 cột trộn nhiều renderer (currency, percent, date,
badge, progress, rating, boolean). Route `/stress` là nơi các con số này sinh ra, nên có
thể chạy lại chứ không phải tin suông.

|                      | 100k dòng | 500k dòng | 1M dòng |
| -------------------- | --------- | --------- | ------- |
| Nạp dữ liệu vào grid | 219ms     | 251ms     | 416ms   |
| JS heap              | 100MB     | 315MB     | 472MB   |
| Số node DOM          | 779       | 779       | 779     |
| Sắp xếp              | 81ms      | 67ms      | 67ms    |
| Cuộn, frame trung vị | 19ms      | 23ms      | 35ms    |
| Quick filter         | 0.5s      | 1.1s      | 2.1s    |

Con số đáng đọc nhất là số node DOM: ở một triệu dòng nó vẫn bằng ở một trăm nghìn, vì chỉ
cửa sổ đang thấy được render. Phần heap là dữ liệu của bạn, không phải overhead của grid.

### Giới hạn đã biết (ghi thẳng trong README, không giấu)

- **Cuộn giữ 60fps tới khoảng nửa triệu dòng**, xuống còn khoảng 28fps ở một triệu dòng với
  số cột này. Ít cột hơn thì mốc đó lùi xa hơn.
- **Quick filter là O(dòng × cột hiển thị) trên main thread.** Một triệu dòng × 39 cột là
  39 triệu phép so chuỗi và khoảng hai giây UI bị chặn. Hãy lọc trên ít cột hơn, hoặc dùng
  `rowModel: 'server'`, cho tới khi nó được làm tăng dần.
- **Vượt chiều cao element tối đa của trình duyệt**, dải cuộn được co tỉ lệ thay vì cắt cụt.
  Các engine khác nhau ở ngưỡng này (Chromium 2^25px, một số thấp hơn) nên grid chặn dưới
  mức thấp nhất đang phổ biến.
- **`getRowHeight: 'auto'`** chuyển virtualizer sang cache offset bằng cây Fenwick, tra cứu
  O(log n) thay vì số học thuần của đường chiều cao cố định. Ưu tiên chiều cao cố định khi
  dữ liệu cho phép.
- **Row reorder ghi đè `data`**, nên một sort đang bật sẽ sắp lại ngay. Xoá sort trước.

---

## 15. Điểm mở rộng — tự viết feature

Một feature là một object thuần. Các feature dựng sẵn không dùng gì mà feature của bạn
không dùng được.

| Hook             | Làm gì                                              |
| ---------------- | --------------------------------------------------- |
| `pipelineStage`  | Phép biến đổi thuần, có thứ tự, trên danh sách dòng |
| `createState`    | State phản ứng được, phơi ra ở `grid.state[id]`     |
| `createApi`      | Method mệnh lệnh trộn vào `grid.api`                |
| `keybindings`    | Phím tắt, có `when` để nhường phím cho binding sau  |
| `menuItems`      | Mục cho column menu và context menu                 |
| `cellDecoration` | Class và `aria-selected` theo từng ô                |
| `serialize`      | Slice của feature trong snapshot                    |
| `hydrate`        | Khôi phục thứ `serialize` sinh ra                   |

```ts
const highlightNegative = (): GridFeature<Row> => ({
    id: 'highlight-negative',
    cellDecoration: ({ node, column }) =>
        column.id === 'balance' && node.row.balance < 0 ? { class: 'text-error' } : undefined
})
```

`cellDecoration` chạy trên mọi ô được render nên phải rẻ; một grid không feature nào định
nghĩa nó thì bỏ qua hoàn toàn phần việc này.

Khai báo kiểu cho method của mình bằng cách augment `GridApi`:

```ts
declare module '@sv5ui/datagrid' {
    interface GridApi {
        highlightNegative?: (columnId: string) => void
    }
}
```

---

## 16. Hợp đồng DOM và icon

**DOM contract (public, có semver bảo vệ):**

- Ô body mang `data-dg-cell="rowIndex:colIndex"` với chỉ số **tuyệt đối** trong tập đã lọc
  và đã sắp.
- Dòng mang `data-dg-row-id`.

Dùng chúng để uỷ quyền sự kiện chuột từ một phần tử bọc ngoài
(`event.target.closest('[data-dg-cell]')`) thay vì gắn handler cho từng ô.

**Icon:** mọi icon grid tự vẽ đều được đóng gói sẵn và đăng ký vào store của Iconify, nên
lúc render không cần mạng. Không có gì phải cấu hình — import grid là icon đã đăng ký,
trước khi bất cứ thứ gì trên trang vẽ ra. `registerDataGridIcons()` được export cho trường
hợp duy nhất mà import không phủ được: grid nằm sau một `import()` động, nơi icon của bạn
có thể render trước cả khi module grid được fetch. Hàm này idempotent. `datagridIcons`
cũng được export nếu bạn muốn đọc shape hoặc trộn thêm.

Icon bạn tự đưa vào — `RowAction.icon`, một mục `menuItems`, `typeOptions.trueIcon`, bất cứ
thứ gì trong snippet `cell` — là phần bạn tự bundle.

---

## 17. Bề mặt API public đầy đủ

Mọi thứ export từ gốc gói đều là public và được semver bảo vệ từ 1.0. Bề mặt cố ý nhỏ: đủ
để render một grid, đủ để viết một feature module, và không gì thêm. Barrel liệt kê từng
tên một chứ không re-export cả module, và `src/tests/public-api.test.ts` ghim danh sách đó
lại — nên thêm một ký hiệu vào API cần hai lần sửa có chủ đích.

### Giá trị runtime

| Nhóm      | Export                                                                                                                                                                     |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kernel    | `createDataGrid`, `getCellValue`, `PIPELINE_ORDER`, `SELECTION_COLUMN_ID`, `SNAPSHOT_VERSION`, `ROW_HANDLE_COLUMN_ID`, `isSyntheticColumn`, `defaultLabels`, `mergeLabels` |
| Component | `DataGrid`, `Grid` (13 phần), `registerDataGridIcons`, `datagridIcons`, `defineDataGridConfig`, `resetDataGridConfig`                                                      |
| Feature   | `sorting`, `filtering`, `columnOps`, `selection`, `editing`, `pagination`, `virtualization`, `rowPinning`, `rowReorder`                                                    |
| Accessor  | `getSorting`, `getFiltering`, `getColumnOps`, `getSelection`, `getEditing`, `getPagination`, `getVirtualization`, `getRowPinning`, `getRowReorder`                         |
| Server    | `toSortRequest`, `toFilterRequest`                                                                                                                                         |
| Clipboard | `toCsv`, `toTsv`, `rowsToMatrix`, `pickColumns`, `withHeaderRow`                                                                                                           |
| Locales   | `enUS`, `viVN`, `zhCN`, `jaJP`, `koKR`, `frFR`, `deDE`, `esES`, `ptBR`, `ruRU`, `idID`, `thTH` (từ `/locales`)                                                             |

### Kiểu

`ColumnDef`, `ColumnState`, `ColumnType`, `ColumnTypeOptions`, `ColumnAlign`, `PinnedSide`,
`BadgeColor`, `RowAction`, `HeaderContext`, `HeaderGroupCell`, `DataGridCellContext`,
`DataGridOptions`, `DataGridProps`, `DataGridSlots`, `DataGridUi`, `DataGridConfig`,
`DataGridLabels`, `DataGridLabelsInput`, `DataGridLocalePack`, `DataGridAnnouncerStrings`,
`DataGridFullWidthContext`, `GridState`, `GridApi`, `GridFeature`, `GridSnapshot`,
`GridEventMap`, `PersistStateOptions`, `PipelineStage`, `Keybinding`, `MenuItem`,
`MenuContext`, `CellDecoration`, `CellDecorationContext`, `RowNode`, `RowMeta`, `RowModel`,
`RowPinSide`, `SortState`, `SortDirection`, `SortRequestEntry`, `FilterModel`,
`ColumnFilter`, `ColumnFilterGroup`, `ColumnFilterEntry`, `ColumnFilterDef`, `FilterType`,
`FilterJoin`, `FilterRequest`, `FilterRequestEntry`, `TextFilterOp`, `NumberFilterOp`,
`DateFilterOp`, `PresenceFilterOp`, `SetFilterValue`, `EditorType`, `EditorOption`,
`EditorContext`, `ColumnEditorDef`, `Editable`, `EditTransaction`, `EditMode`,
`SelectionMode`, `SelectAllState`, `CopyOptions`, `ExportCsvOptions`, `ExportFormatter`,
`CellMatrix`, `Density`, `StandardSchemaV1`, cùng bộ `X`/`XOptions` của cả chín feature và
các model chỉ-đọc-được-qua-grid (`ColumnModel`, `FocusModel`, `CellPosition`, `GridSection`,
`ExpansionModel`, `Announcer`, `EventBus`, `EventHandler`, `Virtualizer`, `VirtualRange`,
`ColumnVirtualizer`).

Class mà grid tự dựng chỉ được export dưới dạng **type**. Bạn chạm tới instance qua grid
hoặc qua accessor `getX(grid)`.

Helper nội bộ — phép biến đổi pipeline, biên dịch filter, đường ống undo, toán học tính bề
rộng cột, chuẩn hoá cuộn — cố ý không export và được tự do thay đổi giữa các bản phát hành.

---

## 18. Hạ tầng dự án

**Playground** (`src/routes`) có một trang cho mỗi feature, cộng các route để soát:

| Route                                        | Nội dung                                        |
| -------------------------------------------- | ----------------------------------------------- |
| `/`                                          | Trang chủ                                       |
| `/columns`                                   | Thao tác cột                                    |
| `/rows`                                      | Ghim dòng, dòng full-width                      |
| `/selection`                                 | Chọn dòng, copy, export                         |
| `/filters`                                   | Toàn bộ họ filter                               |
| `/editing`                                   | Sửa inline                                      |
| `/editors`                                   | Từng editor đặt cạnh luật validate của nó       |
| `/renderers`                                 | Mười ba renderer dựng sẵn                       |
| `/virtual`                                   | Ảo hoá                                          |
| `/reorder`                                   | Kéo thả dòng                                    |
| `/spans`                                     | `colSpan` / `rowSpan` chạy cùng cột ghim        |
| `/theming`                                   | Slot, `ui`, `cellClass`, `rowClass`             |
| `/persistence`                               | Snapshot                                        |
| `/i18n`                                      | Đổi ngôn ngữ tại chỗ                            |
| `/export`                                    | Xem đúng byte mà một lần export CSV sinh ra     |
| `/headless`                                  | Lái grid chỉ qua accessor, không dùng component |
| `/server`, `/server/big`, `/server/infinite` | Ba kiểu server row model                        |
| `/qa`                                        | Bật mọi feature trong cùng một grid             |
| `/stress`                                    | Tới một triệu dòng × 39 cột                     |

**Kiểm thử:** 38 file test trong `src/tests` (chạy trên trình duyệt thật qua Playwright +
`vitest-browser-svelte`), cộng test đơn vị đặt cạnh từng module trong `src/lib`. Có test
kiểu (`api-types.test-d.ts`), test ghim bề mặt API (`public-api.test.ts`), test hợp đồng
cho bản Pro (`pro-contract.test.ts`), kiểm tra axe trên demo, và `budgets.test.ts` canh
ngân sách hiệu năng.

**Benchmark:** `src/benchmarks` có `pipeline.bench.ts`, `server-model.bench.ts` và
`budgets.test.ts`. Chạy bằng `pnpm bench`; đo cuộn bằng `pnpm perf:scroll`.

**Script:** `dev`, `build`, `check`, `lint`, `format`, `test`, `bench`, `perf:scroll`,
`generate:icons`, `release:verify`, `release`.

**Giấy phép:** MIT.
