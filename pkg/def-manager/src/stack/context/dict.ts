export interface DictContext<T> {
  add(name: string, v: T): T;
  get(name: string): T;
  getAll(): [name: string, value: T][];
}
export const createDictContext = <T>(): DictContext<T> => {
  const dict: Record<string, T> = Object.create(null);
  let used = false;
  const add = (name: string, v: T): T => {
    if (used) throw new Error('add after usage');
    if (name in dict) throw new Error(`name "${name}" is already in use`);
    dict[name] = v;
    return v;
  };
  const get = (name: string): T => {
    used = true;
    if (!(name in dict)) throw new Error(`name "${name}" is not present`);
    return dict[name];
  };
  const getAll = (): [name: string, value: T][] => {
    used = true;
    return Object.entries(dict);
  };
  return {
    add,
    get,
    getAll,
  };
};
