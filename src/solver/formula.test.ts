import { describe, expect, it } from 'vitest'
import {
  FormulaError,
  compileAst,
  extractVariables,
  parseFormula,
  resolvePlayerPrefix,
  tokenize,
  validateFormula,
  wouldPlayerMakeFormulasAmbiguous,
  wouldRenameMakeFormulasAmbiguous,
} from './formula'
import type { Player } from './types'

// ── Tokenizer ────────────────────────────────────────────────────────────────

describe('tokenize', () => {
  it('tokenizes simple identifiers', () => {
    const tokens = tokenize('Alice Bob')
    expect(tokens).toEqual([
      { type: 'IDENT', value: 'Alice', position: 0 },
      { type: 'IDENT', value: 'Bob', position: 6 },
    ])
  })

  it('tokenizes all single-char operators', () => {
    const tokens = tokenize('! ~ & | ^ + ( )')
    const types = tokens.map((t) => t.type)
    expect(types).toEqual(['NOT', 'NOT', 'AND', 'OR', 'XOR', 'XOR', 'LPAREN', 'RPAREN'])
  })

  it('tokenizes multi-char operators', () => {
    const tokens = tokenize('=> <= !=')
    const types = tokens.map((t) => t.type)
    expect(types).toEqual(['IMPLIES', 'REV_IMPLIES', 'XOR'])
  })

  it('tokenizes = vs =>', () => {
    const tokens = tokenize('A = B => C')
    expect(tokens.map((t) => t.type)).toEqual(['IDENT', 'EQ', 'IDENT', 'IMPLIES', 'IDENT'])
  })

  it('tokenizes ! vs !=', () => {
    const tokens = tokenize('!A != B')
    expect(tokens.map((t) => t.type)).toEqual(['NOT', 'IDENT', 'XOR', 'IDENT'])
  })

  it('rejects bare <', () => {
    expect(() => tokenize('A < B')).toThrow(FormulaError)
  })

  it('rejects bare >', () => {
    expect(() => tokenize('A > B')).toThrow(FormulaError)
  })

  it('handles identifiers adjacent to operators without spaces', () => {
    const tokens = tokenize('A&B')
    expect(tokens.map((t) => t.type)).toEqual(['IDENT', 'AND', 'IDENT'])
    expect(tokens.map((t) => t.value)).toEqual(['A', '&', 'B'])
  })

  it('handles identifiers with digits and special chars', () => {
    const tokens = tokenize("Player1 O'Brien Carol-Ann")
    expect(tokens.map((t) => t.value)).toEqual(['Player1', "O'Brien", 'Carol-Ann'])
  })

  it('returns empty for empty input', () => {
    expect(tokenize('')).toEqual([])
    expect(tokenize('   ')).toEqual([])
  })
})

// ── Parser ───────────────────────────────────────────────────────────────────

describe('parseFormula', () => {
  it('parses a single variable', () => {
    const ast = parseFormula('Alice')
    expect(ast).toEqual({ type: 'var', name: 'Alice' })
  })

  it('parses NOT', () => {
    const ast = parseFormula('!Alice')
    expect(ast).toEqual({ type: 'not', operand: { type: 'var', name: 'Alice' } })
  })

  it('parses double NOT', () => {
    const ast = parseFormula('!!A')
    expect(ast).toEqual({
      type: 'not',
      operand: { type: 'not', operand: { type: 'var', name: 'A' } },
    })
  })

  it('parses AND', () => {
    const ast = parseFormula('A & B')
    expect(ast).toEqual({
      type: 'and',
      left: { type: 'var', name: 'A' },
      right: { type: 'var', name: 'B' },
    })
  })

  it('parses XOR with ^', () => {
    const ast = parseFormula('A ^ B')
    expect(ast).toEqual({
      type: 'xor',
      left: { type: 'var', name: 'A' },
      right: { type: 'var', name: 'B' },
    })
  })

  it('parses XOR with +', () => {
    const ast = parseFormula('A + B')
    expect(ast).toEqual({
      type: 'xor',
      left: { type: 'var', name: 'A' },
      right: { type: 'var', name: 'B' },
    })
  })

  it('parses XOR with !=', () => {
    const ast = parseFormula('A != B')
    expect(ast).toEqual({
      type: 'xor',
      left: { type: 'var', name: 'A' },
      right: { type: 'var', name: 'B' },
    })
  })

  it('parses OR', () => {
    const ast = parseFormula('A | B')
    expect(ast).toEqual({
      type: 'or',
      left: { type: 'var', name: 'A' },
      right: { type: 'var', name: 'B' },
    })
  })

  it('parses EQ (biconditional)', () => {
    const ast = parseFormula('A = B')
    expect(ast).toEqual({
      type: 'eq',
      left: { type: 'var', name: 'A' },
      right: { type: 'var', name: 'B' },
    })
  })

  it('parses IMPLIES', () => {
    const ast = parseFormula('A => B')
    expect(ast).toEqual({
      type: 'implies',
      left: { type: 'var', name: 'A' },
      right: { type: 'var', name: 'B' },
    })
  })

  it('parses REV_IMPLIES as flipped implies', () => {
    const ast = parseFormula('A <= B')
    expect(ast).toEqual({
      type: 'implies',
      left: { type: 'var', name: 'B' },
      right: { type: 'var', name: 'A' },
    })
  })

  it('respects precedence: NOT > AND', () => {
    const ast = parseFormula('!A & B')
    expect(ast).toEqual({
      type: 'and',
      left: { type: 'not', operand: { type: 'var', name: 'A' } },
      right: { type: 'var', name: 'B' },
    })
  })

  it('respects precedence: AND > XOR', () => {
    const ast = parseFormula('A & B ^ C')
    expect(ast).toEqual({
      type: 'xor',
      left: {
        type: 'and',
        left: { type: 'var', name: 'A' },
        right: { type: 'var', name: 'B' },
      },
      right: { type: 'var', name: 'C' },
    })
  })

  it('respects precedence: XOR > OR', () => {
    const ast = parseFormula('A ^ B | C')
    expect(ast).toEqual({
      type: 'or',
      left: {
        type: 'xor',
        left: { type: 'var', name: 'A' },
        right: { type: 'var', name: 'B' },
      },
      right: { type: 'var', name: 'C' },
    })
  })

  it('respects precedence: OR > EQ', () => {
    const ast = parseFormula('A | B = C')
    expect(ast).toEqual({
      type: 'eq',
      left: {
        type: 'or',
        left: { type: 'var', name: 'A' },
        right: { type: 'var', name: 'B' },
      },
      right: { type: 'var', name: 'C' },
    })
  })

  it('respects precedence: EQ > IMPLIES', () => {
    const ast = parseFormula('A = B => C')
    expect(ast).toEqual({
      type: 'implies',
      left: {
        type: 'eq',
        left: { type: 'var', name: 'A' },
        right: { type: 'var', name: 'B' },
      },
      right: { type: 'var', name: 'C' },
    })
  })

  it('handles parentheses overriding precedence', () => {
    const ast = parseFormula('A & (B | C)')
    expect(ast).toEqual({
      type: 'and',
      left: { type: 'var', name: 'A' },
      right: {
        type: 'or',
        left: { type: 'var', name: 'B' },
        right: { type: 'var', name: 'C' },
      },
    })
  })

  it('handles nested parentheses', () => {
    const ast = parseFormula('((A))')
    expect(ast).toEqual({ type: 'var', name: 'A' })
  })

  it('left-associates chained AND', () => {
    const ast = parseFormula('A & B & C')
    expect(ast).toEqual({
      type: 'and',
      left: {
        type: 'and',
        left: { type: 'var', name: 'A' },
        right: { type: 'var', name: 'B' },
      },
      right: { type: 'var', name: 'C' },
    })
  })

  it('left-associates chained implies', () => {
    const ast = parseFormula('A => B => C')
    expect(ast).toEqual({
      type: 'implies',
      left: {
        type: 'implies',
        left: { type: 'var', name: 'A' },
        right: { type: 'var', name: 'B' },
      },
      right: { type: 'var', name: 'C' },
    })
  })

  it('throws on empty formula', () => {
    expect(() => parseFormula('')).toThrow(FormulaError)
  })

  it('throws on unmatched open paren', () => {
    expect(() => parseFormula('(A')).toThrow(FormulaError)
  })

  it('throws on unmatched close paren', () => {
    expect(() => parseFormula('A)')).toThrow(FormulaError)
  })

  it('throws on missing operand', () => {
    expect(() => parseFormula('A &')).toThrow(FormulaError)
  })

  it('throws on leading binary operator', () => {
    expect(() => parseFormula('& A')).toThrow(FormulaError)
  })
})

// ── Variable extraction ──────────────────────────────────────────────────────

describe('extractVariables', () => {
  it('extracts variables from a complex formula', () => {
    const ast = parseFormula('A & B | !C => D')
    const vars = extractVariables(ast)
    expect(vars.sort()).toEqual(['A', 'B', 'C', 'D'])
  })

  it('deduplicates variables', () => {
    const ast = parseFormula('A & A')
    expect(extractVariables(ast)).toEqual(['A'])
  })

  it('extracts from a single variable', () => {
    const ast = parseFormula('X')
    expect(extractVariables(ast)).toEqual(['X'])
  })
})

// ── Player prefix resolution ─────────────────────────────────────────────────

const players: Player[] = [
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Bob' },
  { id: 'p3', name: 'Carol' },
]

describe('resolvePlayerPrefix', () => {
  it('resolves exact match', () => {
    const result = resolvePlayerPrefix('Alice', players)
    expect(result).toEqual({ ok: true, player: players[0] })
  })

  it('resolves prefix match', () => {
    const result = resolvePlayerPrefix('Al', players)
    expect(result).toEqual({ ok: true, player: players[0] })
  })

  it('resolves single-char prefix', () => {
    const result = resolvePlayerPrefix('B', players)
    expect(result).toEqual({ ok: true, player: players[1] })
  })

  it('is case-insensitive', () => {
    const result = resolvePlayerPrefix('al', players)
    expect(result).toEqual({ ok: true, player: players[0] })
  })

  it('returns not_found for no match', () => {
    const result = resolvePlayerPrefix('Zach', players)
    expect(result).toEqual({ ok: false, reason: 'not_found', prefix: 'Zach' })
  })

  it('returns ambiguous for multiple matches', () => {
    const playersWithAmbiguity: Player[] = [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Alicia' },
    ]
    const result = resolvePlayerPrefix('Al', playersWithAmbiguity)
    expect(result).toEqual({
      ok: false,
      reason: 'ambiguous',
      prefix: 'Al',
      matches: ['Alice', 'Alicia'],
    })
  })
})

// ── Compilation + evaluation ─────────────────────────────────────────────────

describe('compileAst', () => {
  function makeEvaluator(formula: string, playerList: Player[]): (coloring: number) => boolean {
    const ast = parseFormula(formula)
    const indexMap = new Map(playerList.map((p, i) => [p.name, i]))

    function resolve(varName: string): number {
      const normalizedPrefix = varName.toLowerCase()
      const matchedPlayer = playerList.find((p) => p.name.toLowerCase().startsWith(normalizedPrefix))
      const index = matchedPlayer !== undefined ? indexMap.get(matchedPlayer.name) : undefined
      if (index === undefined) throw new Error(`Unknown var: ${varName}`)
      return index
    }

    return compileAst(ast, resolve)
  }

  const twoPlayers: Player[] = [
    { id: 'p1', name: 'Alice' },
    { id: 'p2', name: 'Bob' },
  ]

  // Coloring bits: bit 0 = Alice, bit 1 = Bob
  // 0b00 = both blue, 0b01 = Alice red, 0b10 = Bob red, 0b11 = both red

  it('evaluates variable (is red)', () => {
    const fn = makeEvaluator('Alice', twoPlayers)
    expect(fn(0b00)).toBe(false) // Alice blue
    expect(fn(0b01)).toBe(true) // Alice red
    expect(fn(0b10)).toBe(false) // Alice blue
    expect(fn(0b11)).toBe(true) // Alice red
  })

  it('evaluates NOT', () => {
    const fn = makeEvaluator('!Alice', twoPlayers)
    expect(fn(0b00)).toBe(true) // Alice blue → NOT red → true
    expect(fn(0b01)).toBe(false) // Alice red → false
  })

  it('evaluates AND: both red', () => {
    const fn = makeEvaluator('Al & Bob', twoPlayers)
    expect(fn(0b00)).toBe(false)
    expect(fn(0b01)).toBe(false)
    expect(fn(0b10)).toBe(false)
    expect(fn(0b11)).toBe(true)
  })

  it('evaluates OR: at least one red', () => {
    const fn = makeEvaluator('Al | Bob', twoPlayers)
    expect(fn(0b00)).toBe(false)
    expect(fn(0b01)).toBe(true)
    expect(fn(0b10)).toBe(true)
    expect(fn(0b11)).toBe(true)
  })

  it('evaluates XOR (^): different color', () => {
    const fn = makeEvaluator('Al ^ Bob', twoPlayers)
    expect(fn(0b00)).toBe(false)
    expect(fn(0b01)).toBe(true)
    expect(fn(0b10)).toBe(true)
    expect(fn(0b11)).toBe(false)
  })

  it('evaluates EQ (=): same color', () => {
    const fn = makeEvaluator('Al = Bob', twoPlayers)
    expect(fn(0b00)).toBe(true) // both blue
    expect(fn(0b01)).toBe(false)
    expect(fn(0b10)).toBe(false)
    expect(fn(0b11)).toBe(true) // both red
  })

  it('evaluates IMPLIES (=>)', () => {
    const fn = makeEvaluator('Al => Bob', twoPlayers)
    expect(fn(0b00)).toBe(true) // both blue → F => F = T
    // 0b01 = Alice red (bit0=1), Bob blue (bit1=0)
    // Alice red => Bob red? Alice is red, Bob is blue → false
    expect(fn(0b01)).toBe(false)
    expect(fn(0b10)).toBe(true) // Alice blue => Bob red? Alice not red, so vacuously true
    expect(fn(0b11)).toBe(true) // Both red → true
  })

  it('evaluates reverse implies (<=)', () => {
    // A <= B means B => A
    const fn = makeEvaluator('Al <= Bob', twoPlayers)
    // Bob => Alice
    expect(fn(0b00)).toBe(true) // Bob blue → vacuously true
    expect(fn(0b01)).toBe(true) // Bob blue → vacuously true
    expect(fn(0b10)).toBe(false) // Bob red, Alice blue → false
    expect(fn(0b11)).toBe(true) // Both red → true
  })

  it('evaluates complex formula: !(A & B) = (A ^ B | !A)', () => {
    const fn = makeEvaluator('!(Al & Bob) = (Al ^ Bob | !Al)', twoPlayers)
    // Check all 4 colorings — this should evaluate the boolean identity
    for (let c = 0; c < 4; c++) {
      const aRed = (c & 1) === 1
      const bRed = (c & 2) === 2
      const left = !(aRed && bRed)
      const right = (aRed !== bRed) || !aRed
      expect(fn(c)).toBe(left === right)
    }
  })

  it('evaluates prefix resolution: Al resolves to Alice', () => {
    const fn = makeEvaluator('Al', twoPlayers)
    expect(fn(0b01)).toBe(true) // Alice red
    expect(fn(0b00)).toBe(false) // Alice blue
  })

  it('works with three players', () => {
    const threePlayers: Player[] = [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' },
      { id: 'p3', name: 'Carol' },
    ]
    // bit 0 = Alice, bit 1 = Bob, bit 2 = Carol
    const fn = makeEvaluator('Al & B => C', threePlayers)
    // Alice red AND Bob red => Carol red
    expect(fn(0b000)).toBe(true) // neither red, vacuously true
    expect(fn(0b011)).toBe(false) // Alice+Bob red, Carol blue → false
    expect(fn(0b111)).toBe(true) // all red → true
    expect(fn(0b100)).toBe(true) // only Carol red, premise false → true
  })
})

// ── Validation ───────────────────────────────────────────────────────────────

describe('validateFormula', () => {
  it('returns ok for valid formula', () => {
    const result = validateFormula('Al ^ Bob', players)
    expect(result.ok).toBe(true)
  })

  it('returns error for ambiguous prefix', () => {
    const ambiguousPlayers: Player[] = [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Alicia' },
    ]
    const result = validateFormula('Al ^ Bob', ambiguousPlayers)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Ambiguous')
    }
  })

  it('returns error for unknown prefix', () => {
    const result = validateFormula('Al ^ Zach', players)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Unknown')
    }
  })

  it('returns error for syntax error', () => {
    const result = validateFormula('A & & B', players)
    expect(result.ok).toBe(false)
  })

  it('returns error for empty formula', () => {
    const result = validateFormula('', players)
    expect(result.ok).toBe(false)
  })
})

// ── Add-player ambiguity check ───────────────────────────────────────────────

describe('wouldPlayerMakeFormulasAmbiguous', () => {
  it('detects ambiguity when new player shares prefix', () => {
    const existingPlayers: Player[] = [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' },
    ]
    const newPlayer: Player = { id: 'p3', name: 'Alicia' }
    const result = wouldPlayerMakeFormulasAmbiguous(['Al ^ Bob'], existingPlayers, newPlayer)
    expect(result).not.toBeNull()
    expect(result).toContain('Al')
  })

  it('returns null when no ambiguity', () => {
    const existingPlayers: Player[] = [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' },
    ]
    const newPlayer: Player = { id: 'p3', name: 'Carol' }
    const result = wouldPlayerMakeFormulasAmbiguous(['Al ^ Bob'], existingPlayers, newPlayer)
    expect(result).toBeNull()
  })

  it('ignores formulas that fail to parse', () => {
    const existingPlayers: Player[] = [{ id: 'p1', name: 'Alice' }]
    const newPlayer: Player = { id: 'p2', name: 'Alicia' }
    const result = wouldPlayerMakeFormulasAmbiguous(['& invalid'], existingPlayers, newPlayer)
    expect(result).toBeNull()
  })
})

// ── Rename ambiguity check ───────────────────────────────────────────────────

describe('wouldRenameMakeFormulasAmbiguous', () => {
  it('detects ambiguity when rename creates prefix collision', () => {
    const existingPlayers: Player[] = [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' },
    ]
    const result = wouldRenameMakeFormulasAmbiguous(
      ['Al ^ Bob'],
      existingPlayers,
      'p2',
      'Alicia',
    )
    expect(result).not.toBeNull()
  })

  it('detects unresolvable prefix when player renamed away', () => {
    const existingPlayers: Player[] = [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' },
    ]
    const result = wouldRenameMakeFormulasAmbiguous(
      ['Al ^ Bob'],
      existingPlayers,
      'p1',
      'Zach',
    )
    expect(result).not.toBeNull()
  })

  it('returns null when rename is safe', () => {
    const existingPlayers: Player[] = [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' },
    ]
    const result = wouldRenameMakeFormulasAmbiguous(
      ['Al ^ Bob'],
      existingPlayers,
      'p2',
      'Bobby',
    )
    expect(result).toBeNull()
  })
})
