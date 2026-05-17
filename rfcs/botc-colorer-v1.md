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
- **Deployment**: GitHub Actions workflow publishes the built `dist/` artifact to GitHub Pages under the repository base path, with `404.html` mirroring `index.html` for SPA route fallback.

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

- The initial implementation prioritized simple complete controls, but subsequent device testing justified targeted gesture support where it materially improved mobile usability.
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
- Deployment fix:
  - GitHub Pages had been serving the repository root, which exposed raw source files such as `/src/main.tsx` and produced a blank page in browsers.
  - The fix switches deployment to an Actions-built Pages artifact, sets the repository base path for Vite and PWA metadata, and emits `404.html` for deep-link fallback on GitHub Pages.
- Follow-up UX fixes after device testing:
  - Export now uses the already-loaded in-memory game state on the games list and a safer blob-download fallback so macOS/iOS browsers can actually download JSON exports.
  - Missing game routes now render an explicit not-found state instead of an infinite loading screen.
  - Blue-count inputs now use numeric input mode with permissive text entry so temporary out-of-range edits are possible, and player order now uses drag-and-drop.
  - The state tab removes the redundant symmetric pair section, and the matrix scroll area no longer overlays the workspace header.
  - Transactions are simplified: conditional transactions create exactly one equation, the enabled control is inline, and delete is exposed via swipe-to-reveal instead of a large always-visible button.
  - Solutions now show `tied with previous` only when the visible previous row actually shares the same fitness tier.
- Second device-polish pass:
  - Transaction cards no longer show timestamps, use a checkmark-only enabled control, and keep the hidden swipe-delete action fully invisible while closed or disabled.
  - Setup player cards now use the same swipe-delete affordance, place the fixed-color control inline with the player name, and stretch the drag handle along the right edge.
  - Signed weight fields use permissive text inputs so `+` and `-` remain typeable on iOS.
  - The `f` matrix uses tighter cell sizing, and solution color cells now include tiny player initials.
- Third device-polish pass:
  - Setup player cards are compact again: the fixed-color control is now a small swatch button, the name input no longer forces horizontal overflow, and the swipe row exposes a dedicated non-input seat area plus a shorter open threshold.
  - The blue-count tile now shows inline min/max fields, explicit inclusive allowed totals, and numeric chips instead of unlabeled bars; impossible counts above the player count are normalized away on blur instead of being persisted.
  - Solver breakdown entries now share the same signed-equation satisfaction logic as the fitness computation, so negative-weight equations only show as satisfied when the players differ and their displayed contribution sign matches the score.
  - Regression coverage now includes negative-weight solver/breakdown tests, a direct pointer-event test for swipe-to-delete, and a mobile Playwright check for setup layout and input sizing.
- Fourth device-polish pass:
  - Blue-range adjustments now follow the standard BotC good-player step pattern when seats are added or removed, shifting the current min/max range by the same delta instead of leaving it static.
  - The blue-range tile is simpler again: min/max remain inline, the confusing allowed-total chips are gone, and the remaining copy only explains the automatic shift behavior.
  - Solution rows now render `Fitness = …` without the stray leading spacing, conditional breakdown entries show their triggering condition explicitly, and solution cell abbreviations use the first three visible characters of each player name instead of initials.
  - The non-color UI palette is now neutral grayscale: primary actions, tabs, warnings/errors, delete affordances, and matrix intensity cues no longer reuse blue/red accents reserved for actual player-color semantics.
  - Regression coverage now includes blue-range delta unit tests, a setup-tab test for add-player shifting, and a component test for conditional breakdown copy plus three-character solution labels.
- Fifth device-polish pass:
  - New games are now named sequentially from the existing local game count, so a fresh game starts as `Game 1`, then `Game 2`, and so on.
  - Solution rows pack more tightly on small screens: colored cells use smaller snug dimensions, the fitness block drops below the strip instead of leaving a large empty gap, and the visible copy still fits without truncation.
  - The remaining blue tint in the global background and PWA theme colors is removed; the page gradient, browser theme color, and manifest theme/background colors now use neutral grayscale values.
  - Transaction list tiles are tighter and vertically centered, reducing unnecessary horizontal padding around the summary text and the enabled checkbox.
  - Signed weight entry now uses decimal numeric pads plus an inline sign-toggle button (`Support` / `Oppose`) instead of requiring typed `+`/`-`, and the mobile Playwright flow now covers that path.
- Sixth device-polish pass:
  - Transaction weight fields are now both labeled simply `Weight`, and the sign-toggle buttons use distinct accessibility labels so generic weight field names stay unambiguous in tests and assistive tech.
  - The conditional transaction form now reads as a sentence: `If player`, `is`, `then`, `Source player`, and `Destination player`, with matching validation copy for the revised terms.
  - Transaction notes render beneath the transaction summary in the transactions tab, preserving line breaks and disabled styling instead of disappearing after save.
  - The remaining non-player-color UI chrome now uses the zinc palette rather than slate, so cards, tabs, borders, text, and matrix chrome read as neutral gray instead of blue-gray; the games-list `Open` pill also uses centered inline-flex styling so its text aligns with the other buttons.
  - Mobile zoom resistance is reinforced in two places: text-entry controls are pinned to at least 16px and the viewport meta tag now caps scale at `1.0`, preventing focus-triggered zoom jumps on iOS.
  - Regression coverage now includes a transactions-tab unit test for saved notes plus Playwright checks for the renamed labels, visible saved notes, 16px weight-field sizing, and the locked mobile viewport meta tag.
