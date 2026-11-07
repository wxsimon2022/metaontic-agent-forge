import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('mirror verifies original tgz checksum and stable package identity', () => {
 const code = `
import runpy, sys, tempfile, tarfile, json, hashlib, io
from pathlib import Path
verify = runpy.run_path(sys.argv[1])['verify_artifacts']
with tempfile.TemporaryDirectory() as tmp:
 p=Path(tmp); v='1.2.3'; a=p/f'metaontic-video-{v}.tgz'
 def setup(version='1.2.3'):
  data=json.dumps({'version':version,'releaseNotes':{'version':version,'prerelease':False}}).encode()
  with tarfile.open(a,'w:gz') as f:
   info=tarfile.TarInfo('package/package.json'); info.size=len(data); f.addfile(info,io.BytesIO(data))
  return hashlib.sha256(a.read_bytes()).hexdigest()
 def rejects(digest):
  try: verify(v,p,digest)
  except AssertionError: return
  raise Exception('invalid artifacts accepted')
 digest=setup(); verify(v,p,digest)
 rejects('0'*64)
 digest=setup(version='1.2.4'); rejects(digest)
`;
 execFileSync(process.platform === 'win32' ? 'python' : 'python3', ['-c', code, fileURLToPath(new URL('../scripts/download-published-release.py', import.meta.url))]);
});
