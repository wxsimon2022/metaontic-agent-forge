import os from 'node:os';
import path from 'node:path';
/** 宿主数据目录，Windows/macOS 使用同一解析规则。 */
export function dshHome() {
  const fromEnv = String((typeof process !== 'undefined' && process.env?.DSH_HOME) || '').trim();
  return fromEnv || path.join(os.homedir(), '.dsh');
}
