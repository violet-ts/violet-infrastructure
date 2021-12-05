import extractZip from 'extract-zip';
import * as fs from 'fs';
import fetch from 'node-fetch';
import * as os from 'os';
import * as path from 'path';

const violetInfraCacheDir = path.resolve(os.homedir(), 'violet-infra-cache');

interface SetupChromeParams {
  installDirPath: string;
}
/**
 * @see https://github.com/GoogleChrome/chrome-launcher
 * @see https://raw.githubusercontent.com/GoogleChrome/chrome-launcher/v0.14.1/scripts/download-chrome.sh
 */
export const setupChrome = async ({ installDirPath }: SetupChromeParams): Promise<string> => {
  const windowsZipUrl = `https://download-chromium.appspot.com/dl/Win?type=snapshots`;
  const linuxZipUrl = `https://download-chromium.appspot.com/dl/Linux_x64?type=snapshots`;
  const isWin = os.platform() === 'win32';
  const zipUrl = isWin ? windowsZipUrl : linuxZipUrl;
  const zipPath = path.resolve(installDirPath, 'chrome.zip');
  const res = await fetch(zipUrl);
  res.body.pipe(fs.createWriteStream(zipPath));
  await new Promise((resolve) => res.body.once('finish', resolve));
  await extractZip(zipPath, { dir: installDirPath });
  await fs.promises.rm(zipPath, { force: true, maxRetries: 3 });
  const chromeDirPath = path.resolve(installDirPath, isWin ? 'chrome-win' : 'chrome-linux');
  const chromePath = path.resolve(chromeDirPath, isWin ? 'chrome.exe' : 'chrome');
  return chromePath;
};

export const setupCachedChrome = async (): Promise<string> => {
  if (process.env.LH_CHROME_PATH) {
    return process.env.LH_CHROME_PATH;
  }
  const isWin = os.platform() === 'win32';
  const installDirPath = path.resolve(violetInfraCacheDir, 'chrome');
  const chromeDirPath = path.resolve(installDirPath, isWin ? 'chrome-win' : 'chrome-linux');
  const chromePath = path.resolve(chromeDirPath, isWin ? 'chrome.exe' : 'chrome');
  if (
    await fs.promises
      .stat(chromePath)
      .then((e) => !e.isDirectory)
      .catch(() => false)
  )
    return chromePath;
  await fs.promises.mkdir(installDirPath, { recursive: true });
  await setupChrome({
    installDirPath,
  });
  return chromePath;
};
