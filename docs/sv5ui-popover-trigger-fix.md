# Sửa a11y cho `Popover` bên sv5ui

> Tài liệu thao tác. Viết từ phía `@sv5ui/datagrid` — nơi phát hiện lỗi — nhưng
> toàn bộ phần "Cách sửa" thực hiện trong repo `ndlabdev/sv5ui`.
> Chép file này sang đó rồi làm theo.

## 1. Lỗi là gì

`Popover` bọc trigger trong một `<span>` của chính nó rồi gán ARIA của bits-ui
lên đó:

```svelte
<!-- src/lib/components/Popover/Popover.svelte -->
<Popover.Trigger>
    {#snippet child({ props })}
        <span {...props} class={[className]}>
            {@render children({ open })}
        </span>
    {/snippet}
</Popover.Trigger>
```

DOM ra:

```html
<span aria-haspopup="dialog" aria-expanded="true" data-state="open">
    <button aria-label="Lọc Email">…</button>
</span>
```

`<span>` không có role widget nên chỉ mang role ngầm `generic`, mà `generic`
**không được phép** nhận `aria-expanded` / `aria-haspopup`.

### Bằng chứng

axe-core báo `aria-allowed-attr` trên đúng phần tử đó:

```
aria-allowed-attr :: <span aria-haspopup="dialog" aria-expanded="true" …>
```

Tái hiện: mở bất kỳ `Popover` nào có `children`, chạy `axe.run(document.body)`.

### Vì sao `DropdownMenu` không dính

Cùng repo, cùng bits-ui, nhưng `DropdownMenu` **trả `props` cho consumer** thay
vì tự bọc:

```svelte
<!-- src/lib/components/DropdownMenu/DropdownMenu.svelte -->
<DropdownMenu.Trigger>
    {#snippet child({ props })}
        {@render children({ open, props })}
    {/snippet}
</DropdownMenu.Trigger>
```

```ts
// src/lib/components/DropdownMenu/dropdown-menu.types.ts
children?: Snippet<[{ open: boolean; props: Record<string, unknown> }]>
```

Consumer gắn `{...props}` lên `<button>` thật → ARIA nằm đúng chỗ, axe sạch.
**Đây là mẫu đúng đã có sẵn trong sv5ui.** Việc cần làm là đưa `Popover` về
cùng mẫu đó.

## 2. Ảnh hưởng

| Ai                                     | Ảnh hưởng                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------ |
| Mọi app dùng `<Popover>` có `children` | Vi phạm `aria-allowed-attr`; trượt kiểm định a11y                                          |
| Screen reader                          | Thông báo trạng thái đóng/mở gắn sai phần tử                                               |
| `@sv5ui/datagrid`                      | Không chuyển được filter panel sang `Popover` (repo đặt "axe sạch" là điều kiện xong việc) |

Trong sv5ui hiện có 4 nơi dùng `Popover`, cần rà khi sửa:

- [ ] `src/lib/components/NavigationMenu/NavigationMenu.svelte` (~dòng 620) — truyền `<span>` làm children
- [ ] `src/routes/popover/+page.svelte` — trang docs
- [ ] `src/routes/calendar/+page.svelte`
- [ ] `src/routes/command/+page.svelte`

## 3. Cách sửa

Có hai phương án. **Khuyến nghị phương án A.**

### Phương án A — thêm prop `triggerAsChild` (không breaking) ✅

Giữ nguyên hành vi mặc định, mở thêm đường đi đúng. Ra được **ngay** ở một bản
minor, không ai phải migrate.

**A1. `popover.types.ts`**

```diff
+    /**
+     * Hand the trigger props to `children` instead of wrapping them in a
+     * `<span>`. The consumer then spreads them onto its own interactive
+     * element, which is where `aria-haspopup` and `aria-expanded` belong — a
+     * bare `<span>` may not carry them. Mirrors how `DropdownMenu` has always
+     * worked.
+     * @default false
+     */
+    triggerAsChild?: boolean
+
     /**
      * Default slot content used as the trigger element.
      * When provided, clicking this element opens the popover.
      */
-    children?: Snippet<[{ open: boolean }]>
+    children?: Snippet<[{ open: boolean; props: Record<string, unknown> }]>
```

Nới kiểu `children` là **an toàn**: consumer cũ chỉ destructure `{ open }` vẫn
biên dịch bình thường.

**A2. `Popover.svelte`**

```diff
     let {
         …
+        triggerAsChild = false,
         ui,
         class: className,
         children,
         content: contentSlot,
         ...restProps
     } = $props()
```

```diff
     {#if children}
         <Popover.Trigger>
             {#snippet child({ props })}
-                <span {...props} class={[className]}>
-                    {@render children({ open })}
-                </span>
+                {#if triggerAsChild}
+                    {@render children({ open, props })}
+                {:else}
+                    <span {...props} class={[className]}>
+                        {@render children({ open, props })}
+                    </span>
+                {/if}
             {/snippet}
         </Popover.Trigger>
     {/if}
```

Lưu ý: khi `triggerAsChild` bật, `className` không còn chỗ để gắn — consumer tự
lo class trên phần tử của mình. Ghi rõ điều này trong doc của prop.

### Phương án B — đổi hẳn hợp đồng như `DropdownMenu` (breaking)

Bỏ luôn `<span>`, `children` **bắt buộc** nhận và gắn `props`. Sạch hơn, một
đường duy nhất, nhưng mọi call site phải sửa → phải lên **3.0**. Chỉ chọn nếu
bạn đang có kế hoạch major và muốn dọn luôn.

## 4. Test cần thêm

Vào `src/lib/components/Popover/Popover.svelte.spec.ts` (đã có sẵn 295 dòng):

- [ ] **Mặc định vẫn bọc span** — chống hồi quy cho hành vi cũ.
- [ ] **`triggerAsChild` không sinh span**, và `aria-haspopup` / `aria-expanded`
      nằm trên phần tử của consumer.
- [ ] **axe sạch** khi `triggerAsChild` + consumer dùng `<button>` thật. Đây là
      test khoá đúng lỗi này lại; thiếu nó thì lần refactor sau dễ tái phát.
- [ ] Mở/đóng, Escape, click ra ngoài vẫn chạy ở cả hai chế độ.

Mẫu wrapper để test có sẵn: `DropdownMenuTriggerTestWrapper.svelte` — làm tương
tự cho Popover.

## 5. Docs

- [ ] `src/routes/popover/+page.svelte`: thêm một ví dụ `triggerAsChild` với
      `<button {...props}>`, kèm một câu giải thích **vì sao** nên dùng nó khi
      trigger là phần tử tương tác.
- [ ] Cân nhắc đổi ví dụ mặc định sang `triggerAsChild` để người mới copy đúng
      mẫu ngay từ đầu.

## 6. Phát hành

- [ ] CHANGELOG mục `### Fixed`: nêu rõ đây là lỗi a11y `aria-allowed-attr`, và
      cách dùng `triggerAsChild` để thoát.
- [ ] Version: prop mới → **2.6.0** (minor). Nếu bạn coi prop chỉ là phương tiện
      của bản vá thì 2.5.1 cũng bảo vệ được, nhưng 2.6.0 an toàn hơn về semver.
- [ ] Theo đúng luồng repo: `dev` → PR → `main` → tag → release → npm publish.

## 7. Sau khi sv5ui ra bản mới — việc bên datagrid

- [ ] `pnpm add -D sv5ui@<bản mới>`, nâng `peerDependencies.sv5ui` lên `^2.6.0`.
- [ ] Chuyển `GridFilterPanel` sang `Popover` (bản migration đã viết và chạy thử
      đạt **17/18** test, chỉ vướng đúng lỗi này):
    - `side="bottom" align="end" sideOffset={4} hideWhenDetached triggerAsChild`
    - Bỏ: `useClickOutside`, `useEscapeKeydown`, `useFocusTrap`, `use:portal`,
      `anchor()`, listener `scroll`/`resize`, hằng `PANEL_WIDTH`
    - `filterPanel` trong `datagrid.variants.ts` rút còn layout thuần
      (`flex w-68 flex-col gap-2 p-3`); nền/ring/shadow/z-index/transition do
      Popover lo
    - `role="dialog"` + `aria-label` đặt trên `<div>` trong snippet `content`,
      vì `PopoverProps` chỉ forward `data-*`
- [ ] Chạy `pnpm test` — 18 test filter là lưới an toàn.
- [ ] Xoá `portal()` trong `src/lib/components/internal/portal.ts` nếu không còn
      ai dùng (`isInPortal` thì giữ, cell editor vẫn cần).

## 8. Không muốn chờ thì làm gì

**Trước hết: bạn không bị chặn.** Filter panel tự viết hiện tại đã đúng, đã sạch
axe, đã qua 18 test — trong đó có 3 bug vừa sửa (bị header đè, không bám khi
cuộn, chọn operator làm đóng panel). Chuyển sang `Popover` là **cải thiện chất
lượng mã**, không phải sửa lỗi chức năng. Hoãn nó không nợ gì người dùng.

Ba lựa chọn, theo thứ tự tôi khuyến nghị:

**1. Ra bản vá sv5ui nhỏ, sớm.** Phương án A là thêm một prop — không ai phải
migrate, không rủi ro hồi quy cho app khác. Đây là loại thay đổi phát hành được
trong ngày, không cần chờ gom đủ tính năng cho bản lớn. "Chờ khá lâu" ở đây là
lựa chọn về nhịp phát hành, không phải ràng buộc kỹ thuật.

**2. Vá tạm ở máy để làm trước, phát hành sau.** Dùng `pnpm patch sv5ui` (hoặc
`pnpm link` sang `~/Dev/sv5ui`) trong repo datagrid để dựng và kiểm thử bản
migration ngay hôm nay. Khi sv5ui ra bản chính thức thì chỉ còn nâng version.

> ⚠️ **Tuyệt đối không publish `@sv5ui/datagrid`** khi nó phụ thuộc vào hành vi
> `Popover` chưa phát hành. Người cài từ npm sẽ kéo về sv5ui bản cũ và trigger
> sẽ không nhận `props` — panel hỏng ngay. Vá tạm chỉ để phát triển.

**3. Bịt nốt hai khoảng cách còn lại của bản tự viết** (~20 dòng), rồi coi
migration là việc dọn dẹp lúc rảnh:

- lật panel lên trên khi hết chỗ bên dưới (collision flip)
- ẩn panel khi trigger cuộn khuất (tương đương `hideWhenDetached`)

Cách này cho kết quả _nhìn thấy được_ ngang `Popover` mà không phụ thuộc lịch
phát hành. Đổi lại vẫn giữ ~55 dòng tự lo định vị — tức là vẫn giữ nguyên lý do
ban đầu khiến ta muốn chuyển.

---

**Tóm lại:** sửa sv5ui là đúng thứ tự, và vì bản vá không breaking nên nó không
đáng để chờ lâu. Trong lúc đó datagrid vẫn chạy tốt và không nợ gì.
