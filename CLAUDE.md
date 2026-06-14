# CLAUDE.md — Citation & PDF Viewer Notes

## Citation Flow

Citations are parsed from the AI answer text in `src/app/chat/page.tsx` via `buildInlineCitations()`.

Two formats supported:
- New: `[filename.pdf, Page 12]` → superscript button `[1]`
- Old: `[Source: file, Page/Sheet: X, Quote: "..."]` → same

Each citation stores `{ source, page, quote }` in an `InlineCit` array. Inline `[N]` buttons in the markdown renderer call `onOpenPdf({ url, page, filename })` on click, which sets `pdfPanel` state in `ChatPage` and opens the side panel.

`PdfTarget` interface: `{ url: string; page: number; filename: string }`.

---

## Evolution of PdfPanel — What We Tried and Why We Changed

### Phase 1 — react-pdf (wojtekmaj) v7, single page
Original implementation: `<Document>` + `<Page pageNumber={currentPage}>` with prev/next buttons.

**Problems:**
- Only showed one page at a time, no scrollable view.
- Prev/next navigation felt clunky for a citation panel.

---

### Phase 2 — react-pdf, all pages rendered at once
Switched to rendering all pages in a scrollable column, using `pageRefs` + `scrollIntoView` to jump to the cited page. Applied CSS class `pdf-page-highlight` on the cited page div for a green overlay.

**Problems encountered and fixes:**
- **Canvas goes blank/black when scrolling** — browser caps active canvas contexts at ~16. Documented in [wojtekmaj/react-pdf#1020](https://github.com/wojtekmaj/react-pdf/issues/1020). Tried fixing with IntersectionObserver windowing (only render pages within ±3 of viewport), but it was fragile:
  - Single `pageHeight` estimate breaks PDFs with mixed page sizes → scroll jumps.
  - `scrollIntoView` races against async canvas rendering.
  - Observer setup/teardown on every `numPages` change was expensive.
- **Highlight animation not firing** — CSS `<style>` tag inside a Next.js client component was unreliable. Fixed by moving animation to `globals.css`.
- **Class name mismatch** — component used `pdf-highlight-page`, globals.css defined `pdf-page-highlight`. Fixed by aligning names.
- **Zoom effect on highlighted page** — old animation used `box-shadow` size changes (0→5px) which looked like zoom. Fixed by switching to a `::after` full-page overlay with `opacity` fade only.
- **Every alternate page layout broken** — adding `style={{ position: "relative" }}` inline on page wrapper divs changed the positioning context of react-pdf's internally absolutely-positioned text/annotation layers. **Never add `position: relative` as an inline style on page wrapper divs.**
- **`::after` only showing on corners** — needed `position: relative` on the wrapper AND `inset: 0` on the `::after` to cover the full page.
- **Highlight duration** — increased from 2s → 7s per user request.

---

### Phase 3 — Switched to @react-pdf-viewer/core v3.12

**Why switched:** react-pdf gives raw components — you own virtualization, navigation, everything. Too many edge cases. `@react-pdf-viewer/core` ships virtualization by default.

**Installed:**
```
@react-pdf-viewer/core@3.12.0
@react-pdf-viewer/page-navigation@3.12.0
```
Compatible with existing `pdfjs-dist@3.11.174` (peer dep: `^3.0.279`).

**Issues encountered during migration:**

#### Horizontal scroll + content cut off
`defaultScale={1}` = 100% zoom = ~595px wide for A4 — wider than the 360px panel.
**Fix:** `defaultScale={SpecialZoomLevel.PageWidth}` — PDF scales to fit container width.

#### Page split into two / layers misaligned
Wrapping `renderPage` output in `<div style={{ position: "relative" }}>` broke layer stacking. The canvas, textLayer, and annotationLayer are all `position: absolute` and expect to be positioned relative to the viewer's own page container, not an extra wrapper div.
**Fix:** Removed the wrapper div. `renderPage` returns a fragment `<>` directly.

#### `pageNavigationPlugin()` crashes inside `useMemo`
Error: *"Do not call Hooks inside useMemo"* — the plugin factory calls React hooks internally.
**Fix:** Call `pageNavigationPlugin()` at component top level (not in `useMemo`).

#### Plugin recreated every render → `jumpToPage` not working
Calling `pageNavigationPlugin()` at top level without memoization creates a new object every render. Passing `[pageNavPlugin]` as the `plugins` prop (new reference each render) caused the Viewer to reset to page 1 on every re-render, fighting `jumpToPage`.

**Attempted fix — `useRef` lazy init:**
```tsx
const pluginRef = useRef(null);
if (!pluginRef.current) pluginRef.current = pageNavigationPlugin();
```
This conditionally calls `pageNavigationPlugin()` — violates Rules of Hooks because hook call count differs between renders.
**Error:** *"React has detected a change in the order of Hooks"* + `Cannot read properties of undefined (reading 'destroy')` from nulling the ref while Viewer was mounted.

#### Final fix — drop pageNavigationPlugin entirely
`pageNavigationPlugin()` cannot be safely memoized, ref-cached, or called conditionally because it uses hooks internally. Any attempt to stabilize it violates Rules of Hooks.

**Solution:** Use `key={url::page}` + `initialPage={page - 1}` instead.
- `key` forces Viewer to remount when citation changes → `initialPage` opens at correct page.
- `Worker` sits **outside** the `key` → pdfjs worker thread stays alive → parsed PDF document stays cached in memory.
- `onDocumentLoad` callback fires after the new page renders → sets `highlightedPage` → triggers overlay.
- `pageRef` (a `useRef`) captures the latest `page` value so the `onDocumentLoad` closure always reads the correct page even if props changed before the callback fired.

**Performance for large PDFs (1000 pages):**
- Worker caches parsed PDF — remounting Viewer does NOT re-download or re-parse.
- `@react-pdf-viewer/core` virtualizes the page list — only ~3-5 visible pages are rendered at a time.
- Remount cost = reconstructing ~5 page canvases. Fast.

---

## Final PdfPanel Architecture (`src/components/PdfPanel.tsx`)

```
User clicks citation
  → setPdfPanel({ url, page, filename })
  → PdfPanel receives new props
  → useEffect clears stale highlight
  → Viewer remounts (key=url::page), Worker stays alive
  → initialPage={page-1} opens at cited page
  → onDocumentLoad fires
  → setHighlightedPage(page) → green overlay appears on cited page
  → after 7s → overlay removed
```

**No plugins used.** Viewer is stateless from React's perspective — navigation is handled entirely by `key` + `initialPage`.

---

## Highlight Animation (`src/app/globals.css`)

```css
@keyframes pageOverlayFade {
  0%   { opacity: 1; }
  100% { opacity: 0; }
}
.pdf-page-highlight-overlay {
  position: absolute;
  inset: 0;
  background: rgba(76, 175, 80, 0.35);
  border: 2px solid #4CAF50;
  animation: pageOverlayFade 7s ease-out forwards;
  pointer-events: none;
  z-index: 10;
}
```

Overlay is a real React DOM element injected via `renderPage` prop. It sits inside the viewer's own page stacking context so there are no z-index or positioning conflicts.

---

## Rules / Hard-Won Gotchas

| Rule | Why |
|---|---|
| Never put `pageNavigationPlugin()` inside `useMemo` or `useRef` lazy-init | It calls hooks internally — violates Rules of Hooks |
| Never add `position: relative` inline on page wrapper divs | Breaks react-pdf's text/annotation layer positioning |
| Never render all pages at once with react-pdf | Exhausts browser canvas context limit (~16), pages go blank/black |
| Never use `scrollIntoView` for PDF navigation | Races against async canvas rendering |
| Always keep `<Worker>` outside the keyed `<Viewer>` | Worker caches parsed PDF; remounting it throws away the cache |
| Use `pageRef` (useRef) not `page` (prop) inside `onDocumentLoad` | Closure captures stale prop value; ref always reflects latest |

---

## Next.js / Webpack Config (`next.config.ts`)

`canvas: false` alias prevents react-pdf-viewer from importing the `canvas` npm package during SSR.

Worker loads from unpkg CDN (`pdfjs-dist@3.11.174`). For offline/air-gapped deploy, copy worker to `/public` and update `WORKER_URL`.
