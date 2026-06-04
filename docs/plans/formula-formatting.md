# Formula formatting

## Goal

Format formulas after entry and before saving: replace prefix variables with
full player names (original capitalization), normalize whitespace (spaces around
binary operators, no spaces after unary `~`/`!`), and pick canonical operator
symbols. Store the formatted string in the DB. The UI already renders
`transaction.formula`, so no display changes needed.

## Design

### Canonical operators

The AST loses the original operator token (`^` vs `+` vs `!=`). Pick one
canonical symbol per AST node type:

| AST type  | Symbol |
|-----------|--------|
| `not`     | `~`    |
| `and`     | `&`    |
| `xor`     | `^`    |
| `or`      | `\|`   |
| `eq`      | `=`    |
| `implies` | `=>`   |

`<=` (reverse implies) is normalized to `=>` with operands swapped (already
done at parse time).

### Parenthesization

Minimal parentheses based on precedence. Rules:

- Left child of a binary op: parens if `child_prec < parent_prec`
- Right child of a binary op: parens if `child_prec <= parent_prec`
- Operand of NOT: parens if `child_prec < NOT_prec`

This preserves the tree structure through a round-trip (format → re-parse).

### Integration point

`AddTransactionSheet.handleSave`: after `validateFormula` succeeds, call
`resolveFormula` then `formatFormula` to get the canonical string. Store that
in `transaction.formula`.

## Tasks

- [x] Add `formatFormula` to `formula.ts`
- [x] Add tests for `formatFormula`
- [x] Wire `formatFormula` into `AddTransactionSheet.handleSave`
- [x] Add `*` as alias for `&` in the tokenizer
- [x] Add tests for `*` tokenization
- [ ] Remove this plan
