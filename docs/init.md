# BotC blue/red coloring finder — design doc

## 1. Overview

Build a single-page progressive web app (PWA) for tracking probabilistic team-color inferences during games of Blood on the Clocktower (BotC), a social-deduction tabletop game in which each of 5–15 players holds a secret role belonging to either a "good" team (called **blue** in this app) or "evil" team (**red**). The user records observations during a game; the app maintains a ranked list of which possible color assignments are most consistent with those observations.

Mechanics in scope:

- A **game** has up to 16 player slots in fixed seat positions.
- A **coloring** is an assignment of blue or red to every player; there are `2^n` colorings for `n` players.
- The user records two kinds of observations:
  1. **Dyadic** — "player A supports/opposes player B" with a signed weight. Positive = support (suggests same color); negative = oppose (suggests different colors). These accumulate into a directed real-valued table `f[active][passive]`.
  2. **Conditional** — for info roles like the Empath, an observation that takes effect only when a specified player has a specified color. E.g., "if Alice (the Empath) is blue, then her two neighbors have different colors, weight 1."
- **Fixed-color constraints** hard-pin certain players' colors when known from game mechanics. Colorings violating any fixed color are excluded.
- The **blue count range** `[k_min, k_max]` bounds the total number of blues per game script. Colorings outside the range are excluded.

The **solver** assigns each valid coloring a fitness:

> fitness = (weighted satisfied equations) − (weighted unsatisfied equations)

where the equation system is built from the `f` table plus active conditional observations. Highest fitness = best fit.

Operational constraints: no backend, no auth, no cross-device sync. All data lives locally on the device. Mobile-first.

## 2. Glossary

- **Coloring**: assignment of {blue, red} to each player; representable as an `n`-bit integer with `bit_i = 1 ⇔ player at position i is blue`.
- **Equation**: a soft constraint `(i, j, weight)` with signed `weight`. `weight > 0` means "`x_i = x_j`" with strength `|weight|`; `weight < 0` means "`x_i ≠ x_j`" with strength `|weight|`.
- **Dyadic transaction**: a single support/oppose action; contributes one signed value to one cell of `f`.
- **Conditional transaction**: an observation that becomes a set of equations only when its condition is met.
- **Fitness**: sum over the equation system of `weight × (1 if x_i = x_j else −1)`. This compact form handles both equality and inequality equations through the sign of `weight`.
- **f table**: an `n × n` real matrix where `f[a][p]` is the sum of signed weights from enabled dyadic transactions with `active = a`, `passive = p`.

## 3. Tech stack

- Vite + React + TypeScript
- Tailwind CSS
- Dexie.js over IndexedDB
- Zustand for cross-screen UI state
- `vite-plugin-pwa` for manifest + service worker
- No backend; static deploy to GitHub Pages

## 4. Data model

```ts
type PlayerId = string;        // uuid v4
type GameId   = string;
type TxId     = string;
type Color    = 'blue' | 'red';

interface Game {
  id: GameId;
  name: string;
  createdAt: number;           // ms epoch
  updatedAt: number;
  blueCountMin: number;        // inclusive
  blueCountMax: number;        // inclusive
  players: Player[];           // 1..16; array index = seat position
}

interface Player {
  id: PlayerId;
  name: string;
  fixedColor: Color | null;
}

interface Equation {
  i: PlayerId;
  j: PlayerId;
  weight: number;              // nonzero real; sign carries relation
}

type Transaction = DyadicTx | ConditionalTx;

interface BaseTx {
  id: TxId;
  gameId: GameId;
  createdAt: number;
  enabled: boolean;
  note?: string;
}

interface DyadicTx extends BaseTx {
  kind: 'dyadic';
  active: PlayerId;
  passive: PlayerId;
  weight: number;              // nonzero real; positive = support, negative = oppose
}

interface ConditionalTx extends BaseTx {
  kind: 'conditional';
  condition: { playerId: PlayerId; color: Color };
  equations: Equation[];       // each weight nonzero; fractional allowed
}
```

Notes:

- Weights are signed real numbers throughout. The fitness contribution of any equation is `weight × (same ? 1 : −1)`. This gives:
  - `weight > 0`, same colors → `+|weight|`;
  - `weight > 0`, different → `−|weight|`;
  - `weight < 0`, same → `−|weight|`;
  - `weight < 0`, different → `+|weight|`.
- A `DyadicTx` is conceptually equivalent to a conditional with no condition and a single equation `(active, passive, weight)`. They are kept as distinct kinds for ergonomic UI and for the State tab.
- The solver only consumes equations. Dyadic txs translate to one equation each on the way in.

## 5. Algorithm

Inputs: a game with `n ≤ 16` players, enabled transactions `T`, blue range `[k_min, k_max]`, fixed-color map `F: PlayerId → Color`.

```text
positions[playerId] = array index in game.players

# Aggregate dyadic transactions into a symmetric weight per unordered pair.
symW[i][j] = 0   for all i < j
for tx in enabled dyadic txs:
    a = positions[tx.active]
    p = positions[tx.passive]
    (lo, hi) = (min(a, p), max(a, p))
    symW[lo][hi] += tx.weight

# Fixed-color masks.
mustBeBlue = bitmask of positions with fixedColor == 'blue'
mustBeRed = bitmask of positions with fixedColor == 'red'

results = []
for c in 0 .. (1 << n) - 1:
    bc = popcount(c)
    if bc < k_min or bc > k_max: continue
    if (c & mustBeBlue) != mustBeBlue: continue   # all fixed-blue bits must be set
    if (c & mustBeRed)  != 0: continue   # all fixed-red bits must be clear

    fitness = 0

    # Dyadic contributions via symW.
    for (i, j) with symW[i][j] != 0:
        bi = (c >> i) & 1
        bj = (c >> j) & 1
        same = (bi == bj)
        fitness += same ? symW[i][j] : -symW[i][j]

    # Conditional contributions.
    for tx in enabled conditional txs:
        ci = positions[tx.condition.playerId]
        want = (tx.condition.color == 'blue') ? 1 : 0
        if ((c >> ci) & 1) != want: continue
        for eq in tx.equations:
            bi = (c >> positions[eq.i]) & 1
            bj = (c >> positions[eq.j]) & 1
            same = (bi == bj)
            fitness += same ? eq.weight : -eq.weight

    results.push({ c, fitness })

sort results by (-fitness, lexKey(c))
return results   # all of them; UI applies a display cap
```

**Lex tiebreaker.** Within equal fitness, sort by the color sequence read position `0 → n-1`, with the ordering `blue < red`.

Concretely: define `lexKey(c)` such that lower key sorts first. One correct implementation: treat position `0` as the most significant "bit" with `blue = 0` and `red = 1`, then read positions `0..n-1` as an `n`-digit base-2 numeral and compare numerically.

Complexity: `O(2^n · (|nonzero symW pairs| + |conditional equations|))`. For `n = 16`, `|T| ≈ 50`, average equations per tx ≤ 2: ≈ 6.5M cheap ops per recompute. Well under the 200 ms budget on mobile.

**Run the solver in a Web Worker.** Worker contract:

```ts
// main → worker
{ kind: 'solve'; game: Game; txs: Transaction[] }

// worker → main
{ kind: 'solved'; results: { c: number; fitness: number }[]; elapsedMs: number }
```

## 6. UI structure

Mobile-first. Single column. No horizontal scrolling anywhere except within the State tab's `f` matrix.

### Routes

- `/` — games list
- `/g/:gameId` — game workspace, four tabs
- `/g/:gameId/tx/new` — add-transaction sheet (modal route)

### Games list (`/`)

- Card per game: name, player count, last update, top-fitness preview.
- Ordered by last update descending.
- Lazy loading.
- Header actions: **new game**, **import**.
- Per-card menu:
  - **duplicate** — copies the game's name (suffixed with " (copy)"), player names, and blue range. Transactions and fixed colors are **not** copied.
  - **export** — triggers a download of a JSON

### Game workspace (`/g/:gameId`)

Four tabs in a sticky top bar.

1. **"Setup"**
   - Editable player list (name input per slot). Slots are reorderable. The user can add new players and remove existing ones.
   - Per player: tap a swatch to cycle `null → blue → red → null` for `fixedColor`.
   - Two number inputs for `blueCountMin` and `blueCountMax`, with a small visual range bar.
   - Game name field.

2. **"State"**
   - **`f` matrix**: `n × n` grid. Row `i` = active player at seat `i`; column `j` = passive player at seat `j`.
   - Each cell `(i, j)` shows up to two parts; the part after `+` is appended only when nonzero:
     - The dyadic value `f[i][j]` — the directed sum of signed weights from enabled dyadic transactions with `active = i`, `passive = j`.
     - Preceded by a `+`: `+ [lo, hi]` — the range of additional contribution to the unordered pair `{i, j}` from enabled conditional equations. Computed as `lo = Σ min(0, w)` and `hi = Σ max(0, w)` summed over every conditional equation `(i', j', w)` in any enabled conditional transaction such that `{i', j'} = {i, j}`. The same range appears in both `(i, j)` and `(j, i)` cells, since conditional equations are symmetric. This is a rough approximation: it treats different conditions as independent, so when multiple conditional transactions share a condition the true reachable range is narrower than what is shown.
   - Example cell renderings: `2` (dyadic only), `2 + [−0.5, 1.5]` (dyadic plus conditional range), `0 + [0, 1]` (only conditional contribution), `0` (empty), `−` (diagonal).
   - Cell background tints toward blue for positive `f[i][j]`, toward red for negative; intensity scales with magnitude relative to the matrix max. Row and column headers (player name + seat number) stay sticky on scroll. Pinch-zoom allowed.
   - **Conditional list** below the matrix: one-line summary per enabled conditional transaction. Useful for inspecting the structural source of the bracketed ranges above.
   - **Effective symmetric pair weights** (collapsible section): list of unordered pairs `(i, j)` with the symmetric dyadic sum `f[i][j] + f[j][i]` plus the same `[lo, hi]` conditional range, sorted by absolute value of the dyadic sum descending. Useful for sanity-checking the equation system that the solver actually consumes.

3. **"Transactions"**
   - Reverse-chronological list. Each row shows a human summary, e.g. `"Alice → Bob, w = +1"` or `"if Carol blue: Dan ≠ Eve, w = 0.5"`.
   - Enabled toggle per row. Disabled rows render at low opacity, summary struck through.
   - Left-swipe = delete with 5s undo toast.
   - FAB "+" opens the add-transaction sheet:
     - **Dyadic mode**: pick active, pick passive, number input for the signed weight (default `+1`). Two quick-set buttons: "support" (`+1`), "oppose" (`−1`).
     - **Conditional mode**: pick the conditioning player and color, then add one or more equations (each: pick `i`, pick `j`, signed weight).

4. **"Solutions"**
   - Top-of-tab control: display cap selector `K ∈ {10, 50, 100}`.
   - Each row shows a strip of `n` compact colored cells (blue/red) with a player number on each, the fitness value, and (when several colorings share a fitness tier) a small `tied with N` hint.
   - Tap a row to expand: per-equation breakdown — for every contributing equation, whether it is satisfied, its signed weight, and its numeric contribution.

Sticky bottom strip across all four tabs: `n players · k enabled tx · top fitness · last recompute X ms`.

## 7. Storage

- IndexedDB via Dexie. One DB per origin: `botc-coloring`.
- Tables:
  - `games(id, name, createdAt, updatedAt, blueCountMin, blueCountMax, playersJSON)`
  - `transactions(id, gameId, kind, enabled, createdAt, payloadJSON)`
- Indices: `transactions.gameId`, `games.updatedAt`.
- Schema versioning via Dexie's `db.version(N).stores(...).upgrade(...)`.
- Every mutation is awaited before the solver recompute is triggered.
- **Rotating snapshot backup**: after each mutation, serialize the affected game's full state into `localStorage` under key `botc:backup:<gameId>:<i>` where `i ∈ {0, 1, 2}` cycles. The three most recent snapshots survive even if IndexedDB corrupts. A "restore from snapshot" entry appears in the game menu.

### Export / import

- Per-game export: a JSON file, downloaded via `Blob` + temporary `<a download>`; use Web Share API where supported.
- Full export: all games + all transactions in one JSON file.
- Import: file picker; validate `version` and schema; on ID collision, generate new IDs and suffix names with " (imported)".

Schema:

```json
{
  "version": 1,
  "exportedAt": 1731700000000,
  "games": [ /* Game */ ],
  "transactions": [ /* Transaction */ ]
}
```

## 8. PWA specifics

- `manifest.webmanifest`: `name`, `short_name`, `display: standalone`, theme + background color, icons at 192, 512, and 512-maskable.
- Service worker via Workbox (auto-generated by `vite-plugin-pwa`): precache the app shell; no runtime network calls.
- iOS quirks: include `apple-touch-icon`, `<meta name="apple-mobile-web-app-capable" content="yes">`, and a status-bar-style meta.

## 9. File layout

```text
src/
  main.tsx
  App.tsx
  router.tsx
  db/
    schema.ts          # Dexie tables + version migrations
    queries.ts         # CRUD helpers + useLiveQuery hooks
    backup.ts          # localStorage snapshot rotation
    portable.ts        # export / import / JSON schema validation
  state/
    store.ts           # Zustand store (active gameId, K, ui flags)
  solver/
    types.ts
    solve.ts           # pure function (game, txs) => ranked colorings
    worker.ts          # postMessage glue
    solve.test.ts
  ui/
    screens/
      GamesList.tsx
      GameWorkspace.tsx
      tabs/SetupTab.tsx
      tabs/StateTab.tsx
      tabs/TransactionsTab.tsx
      tabs/SolutionsTab.tsx
    components/
      FMatrix.tsx
      ColoringRow.tsx
      PlayerPicker.tsx
      AddTransactionSheet.tsx
      ToggleRow.tsx
  pwa/
    manifest.ts
public/
  icons/
    icon-192.png
    icon-512.png
    icon-maskable.png
index.html
vite.config.ts
```

## 10. Edge cases & validation

- `blueCountMin > blueCountMax`: inline form error; save disabled.
- Fixed-color counts inconsistent with the blue range (e.g. 4 fixed blues with `k_max = 3`): allow during edit, but the Solutions tab shows an explanatory empty state.
- Zero-weight equation or zero-weight dyadic: rejected at form level. To remove an effect, disable or delete the transaction.
- Self-loops (`i == j` in an equation; `active == passive` in a dyadic): rejected at form level.
- Empty equation list in conditional mode: rejected.
- Disallow removing players that are referenced by any transactions.

## 11. Testing

- **Solver** (Vitest, deterministic unit tests on the pure function):
  - Single dyadic tx — ranks colorings correctly.
  - Pair of canceling dyadic txs (`+1` in one direction, `−1` in the other on the same pair) — zero net contribution.
  - Conditional tx with condition unmet — contributes zero.
  - Conditional tx with condition met — contributes as expected.
  - Fixed colors prune correctly; result set excludes violators.
  - Blue range prunes correctly.
  - Fractional weights (e.g. `0.5`) sum exactly under chosen test cases.
  - Lex tiebreaker: among colorings tied at the top fitness, the order matches the position-0-most-significant, blue-less-than-red ordering.
- **DB / portable**: roundtrip `export → import` yields a structurally equal payload for a fixture game.
- **State tab `f` matrix range** (Vitest): per unordered pair, the displayed `[lo, hi]` equals `[Σ min(0, w), Σ max(0, w)]` over the matching conditional equations. Verify it shows in both directed cells and is omitted when both endpoints are zero.
- **UI** (Playwright, mobile viewport): create a game, add players, add dyadic tx, add conditional tx, observe solutions update; disable a tx and confirm the top coloring changes.
- Feel free to add more tests.

## 12. Non-goals (at least right now, for our v1)

- Multi-device sync.
- Auth / accounts.
- Sharing live game state with other devices or players.
- Storyteller mode / role tracker / game-script awareness.
- Encrypted at-rest storage.
- Undo history beyond the most recent destructive action.
- Compound conditional logic (multi-player AND/OR conditions). The single-player condition suffices for v1; the type can be extended later by replacing `condition` with `condition: { conjuncts: { playerId; color }[] }`.
