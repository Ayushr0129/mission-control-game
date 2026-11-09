import tempfile
import unittest
from pathlib import Path
from prepare_web import prepare


class WebPackagingTest(unittest.TestCase):
    def fixture(self, root):
        (root / 'index.html').write_text('<base href="/mission-control-game/">')
        (root / 'flutter_bootstrap.js').write_text('"compileTarget":"dart2js","useLocalCanvasKit":true; canvasKitVariant: "full"')
        r=root/'canvaskit';r.mkdir()
        for name in ['canvaskit.js','canvaskit.wasm','skwasm.wasm']:
            (r/name).write_bytes(b'renderer')
        (r/'chromium').mkdir();(r/'chromium'/'canvaskit.wasm').write_bytes(b'chromium-only')
        (root/'main.dart.js').write_bytes(b'game code')
        (root/'assets').mkdir();(root/'assets'/'mission.json').write_bytes(b'science')

    def test_only_unused_renderers_are_removed_and_game_assets_survive(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);self.fixture(root)
            result=prepare(root,'/mission-control-game/')
            self.assertLess(result['after_bytes'],result['before_bytes'])
            self.assertTrue((root/'.nojekyll').exists())
            self.assertEqual((root/'main.dart.js').read_bytes(),b'game code')
            self.assertEqual((root/'assets'/'mission.json').read_bytes(),b'science')
            self.assertTrue((root/'canvaskit'/'canvaskit.wasm').exists())
            self.assertFalse((root/'canvaskit'/'chromium').exists())

    def test_wrong_base_is_rejected_before_mutating_output(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);self.fixture(root)
            with self.assertRaises(ValueError):prepare(root,'/wrong-repo/')
            self.assertTrue((root/'canvaskit'/'skwasm.wasm').exists())

    def test_future_wasm_build_is_rejected_instead_of_losing_a_renderer(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);self.fixture(root)
            b=root/'flutter_bootstrap.js'
            b.write_text(b.read_text()+'"compileTarget":"dart2wasm"')
            with self.assertRaises(ValueError):prepare(root,'/mission-control-game/')
            self.assertTrue((root/'canvaskit'/'skwasm.wasm').exists())
