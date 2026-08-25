# MedAssist frontend — working notes for Claude

React + TypeScript + Vite. Mantine for UI, TanStack Query for server state, React Router for
routing. Backend lives in the sibling repo `dock-helper-api`; this app is built *into* the backend's
Docker image, so the two ship together.

## Conventions

- Branch is `master`, not `main`. `origin` has two push URLs — GitHub and a GitVerse mirror. The
  deploy clones from GitVerse.
- `src/features/<area>/` holds the real code; `src/pages/<Name>.tsx` are thin re-export wrappers
  that `router.tsx` imports. Follow that split when adding a screen.
- HTTP goes through `createHttpRepository`/`request` in `src/lib/httpRepository.ts` — it carries the
  auth token and the API base URL. Do not call `fetch` directly. A `FormData` body must not get an
  explicit `Content-Type`; `request` already handles that.
- Server state is TanStack Query, one hook per resource (`useDocumentTemplates`, `usePatients`, …).
  Local UI state is plain `useState`. There is no global store.
- UI text is Russian. Code, comments and identifiers are English.

## Checks

```bash
npm run lint     # oxlint
npm run build    # tsc -b && vite build
```

Both must pass before pushing — the backend's `update.sh` will happily build a broken frontend into
the production image, and the failure surfaces as a blank page rather than a build error.

## Document templates

Two kinds share one list, distinguished by `template.kind`:

- **`flow`** — Tiptap HTML in `bodyHtml`, edited by `DocumentTemplateForm`.
- **`layout`** — a scanned blank form reproduced as absolutely-positioned blocks, edited by
  `LayoutEditor`. Created via «Бланк из снимка» (`ScanTemplatePage`): pick a photo, crop it by hand,
  optionally recognise, then correct in the editor.

`DocumentTemplateEditorPage` branches on `kind`, and that branch is load-bearing — opening a layout
template in the Tiptap form would show an empty editor and overwrite the layout with that emptiness
on save.

**All layout geometry is a percentage of the page.** Font size is rendered in `cqh` (container query
height) units, where `1cqh` is 1% of the page element's height — exactly what `fontSizePct` means.
That is why the same values render correctly in a 400 px preview and on a 148 mm sheet with no
measurement code and no separate print path. Don't replace it with pixel maths.

The crop step is manual on purpose: automatic document detection on a phone photo fails silently and
often, and the doctor can see where the form is. Cropping away the surrounding desk was measurably
the single biggest gain in recognition quality — bigger than any image filter.
