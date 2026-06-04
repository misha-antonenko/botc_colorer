# BotC colorer

BotC colorer is a local-first progressive web app for tracking blue/red team-color inferences during Blood on the Clocktower games.

## Concepts

A **game** has an ordered list of **players** and a **blue-count range** (the minimum and maximum number of players that can be blue).

A **coloring** is an assignment of red or blue to every player. Each player is modeled as a boolean variable: true = red, false = blue.

A **transaction** is an observation about player colors, expressed as a propositional-logic formula (e.g., `Al = Bob` means Alice and Bob are the same color). Each transaction is either **hard** or **soft**:

- A hard transaction eliminates every coloring where its formula is false.
- A soft transaction has a numeric **weight**. It contributes `+|weight|` to a coloring's fitness when satisfied and `-|weight|` when not.

The **fitness** of a coloring is the sum of contributions from all enabled soft transactions. The solver enumerates every coloring that satisfies the blue-count range and all hard constraints, then ranks them by fitness (highest first).

## Usage

1. Open the app: https://misha-antonenko.github.io/botc_colorer/.
2. Tap **New game**.
3. Configure players and the blue-count range in **Setup**.
4. Add formulas in **Transactions** (e.g., `Al = Bob`, `~Carol`, `~C => (Al ^ Bob)`).
5. Review ranked colorings in **Solutions**.

## Formula language

Formulas are propositional logic over player-name prefixes. A prefix resolves to a player if exactly one player's name starts with it (case-insensitive). Adding or renaming a player that would make any existing formula ambiguous is rejected.

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

## Key features

- Games list with duplicate, export, and import.
- Setup tab for player ordering, naming, and blue-count range.
- State tab listing hard and soft constraints.
- Transactions tab with formula entry, hard/soft toggle, enable/disable, and undoable delete.
- Solutions tab with an exhaustive Web Worker solver and per-transaction contribution breakdowns.

## Stack

- Vite + React + TypeScript
- Tailwind CSS
- Dexie / IndexedDB
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

`npm test` runs type checking, Vitest unit tests, and Playwright E2E tests.

## GitHub Pages deployment

The site is deployed by the GitHub Actions workflow in `.github/workflows/deploy-pages.yml`.

- The Pages build uses `VITE_APP_BASE=/botc_colorer/` so assets, router basename, and PWA metadata resolve under the repository path.
- `npm run build` also writes `dist/404.html` from `dist/index.html` so direct navigation to SPA routes keeps working on GitHub Pages.
