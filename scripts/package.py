"""Validate and package the unpacked extension using only the standard library."""
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
extension = root / 'extension'
manifest = json.loads((extension / 'manifest.json').read_text())
assert manifest['manifest_version'] == 3
for script in manifest['content_scripts']:
    for name in script['js'] + script['css']:
        assert (extension / name).is_file(), name
for name in [manifest['action']['default_popup'], *manifest['icons'].values()]:
    assert (extension / name).is_file(), name
dist = root / 'dist'
dist.mkdir(exist_ok=True)
target = dist / f'funpay-helper-{manifest["version"]}.zip'
with ZipFile(target, 'w', ZIP_DEFLATED) as archive:
    for path in sorted(extension.rglob('*')):
        if path.is_file():
            archive.write(path, path.relative_to(extension))
print(target)
