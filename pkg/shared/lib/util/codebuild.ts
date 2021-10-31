export const outputBuiltInfo = (builtInfo: Record<string, string>): void => {
  Object.entries(builtInfo).forEach(([key, value]) => {
    if (key.match(/[=\n\r]/) != null) throw new Error(`Key "${key}" is not valid.`);
    if (value.match(/[\n\r]/) != null) throw new Error(`Key "${value}" is not valid.`);
    // eslint-disable-next-line no-console
    console.log(`!output=${key}=${value}`);
  });
};
