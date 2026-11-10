"""Physical mouse/touch validation of the assembled-rocket simulator."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_assembly_acceptance import Controls
BASE=os.getenv('MISSION_URL','http://127.0.0.1:8080/mission-control-game/')
OUTPUT=Path(os.getenv('MISSION_QA_OUTPUT','work/browser-qa'))
KEY='flutter.assembly_simulator_v1'

def scenario(browser,device,engine):
    touch=device is not None
    label=engine+('-iphone-simulator' if touch else '-desktop-simulator')
    controls=Controls(browser,device,label)
    ctx=controls.ctx;page=controls.page;errors=controls.errors
    canvas_pointer=controls.canvas
    click=controls.tap

    def read():
        return page.evaluate("key=>{const s=JSON.parse(localStorage.getItem(key));return typeof s==='string'?JSON.parse(s):s;}",KEY)
    def wait_for(expr):
        page.wait_for_function(f"()=>{{const s=JSON.parse(localStorage.getItem('{KEY}'));const p=typeof s==='string'?JSON.parse(s):s;return p && ({expr});}}",timeout=15000)
    try:
        page.goto(BASE)
        page.locator('flt-semantics-placeholder').wait_for(state='attached',timeout=60000)
        page.locator('flt-semantics-placeholder').evaluate('(e)=>e.click()')
        page.get_by_text('Flight director console.',exact=True).wait_for(timeout=60000)
        click('Build & fly a rocket')
        page.get_by_text('PART CATALOGUE',exact=True).wait_for()
        grid=page.get_by_role('img',name='Rocket assembly grid',exact=True)
        box=grid.bounding_box();assert box
        cell=box['width']/9
        canvas_pointer()
        x,y=box['x']+3.5*cell,box['y']+3.5*cell
        if touch:page.touchscreen.tap(x,y)
        else:page.mouse.click(x,y)
        click('Move left');click('Move right');click('Rotate part')
        page.screenshot(path=str(OUTPUT/(label+'-builder.png')))
        click('Launch assembled rocket')
        page.get_by_text('Ignite & launch',exact=True).wait_for()
        click('Ignite & launch')
        if touch:click('+1°')
        else:
            page.keyboard.down('KeyD');page.wait_for_timeout(600);page.keyboard.up('KeyD')
        wait_for('p.flight && p.flight.time>1 && p.flight.angle>0')
        assert len(read()['flight']['parts'])==9
        click('Trajectory map')
        page.get_by_text('Vehicle camera',exact=True).wait_for()
        click('Separate stage')
        wait_for('p.flight.parts.length===5')
        click('Pause simulation')
        page.get_by_text('Resume simulation',exact=True).wait_for()
        page.screenshot(path=str(OUTPUT/(label+'-map.png')))
        flight=read()['flight'];assert flight['time']>0
        page.reload()
        page.locator('flt-semantics-placeholder').wait_for(state='attached',timeout=60000)
        page.locator('flt-semantics-placeholder').evaluate('(e)=>e.click()')
        page.get_by_text('Flight director console.',exact=True).wait_for(timeout=60000)
        click('Build & fly a rocket')
        page.get_by_text('Resume simulation',exact=True).wait_for()
        assert len(read()['flight']['parts'])==5
        assert not errors,errors
        print('PASS '+label,flush=True)
    except Exception:
        page.screenshot(path=str(OUTPUT/(label+'-failure.png')))
        (OUTPUT/(label+'-failure.txt')).write_text(page.locator('body').inner_text())
        raise
    finally:ctx.close()

def main():
    OUTPUT.mkdir(parents=True,exist_ok=True)
    with sync_playwright() as p:
        for engine in os.getenv('MISSION_BROWSERS','webkit,chromium').split(','):
            opts={'headless':True}
            if engine=='chromium' and os.getenv('CHROMIUM_PATH'):opts['executable_path']=os.environ['CHROMIUM_PATH']
            browser=getattr(p,engine).launch(**opts)
            try:
                for device in ([None,p.devices['iPhone 13']] if engine=='webkit' else [None]):scenario(browser,device,engine)
            finally:browser.close()
if __name__=='__main__':main()
