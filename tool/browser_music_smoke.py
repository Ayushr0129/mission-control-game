"""Verify real music decoding, mixing, track switching and mute in browsers."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_audio_probe import AUDIO_PROBE
BASE=os.getenv('MISSION_URL','http://127.0.0.1:8080/mission-control-game/')
OUTPUT=Path(os.getenv('MISSION_QA_OUTPUT','work/browser-qa'))
def scenario(browser,device,engine):
    touch=device is not None
    label=engine+('-iphone-music' if touch else '-desktop-music')
    ctx=browser.new_context(**(device or {'viewport':{'width':1440,'height':1000}}))
    ctx.add_init_script(AUDIO_PROBE)
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

    try:
        page.goto(BASE)
        page.locator('flt-semantics-placeholder').wait_for(state='attached',timeout=60000)
        page.locator('flt-semantics-placeholder').evaluate('(e)=>e.click()')
        page.get_by_text('Flight director console.',exact=True).wait_for(timeout=60000)
        assert page.evaluate('__missionAudio.musicStarts')==0
        click('Settings')
        page.wait_for_function('__missionAudio.musicStarts>0 && __missionAudio.musicLoops.size===1',timeout=15000)
        page.wait_for_function('[...__missionAudio.musicLoops][0].buffer.duration>47')
        click('Beyond the Horizon · upbeat')
        page.wait_for_function('__missionAudio.musicLoops.size===1 && [...__missionAudio.musicLoops][0].buffer.duration<33',timeout=15000)
        switch=page.get_by_role('switch',name='Background music',exact=False)
        box=visible_box(switch);canvas_pointer()
        if touch:page.touchscreen.tap(box['x']+box['width']/2,box['y']+box['height']/2)
        else:page.mouse.click(box['x']+box['width']/2,box['y']+box['height']/2)
        page.wait_for_function('__missionAudio.musicLoops.size===0')
        page.reload()
        page.locator('flt-semantics-placeholder').wait_for(state='attached',timeout=60000)
        page.locator('flt-semantics-placeholder').evaluate('(e)=>e.click()')
        page.get_by_text('Flight director console.',exact=True).wait_for(timeout=60000)
        click('Settings')
        assert page.evaluate('__missionAudio.musicStarts')==0
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
