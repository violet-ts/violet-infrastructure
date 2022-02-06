export const requireEnv = <NAME extends string>(name: NAME): { [name in NAME]: string } => {
  const value = process.env[name] as string | undefined;
  if (typeof value !== 'string') throw new TypeError(`${name} is not string`);
  return { [name]: value } as any;
};
