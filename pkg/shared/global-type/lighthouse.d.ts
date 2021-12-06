/* eslint-disable import/no-duplicates */
declare module 'lighthouse' {
  import type { CliFlags, RunnerResult } from 'lighthouse/types/externs';

  export type LighthouseOptions = Partial<CliFlags> & Pick<CliFlags, 'output' | 'port'>;
  const lighthouse: (url: string, options?: LighthouseOptions, configJSON?: CliFlags) => Promise<RunnerResult>;
  export = lighthouse;
}

declare module 'lighthouse/lighthouse-core/config/desktop-config' {
  import type { CliFlags } from 'lighthouse/types/externs';

  const configJson: CliFlags;
  export default configJson;
}
/* eslint-enable import/no-duplicates */
