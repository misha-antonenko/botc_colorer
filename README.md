# BotC colorer

BotC colorer is a local-first progressive web app for tracking blue/red team-color inferences during Blood on the Clocktower games.

## Stack

- Vite + React + TypeScript
- Tailwind CSS
- Dexie / IndexedDB
- Zustand
- Web Worker solver
- `vite-plugin-pwa`

## Development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run lint
npm run build
npm run test
```

## GitHub Pages deployment

The site is deployed by the GitHub Actions workflow in `.github/workflows/deploy-pages.yml`.

- The Pages build uses `VITE_APP_BASE=/botc_colorer/` so assets, router basename, and PWA metadata resolve under the repository path.
- `npm run build` also writes `dist/404.html` from `dist/index.html` so direct navigation to SPA routes keeps working on GitHub Pages.

After the workflow runs, open:

`https://misha-antonenko.github.io/botc_colorer/`

## Usage

1. Open the app URL.
2. Tap **New game**.
3. Configure players and blue-count bounds in **Setup**.
4. Add dyadic and conditional observations in **Transactions**.
5. Review the matrix in **State** and ranked colorings in **Solutions**.

## Key features

- Games list with duplicate, export, import, and snapshot restore.
- Setup tab for player ordering, naming, fixed colors, and blue-count bounds.
- State tab with the directed `f` matrix, conditional ranges, and symmetric pair summaries.
- Transactions tab for dyadic and conditional observations with enable/disable and undoable delete.
- Solutions tab backed by an exhaustive worker-based solver with expandable equation breakdowns.

## Spec

The implementation target is documented in `docs/init.md`. Progress notes for the delivered v1 live in `rfcs/botc-colorer-v1.md`.
