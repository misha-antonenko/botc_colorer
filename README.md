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

## Key features

- Games list with duplicate, export, import, and snapshot restore.
- Setup tab for player ordering, naming, fixed colors, and blue-count bounds.
- State tab with the directed `f` matrix, conditional ranges, and symmetric pair summaries.
- Transactions tab for dyadic and conditional observations with enable/disable and undoable delete.
- Solutions tab backed by an exhaustive worker-based solver with expandable equation breakdowns.

## Spec

The implementation target is documented in `docs/init.md`. Progress notes for the delivered v1 live in `rfcs/botc-colorer-v1.md`.
