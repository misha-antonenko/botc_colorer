# Color transaction type

## Goal

Replace the per-player fixed-color toggles in the Setup tab with a dedicated `ColorTx` transaction type. The latest enabled `ColorTx` for a given player determines that player's fixed color.

## Changes

### `types.ts`
- Add `ColorTx extends BaseTx` with `kind: 'color'`, `playerId: PlayerId`, `color: Color`.
- Update `Transaction = DyadicTx | ConditionalTx | ColorTx` — Color sits between Dyadic and Conditional.
- Keep `fixedColor: Color | null` on `Player` for DB compat, but stop using it in the solver.

### `solve.ts`
- `buildFixedColorMasks(game, txs)`: derive fixed colors from the latest enabled `ColorTx` per player instead of `player.fixedColor`.

### `schema.ts`
- Update `decodeTransactionRow` to handle `kind === 'color'`.

### `portable.ts`
- Add `colorTxSchema`; include it in the discriminated union.
- Update relationship validation for `color` kind.

### `formatters.ts`
- Add `color` case to `summarizeTransaction`.

### `AddTransactionSheet.tsx`
- Add `'color'` to `TransactionMode`.
- Insert Color tab between Dyadic and Conditional.
- Color form: player picker + color select.

### `TransactionsTab.tsx`
- Render ColorTx in `TransactionSummary`.
- Update empty-state text.

### `SetupTab.tsx`
- Remove the color toggle button from player cards.
- Update `referencedPlayerIds` to cover `ColorTx.playerId`.

### `fixtures.ts`
- Add `createColorTxFixture`.

### Tests
- `solve.test.ts`: fixed colors from ColorTx, latest-prevails rule.
- `formatters.test.ts`: summarize ColorTx.
- `portable.test.ts`: parse/export ColorTx.

## Status

- [x] RFC written
- [ ] Implementation
- [ ] Tests
