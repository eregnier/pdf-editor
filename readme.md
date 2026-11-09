# PDF editor

Edit a PDF in the browser: open it, add images, text boxes and white rectangles
over the pages, then export the result. Everything happens locally — no upload,
no server, no account.

Live: https://pdf-editor-eqv.pages.dev/

## Commands

```bash
npm install
npm run dev      # dev server, http://localhost:5173
npm run build    # production build in dist/
npm run preview  # serve dist/
npm test         # unit tests
npm run deploy   # publish dist/ with wrangler (Cloudflare Workers)
```

Deployment is a static asset worker: `wrangler.jsonc` serves `dist/` as is, with
`not_found_handling: single-page-application`.

## What it does

- open a PDF from the file picker or by dropping it in the window
- pages are rasterised only when they come near the viewport, so a 300 page
  document costs a couple of canvases, not three hundred
- add an image from the picker, by drag and drop, or with a clipboard paste
- add a text box: double click to edit, font family and size, drag and resize
- add a white rectangle to hide part of the page (a simple eraser)
- `Ctrl+C` / `Ctrl+V` / `Ctrl+D` / `Delete`, plus duplicate and delete buttons on
  the selected object
- export through pdf-lib and download the result; nothing leaves the machine
- interface in French, English, Spanish, German, Italian and Portuguese, picked
  from the flag button and stored for the next visit

## Stack

TypeScript and vite, no framework, no CSS framework. `pdfjs-dist` renders the
pages, `pdf-lib` writes the output document.

```
src/model/       objects, pure scene functions, pdf.js document wrapper
src/view/        page frames, object views, language menu
src/controller/  image import, keyboard shortcuts
src/serializer/  pdf-lib export and font-metric line wrapping
src/i18n/        one flat JSON dictionary per language
tests/           scene, wrapping, export, translations
```

## Known limits

- a page is rasterised once at its first display width: zooming in afterwards
  shows a scaled bitmap
- text uses the three standard PDF fonts (Helvetica, Times, Courier), so no CJK
  or custom font
- the eraser is an opaque white rectangle, it does not inspect what is under it
- a dismissed native file dialog returns no file: drag and drop or a clipboard
  paste are the fallbacks

## License

MIT, see [LICENSE](LICENSE).
