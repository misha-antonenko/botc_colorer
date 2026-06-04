# Logical statements redesign

Replace the three existing transaction types (dyadic, color, conditional) with a single "logical statement" type.

## Semantics

Player variable = truthy when the player is **red**.

- `A = B` — same color (XNOR)
- `A ^ B` / `A + B` / `A != B` — different color (XOR)
- `A & B` — both red (AND)
- `A | B` — at least one red (OR)
- `!A` / `~A` — A is blue (NOT)
- `A => B` — if A is red then B is red (implication)
- `A <= B` — if B is red then A is red (reverse implication)

Parentheses override precedence.

### Transaction fields

- `formula: string` — raw text
- `weight: number` — nonzero; ignored when hard
- `hard: boolean` — hard constraint prunes colorings where formula is false
- `note?: string`
- `enabled: boolean`

### Scoring

- Soft: `satisfied ? +|weight| : -|weight|`
- Hard: prune colorings where formula is false

### Player prefix resolution

A prefix `P` resolves to player `X` iff `X.name` starts with `P` (case-insensitive) and no other player's name does. Ambiguous or unmatched prefix -> validation error.

Adding/renaming a player that makes any existing formula ambiguous is rejected.

### Operator precedence (high -> low)

1. `!` / `~` (NOT, unary prefix)
2. `&` (AND)
3. `^` / `+` / `!=` (XOR)
4. `|` (OR)
5. `=` (XNOR)
6. `=>` / `<=` (implication, left-to-right)

## Migration v2 -> v3

- **Dyadic** `active->passive, w=W`: formula `active = passive` (if W>0) or `active ^ passive` (if W<0), weight `|W|`, soft. Exact conversion.
- **Color** `X is blue`: formula `~X`, hard. `X is red`: formula `X`, hard. Exact conversion.
- **Conditional** `if X is C then i eq j (w=W)`: formula `condition => equation`, weight `|W|`, soft. Approximate — old conditionals contributed 0 when condition was false; new `=>` contributes `+|weight|` (formula is vacuously true).

## Implementation status

1. [x] Formula parser + evaluator + player resolution (`src/solver/formula.ts`) + tests
2. [x] Update types (`src/solver/types.ts`)
3. [x] Update solver (`src/solver/solve.ts`) + tests
4. [x] Migration (`src/db/migrations.ts`, `src/db/schema.ts`) + tests
5. [x] Update portable/Zod schemas (`src/db/portable.ts`) + tests
6. [x] Update UI: AddTransactionSheet, TransactionsTab, SetupTab validation, StateTab, ColoringRow, formatters
7. [x] Remove dead code: FMatrix, fMatrixUtils, PlayerPicker
8. [x] Update all tests (117 passing)
9. [x] TypeScript compiles cleanly, ESLint passes
