export interface Command {
  args: string[];
}

export const parseComment = (body: string, botName: string): Command[] => {
  const lines = body.split(/[\r\n]+/).map((line) => line.trim());
  if (lines.length === 0) return [];
  if (parseDirective(lines[0]) === 'ignore') return [];
  const pat = /^@\S+\s+(.*)$/;
  const cmds: Command[] = [];
  lines
    .filter((line) => line.startsWith(`@${botName} `))
    .forEach((line) => {
      const cmd = line.match(pat)?.[1];
      if (typeof cmd === 'string') {
        cmds.push({ args: cmd.split(/\s+/) });
      }
    });
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
