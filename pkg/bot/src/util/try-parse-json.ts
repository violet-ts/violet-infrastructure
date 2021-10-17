export const tryParseJSON = (json: string): unknown => {
  try {
    return JSON.parse(json);
  } catch (_e: unknown) {
    return undefined;
  }
};
