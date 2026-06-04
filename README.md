# BotC colorer

BotC colorer is a local-first progressive web app for tracking blue/red team-color inferences during Blood on the Clocktower games.

Players are assigned boolean variables (true = red, false = blue). Observations are entered as propositional-logic formulas over these variables. The solver exhaustively evaluates all colorings that satisfy the blue-count bounds and hard constraints, then ranks them by fitness.

## Usage

1. Open the app: https://misha-antonenko.github.io/botc_colorer/.
2. Tap **New game**.
3. Configure players and blue-count bounds in **Setup**.
4. Add logical formulas in **Transactions** (e.g., `Al = Bob`, `~Carol`, `~C => (Al ^ Bob)`).
5. Review ranked colorings in **Solutions**.

## Transaction system

Each transaction has a **formula** field that accepts propositional logic over player-name prefixes. A prefix resolves to a player if exactly one player's name starts with it (case-insensitive). Adding or renaming a player that would make any existing formula ambiguous is rejected.

### Operators (high to low precedence)

| Operator | Meaning |
|---|---|
| `!` / `~` | NOT (unary) |
| `&` | AND |
| `^` / `+` / `!=` | XOR (different color) |
| `\|` | OR |
| `=` | XNOR (same color) |
| `=>` / `<=` | implication |

Parentheses override precedence.

### Scoring

- **Soft** transactions: satisfied adds `+|weight|`, unsatisfied adds `-|weight|`.
- **Hard** transactions: prune colorings where the formula is false.

## Key features

- Games list with duplicate, export, and import.
- Setup tab for player ordering, naming, and blue-count bounds.
- State tab listing hard and soft constraints.
- Transactions tab with formula entry, hard/soft toggle, enable/disable, and undoable delete.
- Solutions tab backed by an exhaustive Web Worker solver with per-transaction fitness breakdowns.

## Stack

- Vite + React + TypeScript
- Tailwind CSS
- Dexie / IndexedDB (schema version 3)
- Zustand
- Web Worker solver
- `vite-plugin-pwa`

## Development

### Installation

```bash
npm install
npm run dev
```

### Validation

```bash
npm run lint
npm run build
npm run test
```

`npm test` runs type checking, Vitest unit tests (117 tests), and Playwright E2E tests.

## GitHub Pages deployment

The site is deployed by the GitHub Actions workflow in `.github/workflows/deploy-pages.yml`.

- The Pages build uses `VITE_APP_BASE=/botc_colorer/` so assets, router basename, and PWA metadata resolve under the repository path.
- `npm run build` also writes `dist/404.html` from `dist/index.html` so direct navigation to SPA routes keeps working on GitHub Pages.
