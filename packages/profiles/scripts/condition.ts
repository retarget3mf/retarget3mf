type Json = Record<string, unknown>;

const TOKEN = /\s*(\/(?:\\.|[^/])*\/|"[^"]*"|&&|\|\||==|!=|>=|<=|=~|!~|[()!<>]|[\w.]+(?:\[\d+\])?)/y;

function tokenize(condition: string): string[] {
  const tokens: string[] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < condition.trimEnd().length) {
    const start = TOKEN.lastIndex;
    const m = TOKEN.exec(condition);
    if (!m) throw new Error(`unsupported compatible_printers_condition near: ${condition.slice(start)}`);
    tokens.push(m[1] === '&&' ? 'and' : m[1] === '||' ? 'or' : m[1]!);
  }
  return tokens;
}

/**
 * compatible_printers_condition as Prusa's profiles use it: `key=~/re/`, `key!~/re/`, comparisons (`key[i]==value`,
 * `!=`, `<`, `>`, `<=`, `>=`), bare boolean keys, `!`/`not`, `and`/`&&`, `or`/`||` and parentheses. Regexes match the whole
 * value, like the slicer's. Anything else throws.
 */
export function matchesCondition(condition: string, machine: Json): boolean {
  const tokens = tokenize(condition);
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => {
    const t = tokens[pos++];
    if (t === undefined) throw new Error(`unsupported compatible_printers_condition (truncated): ${condition}`);
    return t;
  };
  const value = (ref: string) => {
    const [, key, index] = ref.match(/^(\w+)(?:\[(\d+)\])?$/) ?? [];
    if (!key) throw new Error(`unsupported compatible_printers_condition term: ${ref}`);
    const v = machine[key];
    return String(Array.isArray(v) ? (v[Number(index ?? 0)] ?? '') : (v ?? ''));
  };
  const compare = (actual: string, op: string, raw: string): boolean => {
    if (op === '=~' || op === '!~') {
      if (!/^\/.*\/$/s.test(raw)) throw new Error(`unsupported compatible_printers_condition regex: ${raw}`);
      return new RegExp(`^(?:${raw.slice(1, -1)})$`, 's').test(actual) === (op === '=~');
    }
    const expected = raw.replace(/^"|"$/g, '');
    const numeric = actual !== '' && expected !== '' && !Number.isNaN(Number(actual)) && !Number.isNaN(Number(expected));
    const [a, b] = numeric ? [Number(actual), Number(expected)] : [actual, expected];
    switch (op) {
      case '==': return a === b;
      case '!=': return a !== b;
      case '<': return a < b;
      case '>': return a > b;
      case '<=': return a <= b;
      default: return a >= b;
    }
  };
  const primary = (): boolean => {
    const t = next();
    if (t === '!' || t === 'not') return !primary();
    if (t === '(') {
      const v = or();
      if (next() !== ')') throw new Error(`unsupported compatible_printers_condition (unbalanced): ${condition}`);
      return v;
    }
    const op = peek();
    if (op && ['==', '!=', '<', '>', '<=', '>=', '=~', '!~'].includes(op)) {
      pos++;
      return compare(value(t), op, next());
    }
    return value(t) === '1';
  };
  const and = (): boolean => {
    let v = primary();
    while (peek() === 'and') { pos++; v = primary() && v; }
    return v;
  };
  const or = (): boolean => {
    let v = and();
    while (peek() === 'or') { pos++; v = and() || v; }
    return v;
  };
  const result = or();
  if (pos !== tokens.length) throw new Error(`unsupported compatible_printers_condition term: ${tokens.slice(pos).join(' ')}`);
  return result;
}
