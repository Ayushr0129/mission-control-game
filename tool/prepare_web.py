"""Validate the Pages base path and trim renderers this JS-only build never uses.

This modifies build output only. It never modifies Flutter or game source.
"""
import argparse
import json
from pathlib import Path
import re
import shutil


def prepare(directory: Path, base_href: str) -> dict:
    index = (directory / "index.html").read_text()
    if not base_href.startswith("/") or not base_href.endswith("/"):
        raise ValueError("The base path must start and end with a slash")
    if f'<base href="{base_href}">' not in index:
        raise ValueError(f"Rebuild with --base-href {base_href!r}")
    bootstrap = (directory / "flutter_bootstrap.js").read_text()
    if not re.search(r"canvasKitVariant:\s*['\"]full['\"]", bootstrap):
        raise ValueError("Only the explicitly configured full CanvasKit build can be trimmed")
    if '"compileTarget":"dart2js"' not in bootstrap or '"useLocalCanvasKit":true' not in bootstrap or '"compileTarget":"dart2wasm"' in bootstrap:
        raise ValueError("Expected a JavaScript release with locally bundled CanvasKit")
    before = sum(f.stat().st_size for f in directory.rglob("*") if f.is_file())
    renderer = directory / "canvaskit"
    keep = {"canvaskit.js", "canvaskit.wasm"}
    for name in keep:
        if not (renderer / name).is_file():
            raise ValueError(f"Missing Safari renderer: {name}")
    for item in renderer.iterdir():
        if item.name not in keep:
            shutil.rmtree(item) if item.is_dir() else item.unlink()
    # This bootstrap does not register Flutter's deprecated service worker.
    (directory / "flutter_service_worker.js").unlink(missing_ok=True)
    for item in directory.rglob("*.map"):
        item.unlink()
    (directory / ".nojekyll").touch()
    after = sum(f.stat().st_size for f in directory.rglob("*") if f.is_file())
    result = {"base_href": base_href, "before_bytes": before, "after_bytes": after}
    print(json.dumps(result))
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, default=Path("build/web"))
    parser.add_argument("--base-href", default="/mission-control-game/")
    args = parser.parse_args()
    prepare(args.directory, args.base_href)
