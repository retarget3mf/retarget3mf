/** The open command a Windows URL handler registers, split into program and arguments with `%1` replaced by the link. */
export function windowsCommand(command: string, link: string): { file: string; args: string[] } | undefined {
  const parts = [...command.matchAll(/"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2]!);
  const [file, ...rest] = parts;
  if (!file) return undefined;
  const args = rest.map((a) => a.replace(/%1/g, link));
  return { file, args: rest.some((a) => a.includes('%1')) ? args : [...args, link] };
}

/** The default value from `reg query <key> /ve` output; Windows localises the "(Default)" label, so any parenthesised name matches. */
export function regDefaultValue(output: string): string | undefined {
  return output.match(/^\s*\([^)]+\)\s+REG_(?:EXPAND_)?SZ\s+(.*?)\s*$/m)?.[1];
}
