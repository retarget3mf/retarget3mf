type Json = Record<string, unknown>;

/**
 * compatible_printers_condition as Prusa's profiles use it: terms joined by `and`, each `key=~/re/`, `key!~/re/`,
 * `key[i]==value` / `!=` or a bare boolean key. Regexes match the whole value, like the slicer's. Other forms throw.
 */
export function matchesCondition(condition: string, machine: Json): boolean {
  const value = (key: string, index = 0) => {
    const v = machine[key];
    return String(Array.isArray(v) ? (v[index] ?? '') : (v ?? ''));
  };
  return condition.trim().split(/\s+and\s+/).every((term) => {
    const regex = term.match(/^(\w+)\s*(=~|!~)\s*\/(.*)\/$/);
    if (regex) return new RegExp(`^(?:${regex[3]})$`, 's').test(value(regex[1]!)) === (regex[2] === '=~');
    const compare = term.match(/^(\w+)(?:\[(\d+)\])?\s*(==|!=)\s*"?([^"]*)"?$/);
    if (compare) {
      const [actual, expected] = [value(compare[1]!, Number(compare[2] ?? 0)), compare[4]!];
      const equal = actual === expected || (actual !== '' && Number(actual) === Number(expected));
      return equal === (compare[3] === '==');
    }
    if (/^\w+$/.test(term)) return value(term) === '1';
    throw new Error(`unsupported compatible_printers_condition term: ${term}`);
  });
}
