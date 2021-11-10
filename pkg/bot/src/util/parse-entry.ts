// FullEntryForTypeCheck は型チェック時に GeneralEntry + 実際の個々の定義として振る舞うようにする
// 実際に zod ではこれを検証できないので、 GeneralEntry であると検証できたら FullEntryForTypeCheck とみなす
// もちろん、そういう場面でしかつかってはならない

import type { FullEntryForTypeCheck } from '@self/bot/src/type/cmd';
import { generalEntrySchema } from '@self/bot/src/type/cmd';
import 'source-map-support/register';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const parseFullEntryForTypeCheck = (entry: unknown): FullEntryForTypeCheck => {
  const fullEntryForTypeCheck: FullEntryForTypeCheck = generalEntrySchema.passthrough().parse(entry) as any;
  return fullEntryForTypeCheck;
};
/* eslint-enable @typescript-eslint/no-explicit-any */
