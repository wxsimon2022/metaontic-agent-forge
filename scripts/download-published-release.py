"""Reuse the exact Gitee tgz for a GitHub mirror (CI tooling only)."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import tarfile


def verify_artifacts(version, folder, expected_sha256):
    if not re.fullmatch(r'[a-fA-F0-9]{64}', expected_sha256):
        raise ValueError('An original tgz SHA256 is required')
    archive = folder / f'metaontic-video-{version}.tgz'
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == expected_sha256.lower(), 'Original tgz checksum mismatch'
    with tarfile.open(archive) as bundle:
        package = json.load(bundle.extractfile('package/package.json'))
    assert package['version'] == version and package['releaseNotes']['version'] == version
    assert package['releaseNotes'].get('prerelease') is False


def main():
    version, output, expected_sha256 = sys.argv[1:4]
    if not re.fullmatch(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', version):
        raise ValueError('Expected stable X.Y.Z version')
    if not re.fullmatch(r'[a-fA-F0-9]{64}', expected_sha256):
        raise ValueError('An original tgz SHA256 is required')
    folder = Path(output)
    folder.mkdir(parents=True, exist_ok=True)
    archive = f'metaontic-video-{version}.tgz'
    url = f'https://gitee.com/hadlooop/metaontic-agent-forge/releases/download/v{version}/{archive}'
    subprocess.run(['curl', '--fail', '--location', '--silent', '--show-error', '--retry', '3',
                    '--connect-timeout', '30', '--max-time', '180', '--output', str(folder / archive), url], check=True)
    verify_artifacts(version, folder, expected_sha256)
    print(f'Exact published tgz verified: v{version}')


if __name__ == '__main__':
    main()
