"""Physical mouse/touch validation of the assembled-rocket simulator."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=os.getenv('MISSION_URL','http://127.0.0.1:8080/mission-control-game/')
OUTPUT=Path(os.getenv('MISSION_QA_OUTPUT','work/browser-qa'))
KEY='flutter.assembly_simulator_v1'

def scenario(browser,device,engine):
    touch=device is not None
    label=engine+('-iphone-simulator' if touch else '-desktop-simulator')
    ctx=browser.new_context(**(device or {'viewport':{'width':1440,'height':1000}}))
    page=ctx.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    def canvas_pointer():
        # The native accessibility overlay exposes a virtual thumb, not the
        # physical slider. Leave its geometry available for locating controls,
        # while trusted mouse/touch events reach Flutter's normal canvas input.
        page.locator('flt-semantics-host').evaluate("""host => {
          const disable = node => {
            if(node.style) node.style.setProperty('pointer-events','none','important');
            if(node.shadowRoot) disable(node.shadowRoot);
            for(const child of node.children || []) disable(child);
          };
          disable(host);
        }""")

    def scroll_game(delta, x):
        if not touch:
            page.mouse.move(x, page.viewport_size['height']*.7)
            page.mouse.wheel(0,delta)
            return
        # Playwright's mobile WebKit supports trusted taps, but has no public
        # swipe API (and rejects mouse-wheel events). Drive the same Flutter
        # pointer pipeline with a scripted finger swipe to reveal the control.
        height=page.viewport_size['height']
        start=height*(.7 if delta>0 else .3)
        distance=min(abs(delta),height*.4)*(1 if delta>0 else -1)
        def finger(kind,y):
            page.locator('flutter-view').evaluate("""(view,p) => {
              view.dispatchEvent(new PointerEvent(p.kind,{
                bubbles:true,cancelable:true,pointerId:42,pointerType:'touch',
                isPrimary:true,buttons:p.kind==='pointerup'?0:1,button:0,
                pressure:p.kind==='pointerup'?0:.5,width:10,height:10,
                clientX:p.x,clientY:p.y
              }));
            }""",{'kind':kind,'x':x,'y':y})
        finger('pointerdown',start)
        for step in range(1,9):
            finger('pointermove',start-distance*step/8)
            page.wait_for_timeout(25)
        page.wait_for_timeout(120)  # Avoid a fling overshooting the target.
        finger('pointerup',start-distance)

    def visible_box(loc):
        # DOM scrollIntoView can move the accessibility mirror before Flutter's
        # canvas has scrolled on iOS. Send real wheel events to the game instead.
        view = page.viewport_size
        for _ in range(12):
            box = loc.bounding_box()
            if box and box['y'] + box['height']/2 >= 75 and box['y'] + box['height']/2 <= view['height'] - 8:
                return box
            if not box:
                # Flutter may omit off-screen semantics until its panel scrolls.
                canvas_pointer()
                scroll_game(view['height'] * .4, view['width'] * .5)
                page.wait_for_timeout(250)
                continue
            canvas_pointer()
            scroll_game(box['y']+box['height']/2-view['height']*.55, min(view['width']-25, max(25, box['x']+box['width']/2)))
            page.wait_for_timeout(250)
        raise AssertionError('Could not scroll a control into the game viewport')

    def click(text):
        loc = page.get_by_role('button', name=text, exact=False)
        if not loc.count():
            loc = page.get_by_role('radio', name=text, exact=False)
        if not loc.count():
            loc = page.get_by_label(text, exact=True)
        if not loc.count():
            loc = page.get_by_text(text, exact=False)
        box = visible_box(loc.first)
        canvas_pointer()
        x,y=box['x']+box['width']/2,box['y']+box['height']/2
        if touch:
            page.touchscreen.tap(x,y)
        else:
            page.mouse.click(x,y)
        page.wait_for_timeout(250)

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
