import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { ensurePath } from '../../util/ensure-path';
import { PROJECT_NAME } from '../../const';
import type { Section } from '../types';

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

export const rootDir = path.resolve(__dirname, '..', '..', '..');
export const defRootDir = path.resolve(__dirname, '..');
export const botBuildDir = ensurePath(path.resolve(rootDir, 'pkg', 'bot', 'build'));
export const botPrivateKeyPath = ensurePath(path.resolve(rootDir, 'pkg', 'bot', 'private-key.pem.local'));
export const botPrivateKey = fs.readFileSync(botPrivateKeyPath).toString();
export const botEnvFilePath = ensurePath(path.resolve(rootDir, 'pkg', 'bot', '.env.deploy.local'));
export const botEnvFile = fs.readFileSync(botEnvFilePath).toString();
export const botEnv = Object.entries({ ...dotenv.parse(botEnvFile), BOT_PRIVATE_KEY: botPrivateKey });
