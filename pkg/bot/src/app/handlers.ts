import codebuild from '../handler/codebuild';
import type { CallbackHandler } from '../type/handler';

export const handlers: CallbackHandler[] = [codebuild];
