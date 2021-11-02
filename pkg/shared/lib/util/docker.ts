const unsafePat = /[*'\n\r\t$]/;

/**
 * Dockerfile の ARG を埋め込むための "--build-arg" arguments を返す
 */
export const embedArgsBuildArgs = (args: Record<string, string>): string => {
  return Object.entries(args)
    .map(([arg, value]) => {
      if (arg.match(unsafePat)) throw new Error(`value "${arg}" is unsafe for shell`);
      if (value.match(unsafePat)) throw new Error(`value "${value}" is unsafe for shell`);
      return `--build-arg '${arg}=${value}'`;
    })
    .join(' ');
};
