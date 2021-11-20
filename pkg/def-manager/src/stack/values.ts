import { botSecretsSchema } from '@self/shared/lib/bot/env';
import { ensureJsonString, ensurePath } from '@self/shared/lib/def/util/ensure-path';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

const rootDir = path.resolve(__dirname, '..', '..', '..', '..');
export const dataDir = path.resolve(__dirname, '..', '..', 'data');
export const botBuildDir = ensurePath(path.resolve(rootDir, 'pkg', 'bot', 'build'));
export const sharedScriptsDir = ensurePath(path.resolve(rootDir, 'pkg', 'shared', 'scripts'));
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
export const gcipConfigDevJsonPath = ensurePath(path.resolve(rootDir, 'pkg', 'bot', 'gcip-config-dev.local.json'));
export const gcipConfigDevJson = ensureJsonString(fs.readFileSync(gcipConfigDevJsonPath).toString());
