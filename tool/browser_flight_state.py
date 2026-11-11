"""Release checks of actual assembled flight, keyboard/touch engine cutoff and HUD."""
import math
import os
import re
from browser_assembly_acceptance import Controls, EDITOR, OUTPUT, sync_playwright


def scenario(browser, device, label):
    c = Controls(browser, device, label)
    try:
        c.ready()
        c.tap('Build & fly a rocket')
        c.tap('Launch assembled rocket')
        c.wait(EDITOR, 'p.flight && p.flight.surfaceMode===true')
        initial = c.read(EDITOR)
        assert len(initial['flight']['parts']) == len(initial['design'])
        fuel = sum(p['fuel'] for p in initial['design'])
        assert sum(p['fuel'] for p in initial['flight']['parts']) == fuel
        c.page.screenshot(path=str(OUTPUT / (label + '-pad.png')))
        if c.touch:
            c.tap('Ignite engines · Space')
        else:
            c.page.keyboard.press('Space')
        c.wait(EDITOR, 'p.flight.launched && p.flight.time>1 && p.flight.y>6371000')
        assert sum(p['fuel'] for p in c.read(EDITOR)['flight']['parts']) < fuel
        if c.touch:
            c.tap('Cut engines · Space')
        else:
            c.page.keyboard.press('Space')
        c.wait(EDITOR, 'p.flight.enginesOn===false')
        coast = c.read(EDITOR)['flight']
        c.wait(EDITOR, f'p.flight.time>{coast["time"] + 1}')
        after = c.read(EDITOR)['flight']
        assert sum(p['fuel'] for p in after['parts']) == sum(p['fuel'] for p in coast['parts'])
        assert math.isclose(after['vy'] - coast['vy'], -9.8 * (after['time'] - coast['time']), abs_tol=.001)
        if c.touch:
            c.tap('Ignite engines · Space')
            c.tap('+1°')
        else:
            c.page.keyboard.press('Space')
            c.page.keyboard.down('KeyD')
            c.page.wait_for_timeout(350)
            c.page.keyboard.up('KeyD')
        c.wait(EDITOR, 'p.flight.enginesOn===true && p.flight.angle>0')
        turned = c.read(EDITOR)['flight']
        assert sum(p['fuel'] for p in turned['parts']) < sum(p['fuel'] for p in after['parts'])
        if not c.touch:
            c.page.keyboard.down('KeyA')
            c.page.wait_for_timeout(350)
            c.page.keyboard.up('KeyA')
            c.wait(EDITOR, f'p.flight.angle<{turned["angle"]}')
            c.page.keyboard.press('KeyP')
        else:
            c.tap('Pause simulation')
        c.page.get_by_text('Resume simulation', exact=True).wait_for()
        hud = c.page.get_by_text(re.compile(r'^FLIGHT · PAUSED')).first
        hud.wait_for(state='visible')
        text = hud.get_attribute('aria-label') or hud.inner_text()
        box = hud.bounding_box()
        assert box and box['y']>=0 and box['y']+box['height']<=c.page.viewport_size['height']
        assert 'Altitude ' in text and 'Fuel ' in text
        c.page.screenshot(path=str(OUTPUT / (label + '-hud.png')))
        c.page.reload()
        c.page.locator('flt-semantics-placeholder').wait_for(state='attached', timeout=60000)
        c.page.locator('flt-semantics-placeholder').evaluate('(e)=>e.click()')
        c.page.get_by_text('Flight director console.', exact=True).wait_for(timeout=60000)
        c.tap('Build & fly a rocket')
        c.page.get_by_text('Resume simulation', exact=True).wait_for()
        assert c.read(EDITOR)['flight']['surfaceMode'] is True
        c.page.get_by_text(re.compile(r'^FLIGHT · PAUSED')).first.wait_for(state='visible')
        c.finish()
    except Exception:
        c.fail()
        raise


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        for engine in os.getenv('MISSION_BROWSERS', 'webkit,chromium').split(','):
            opts = {'headless': True}
            if engine == 'chromium' and os.getenv('CHROMIUM_PATH'):
                opts['executable_path'] = os.environ['CHROMIUM_PATH']
            browser = getattr(p, engine).launch(**opts)
            try:
                for device in ([None, p.devices['iPhone 13']] if engine == 'webkit' else [None]):
                    scenario(browser, device, engine + ('-iphone-flight' if device else '-desktop-flight'))
            finally:
                browser.close()


if __name__ == '__main__':
    main()
