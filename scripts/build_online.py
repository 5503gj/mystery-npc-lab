"""Publish only the public game, with an explicit, API-free online rules mode."""
from pathlib import Path
import shutil
ROOT=Path(__file__).resolve().parents[1]
output=ROOT/'dist'
output.mkdir(exist_ok=True)
shutil.copytree(ROOT/'public',output,dirs_exist_ok=True)
for page in output.glob('*.html'):
    source=page.read_text(encoding='utf8')
    source=source.replace('<head>','<head><script src="online-mode.js"></script>',1)
    source=source.replace('离线演示模式','在线规则体验')
    page.write_text(source,encoding='utf8')
(output/'online-mode.js').write_text('window.MYSTERY_STATIC = true;\n',encoding='utf8')
(output/'.nojekyll').touch()
