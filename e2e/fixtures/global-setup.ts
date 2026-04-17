import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

export default function globalSetup(): void {
  const _dir = path.dirname(fileURLToPath(import.meta.url));
  const envFile = path.resolve(_dir, '../.env.test');
  if (fs.existsSync(envFile)) {
    // Node 20.12+ built-in env file loader
    (process as NodeJS.Process & { loadEnvFile?: (path: string) => void }).loadEnvFile?.(envFile);
  }
}
