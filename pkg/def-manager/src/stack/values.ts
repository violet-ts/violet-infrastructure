import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { PROJECT_NAME } from '@self/shared/lib/const';
import { ensurePath } from '@self/shared/lib/def/util/ensure-path';
import type { Section } from '@self/shared/lib/def/types';
import { botSecretsSchema } from '@self/shared/lib/bot/env';

export const genTags = (name: string | null, section?: Section | null): Record<string, string> => {
  const tags: Record<string, string> = {
    Project: PROJECT_NAME,
    /** マネージャ層であることを示すフラグ */
    Manager: 'true',
    /** IaC で管理している、というフラグ */
    Managed: 'true',
  };
  if (name != null) tags.Name = name;
  if (section != null) tags.Section = section;
  return tags;
};

const rootDir = path.resolve(__dirname, '..', '..', '..', '..');
export const dataDir = path.resolve(__dirname, '..', '..', 'data');
export const botBuildDir = ensurePath(path.resolve(rootDir, 'pkg', 'bot', 'build'));
export const botPrivateKeyPath = ensurePath(path.resolve(rootDir, 'pkg', 'bot', 'private-key.pem.local'));
export const botPrivateKey = fs.readFileSync(botPrivateKeyPath).toString();
export const botEnvFilePath = ensurePath(path.resolve(rootDir, 'pkg', 'bot', '.env.deploy.local'));
export const botEnvFile = fs.readFileSync(botEnvFilePath).toString();
export const botEnv = Object.entries(
  botSecretsSchema.parse({
    ...dotenv.parse(botEnvFile),
    BOT_PRIVATE_KEY: botPrivateKey,
  }),
);
