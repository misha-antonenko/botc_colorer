# BotC colorer v1

## Goal

Build the single-page PWA defined in `docs/init.md`: local-only game tracking for Blood on the Clocktower color assignments with dyadic and conditional observations, a worker-based exhaustive solver, IndexedDB persistence, import/export, and automated tests.

## Architecture

- **Frontend**: Vite + React + TypeScript + React Router.
- **Styling**: Tailwind CSS with a small app stylesheet for sticky layouts, matrix sizing, and mobile-friendly controls.
- **Persistence**: Dexie-backed IndexedDB plus three-slot rotating snapshot backups in `localStorage`.
- **State**: Zustand for session-level UI settings such as the active solutions cap and pending undo state.
- **Solver**: pure TypeScript function with a dedicated web worker wrapper.
- **Testing**: Vitest for solver and helper logic; Playwright for a mobile workflow smoke test.
- **PWA**: `vite-plugin-pwa`, manifest metadata, and generated service worker.

## Observable behavior to preserve

- Games persist locally and remain available after reload.
- Solver results exclude colorings that violate blue-count or fixed-color constraints.
- Dyadic and conditional transactions affect ranking exactly per the signed-weight fitness rules from the spec.
- Equal-fitness colorings are ordered by the documented lexicographic tiebreaker.
- Disabling or deleting a transaction changes the effective state immediately after persistence completes.

## Implementation plan

1. Scaffold the application, dependencies, scripts, and base route shell.
2. Define domain types and persistence helpers, including export/import and snapshot backups.
3. Implement the solver and worker contract, plus result explanation helpers for the solutions tab.
4. Build the four workspace tabs and the modal add-transaction route.
5. Add tests and validate with the repository scripts.

## Status

- [x] Scaffold application
- [x] Implement core model, persistence, and solver
- [x] Implement UI routes and tabs
- [x] Add automated tests
- [x] Validate, commit, and push

## Notes

- The initial implementation will use simple but complete controls instead of gesture-heavy interactions where equivalent functionality can be delivered more reliably. For example, transaction deletion will be implemented with an explicit delete action plus timed undo rather than a touch-swipe recognizer.
- Placeholder generated icons are acceptable for the initial PWA shell as long as the manifest and installability requirements are met.
- Implemented surfaces:
  - Vite + React + TypeScript app with React Router, Tailwind, Dexie, Zustand, and `vite-plugin-pwa`.
  - IndexedDB persistence with rotating `localStorage` backups plus import/export and snapshot restore.
  - Worker-based exhaustive solver with solutions expansion and deterministic tests for ordering and pruning.
  - Mobile-first games list, setup/state/transactions/solutions tabs, and modal add-transaction route.
  - Vitest coverage for solver, portable roundtrip, and matrix range helpers, plus a Playwright mobile workflow.
- Verified project scripts:
  - `npm run lint`
  - `npm run build`
  - `npm run test`
