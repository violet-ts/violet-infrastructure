import codebuild from '../handler/codebuild';
import type { CallbackHandler } from '../type/handler';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handlers: CallbackHandler[] = [codebuild] as any;
