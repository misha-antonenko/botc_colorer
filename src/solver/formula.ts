import type { Player } from './types'

// ── AST ──────────────────────────────────────────────────────────────────────

export type AstNode =
  | { type: 'var'; name: string }
  | { type: 'not'; operand: AstNode }
  | { type: 'and'; left: AstNode; right: AstNode }
  | { type: 'or'; left: AstNode; right: AstNode }
  | { type: 'xor'; left: AstNode; right: AstNode }
  | { type: 'eq'; left: AstNode; right: AstNode }
  | { type: 'implies'; left: AstNode; right: AstNode }

// ── Tokens ───────────────────────────────────────────────────────────────────

type TokenType =
  | 'IDENT'
  | 'NOT'
  | 'AND'
  | 'OR'
  | 'XOR'
  | 'EQ'
  | 'IMPLIES'
  | 'REV_IMPLIES'
  | 'LPAREN'
  | 'RPAREN'

interface Token {
  type: TokenType
  value: string
  position: number
}

const OPERATOR_CHARS = new Set('=><|!~^+&()')

function isWhitespace(char: string): boolean {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r'
}

function isOperatorChar(char: string): boolean {
  return OPERATOR_CHARS.has(char)
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < input.length) {
    if (isWhitespace(input[i])) {
      i += 1
      continue
    }

    const position = i

    switch (input[i]) {
      case '(':
        tokens.push({ type: 'LPAREN', value: '(', position })
        i += 1
        break
      case ')':
        tokens.push({ type: 'RPAREN', value: ')', position })
        i += 1
        break
      case '~':
        tokens.push({ type: 'NOT', value: '~', position })
        i += 1
        break
      case '&':
        tokens.push({ type: 'AND', value: '&', position })
        i += 1
        break
      case '|':
        tokens.push({ type: 'OR', value: '|', position })
        i += 1
        break
      case '^':
        tokens.push({ type: 'XOR', value: '^', position })
        i += 1
        break
      case '+':
        tokens.push({ type: 'XOR', value: '+', position })
        i += 1
        break
      case '=':
        if (i + 1 < input.length && input[i + 1] === '>') {
          tokens.push({ type: 'IMPLIES', value: '=>', position })
          i += 2
        } else {
          tokens.push({ type: 'EQ', value: '=', position })
          i += 1
        }
        break
      case '<':
        if (i + 1 < input.length && input[i + 1] === '=') {
          tokens.push({ type: 'REV_IMPLIES', value: '<=', position })
          i += 2
        } else {
          throw new FormulaError(`Unexpected character '<' at position ${i} (did you mean '<='?)`)
        }
        break
      case '!':
        if (i + 1 < input.length && input[i + 1] === '=') {
          tokens.push({ type: 'XOR', value: '!=', position })
          i += 2
        } else {
          tokens.push({ type: 'NOT', value: '!', position })
          i += 1
        }
        break
      case '>':
        throw new FormulaError(`Unexpected character '>' at position ${i} (did you mean '=>'?)`)
      default: {
        const start = i
        while (i < input.length && !isWhitespace(input[i]) && !isOperatorChar(input[i])) {
          i += 1
        }
        tokens.push({ type: 'IDENT', value: input.slice(start, i), position })
        break
      }
    }
  }

  return tokens
}

// ── Parser ───────────────────────────────────────────────────────────────────

export class FormulaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FormulaError'
  }
}

class Parser {
  private tokens: Token[]
  private pos = 0

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  parse(): AstNode {
    if (this.tokens.length === 0) {
      throw new FormulaError('Empty formula')
    }

    const result = this.parseImplication()

    if (this.pos < this.tokens.length) {
      const token = this.tokens[this.pos]
      throw new FormulaError(`Unexpected token '${token.value}' at position ${token.position}`)
    }

    return result
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos]
  }

  private advance(): Token {
    const token = this.tokens[this.pos]
    this.pos += 1
    return token
  }

  private parseImplication(): AstNode {
    let left = this.parseEquality()

    while (this.pos < this.tokens.length) {
      const token = this.peek()!
      if (token.type === 'IMPLIES') {
        this.advance()
        const right = this.parseEquality()
        left = { type: 'implies', left, right }
      } else if (token.type === 'REV_IMPLIES') {
        this.advance()
        const right = this.parseEquality()
        left = { type: 'implies', left: right, right: left }
      } else {
        break
      }
    }

    return left
  }

  private parseEquality(): AstNode {
    let left = this.parseDisjunction()

    while (this.pos < this.tokens.length) {
      const token = this.peek()!
      if (token.type !== 'EQ') break
      this.advance()
      const right = this.parseDisjunction()
      left = { type: 'eq', left, right }
    }

    return left
  }

  private parseDisjunction(): AstNode {
    let left = this.parseXor()

    while (this.pos < this.tokens.length) {
      const token = this.peek()!
      if (token.type !== 'OR') break
      this.advance()
      const right = this.parseXor()
      left = { type: 'or', left, right }
    }

    return left
  }

  private parseXor(): AstNode {
    let left = this.parseConjunction()

    while (this.pos < this.tokens.length) {
      const token = this.peek()!
      if (token.type !== 'XOR') break
      this.advance()
      const right = this.parseConjunction()
      left = { type: 'xor', left, right }
    }

    return left
  }

  private parseConjunction(): AstNode {
    let left = this.parseUnary()

    while (this.pos < this.tokens.length) {
      const token = this.peek()!
      if (token.type !== 'AND') break
      this.advance()
      const right = this.parseUnary()
      left = { type: 'and', left, right }
    }

    return left
  }

  private parseUnary(): AstNode {
    const token = this.peek()
    if (token !== undefined && token.type === 'NOT') {
      this.advance()
      const operand = this.parseUnary()
      return { type: 'not', operand }
    }
    return this.parsePrimary()
  }

  private parsePrimary(): AstNode {
    const token = this.peek()

    if (token === undefined) {
      throw new FormulaError('Unexpected end of formula')
    }

    if (token.type === 'IDENT') {
      this.advance()
      return { type: 'var', name: token.value }
    }

    if (token.type === 'LPAREN') {
      this.advance()
      const inner = this.parseImplication()
      const closing = this.peek()
      if (closing === undefined || closing.type !== 'RPAREN') {
        throw new FormulaError(`Expected ')' at position ${closing?.position ?? token.position + 1}`)
      }
      this.advance()
      return inner
    }

    throw new FormulaError(`Unexpected token '${token.value}' at position ${token.position}`)
  }
}

export function parseFormula(input: string): AstNode {
  const tokens = tokenize(input)
  return new Parser(tokens).parse()
}

// ── Variable extraction ──────────────────────────────────────────────────────

export function extractVariables(ast: AstNode): string[] {
  const vars = new Set<string>()

  function walk(node: AstNode): void {
    switch (node.type) {
      case 'var':
        vars.add(node.name)
        break
      case 'not':
        walk(node.operand)
        break
      default:
        walk(node.left)
        walk(node.right)
        break
    }
  }

  walk(ast)
  return [...vars]
}

// ── Player resolution ────────────────────────────────────────────────────────

export type ResolveResult =
  | { ok: true; player: Player }
  | { ok: false; reason: 'ambiguous'; prefix: string; matches: string[] }
  | { ok: false; reason: 'not_found'; prefix: string }

export function resolvePlayerPrefix(prefix: string, players: ReadonlyArray<Player>): ResolveResult {
  const normalizedPrefix = prefix.toLowerCase()
  const matches = players.filter((p) => p.name.toLowerCase().startsWith(normalizedPrefix))

  if (matches.length === 0) {
    return { ok: false, reason: 'not_found', prefix }
  }

  if (matches.length > 1) {
    return { ok: false, reason: 'ambiguous', prefix, matches: matches.map((m) => m.name) }
  }

  return { ok: true, player: matches[0] }
}

export interface ResolvedFormula {
  ast: AstNode
  playerMap: Map<string, Player>
}

export function resolveFormula(
  formula: string,
  players: ReadonlyArray<Player>,
): ResolvedFormula {
  const ast = parseFormula(formula)
  const variables = extractVariables(ast)
  const playerMap = new Map<string, Player>()

  for (const varName of variables) {
    const result = resolvePlayerPrefix(varName, players)

    if (!result.ok) {
      if (result.reason === 'ambiguous') {
        throw new FormulaError(
          `Ambiguous player prefix '${varName}': matches ${result.matches.join(', ')}`,
        )
      }
      throw new FormulaError(`Unknown player prefix '${varName}'`)
    }

    playerMap.set(varName, result.player)
  }

  return { ast, playerMap }
}

// ── Compilation (AST → efficient evaluator) ──────────────────────────────────

export type CompiledFormula = (coloring: number) => boolean

export function compileAst(
  ast: AstNode,
  getPlayerIndex: (varName: string) => number,
): CompiledFormula {
  switch (ast.type) {
    case 'var': {
      const pos = getPlayerIndex(ast.name)
      return (c) => ((c >> pos) & 1) === 1
    }
    case 'not': {
      const fn = compileAst(ast.operand, getPlayerIndex)
      return (c) => !fn(c)
    }
    case 'and': {
      const left = compileAst(ast.left, getPlayerIndex)
      const right = compileAst(ast.right, getPlayerIndex)
      return (c) => left(c) && right(c)
    }
    case 'or': {
      const left = compileAst(ast.left, getPlayerIndex)
      const right = compileAst(ast.right, getPlayerIndex)
      return (c) => left(c) || right(c)
    }
    case 'xor': {
      const left = compileAst(ast.left, getPlayerIndex)
      const right = compileAst(ast.right, getPlayerIndex)
      return (c) => left(c) !== right(c)
    }
    case 'eq': {
      const left = compileAst(ast.left, getPlayerIndex)
      const right = compileAst(ast.right, getPlayerIndex)
      return (c) => left(c) === right(c)
    }
    case 'implies': {
      const left = compileAst(ast.left, getPlayerIndex)
      const right = compileAst(ast.right, getPlayerIndex)
      return (c) => !left(c) || right(c)
    }
  }
}

// ── Validation helpers ───────────────────────────────────────────────────────

export function validateFormula(
  formula: string,
  players: ReadonlyArray<Player>,
): { ok: true; resolved: ResolvedFormula } | { ok: false; error: string } {
  try {
    const resolved = resolveFormula(formula, players)
    return { ok: true, resolved }
  } catch (error) {
    if (error instanceof FormulaError) {
      return { ok: false, error: error.message }
    }
    return { ok: false, error: String(error) }
  }
}

export function wouldPlayerMakeFormulasAmbiguous(
  formulas: string[],
  currentPlayers: ReadonlyArray<Player>,
  newPlayer: Player,
): string | null {
  const nextPlayers = [...currentPlayers, newPlayer]

  for (const formula of formulas) {
    let ast: AstNode
    try {
      ast = parseFormula(formula)
    } catch {
      continue
    }

    const variables = extractVariables(ast)

    for (const varName of variables) {
      const result = resolvePlayerPrefix(varName, nextPlayers)
      if (!result.ok && result.reason === 'ambiguous') {
        return `Adding player '${newPlayer.name}' makes prefix '${varName}' ambiguous in formula '${formula}'`
      }
    }
  }

  return null
}

export function wouldRenameMakeFormulasAmbiguous(
  formulas: string[],
  players: ReadonlyArray<Player>,
  playerId: string,
  newName: string,
): string | null {
  const nextPlayers = players.map((p) => (p.id === playerId ? { ...p, name: newName } : p))

  for (const formula of formulas) {
    let ast: AstNode
    try {
      ast = parseFormula(formula)
    } catch {
      continue
    }

    const variables = extractVariables(ast)

    for (const varName of variables) {
      const result = resolvePlayerPrefix(varName, nextPlayers)
      if (!result.ok) {
        return `Renaming to '${newName}' makes prefix '${varName}' ${result.reason === 'ambiguous' ? 'ambiguous' : 'unresolvable'} in formula '${formula}'`
      }
    }
  }

  return null
}
