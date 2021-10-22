export interface Command {
  args: string[];
}

export const parseComment = (body: string, botPrefix: string): Command[] => {
  const lines = body.split(/[\r\n]+/);
  if (lines.length === 0) return [];
  if (parseDirective(lines[0]) === 'ignore') return [];
  const cmds: Command[] = lines
    .filter((line) => line.startsWith(botPrefix))
    .map((line) => line.slice(botPrefix.length))
    .map((line) => ({ args: line.split(/\s+/) }));
  return cmds;
};

export const parseDirective = (line: string): string | null => {
  const pat = /^\s*<!--\s*violet\s*:\s*(.*?)\s*-->\s*$/;
  return line.match(pat)?.[1] ?? null;
};

export const embedDirective = (what: string): string => {
  if (!what.match(/[-0-9a-zA-Z:=_*&^%$#;{}"'/[\]]/)) throw new Error(`Illegal directive ${what}`);
  return `<!-- violet: ${what} -->`;
};
