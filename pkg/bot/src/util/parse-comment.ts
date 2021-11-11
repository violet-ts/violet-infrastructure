export const parseComment = (body: string, botPrefix: string): string[][][] => {
  const lines = body.split(/\r\n|\n|\r/);
  if (lines.length === 0) return [];
  if (parseDirective(lines[0]) === 'ignore') return [];
  const cmds: string[][][] = [[]];
  lines.forEach((line) => {
    if (line.trim() === '') {
      cmds.push([]);
    } else if (line.startsWith(botPrefix)) {
      cmds[cmds.length - 1].push(line.slice(botPrefix.length).split(/\s+/));
    }
  });
  return cmds.filter((cmd) => cmd.length);
};

export const parseDirective = (line: string): string | null => {
  const pat = /^\s*<!--\s*violet\s*:\s*(.*?)\s*-->\s*$/;
  return line.match(pat)?.[1] ?? null;
};

export const embedDirective = (what: string): string => {
  if (!what.match(/[-0-9a-zA-Z:=_*&^%$#;{}"'/[\]]/)) throw new Error(`Illegal directive ${what}`);
  return `<!-- violet: ${what} -->`;
};
