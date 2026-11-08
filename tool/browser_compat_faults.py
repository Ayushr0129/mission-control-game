"""Browser regressions for recoverable startup, storage and Safari audio errors."""
import json
import os
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
from browser_audio_probe import AUDIO_PROBE

BASE=os.getenv('MISSION_URL','http://127.0.0.1:8080/mission-control-game/').rstrip('/')+'/'
OUTPUT=Path(os.getenv('MISSION_QA_OUTPUT','work/browser-qa'))
KEY='flutter.mission_control_v1'


def exercise(browser,device,engine,case):
    label=engine+('-iphone' if device else '-desktop')+'-'+case
    context=browser.new_context(**(device or {'viewport':{'width':1440,'height':1000}}))
    errors=[]
    context.add_init_script(AUDIO_PROBE)
    if case=='storage-denied':
        context.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Storage blocked','SecurityError')}})")
    if case=='storage-quota':
        fixture={'version':1,'funding':37.0,'trust':70.0,'reputation':0.0,'science':0,'attempts':0,'seed':42,'completed':[],'achievements':[],
            'design':['core','engine1','tank1','solar1','antenna1','camera'],'active':None,'muted':False,'volume':.35}
        context.add_init_script(f"""(() => {{
          const set=Storage.prototype.setItem;
          window.__restoreStorage=()=>{{Storage.prototype.setItem=set;}};
          const value=JSON.stringify(JSON.stringify({json.dumps(fixture)}));
          set.call(localStorage,'{KEY}',value);window.__oldSave=value;
          Storage.prototype.setItem=function(){{throw new DOMException('Quota reached','QuotaExceededError')}};
        }})();""")
    if case=='audio-activation':
        context.add_init_script('window.__missionAudio.blockResume=true')
    blocked=False
    def route(request):
        nonlocal blocked
        url=request.request.url
        if urlsplit(url).netloc!=urlsplit(BASE).netloc:
            request.abort();return
        if case=='asset-retry' and url.endswith('/assets/assets/data/missions.json') and not blocked:
            blocked=True;request.abort();return
        request.continue_()
    context.route('**/*',route)
    page=context.new_page()
    page.on('pageerror',lambda e:errors.append(str(e)))
    def semantics():
        page.locator('flt-semantics-placeholder, flt-semantics').first.wait_for(state='attached',timeout=60000)
        placeholder=page.locator('flt-semantics-placeholder')
        if placeholder.count():placeholder.evaluate('(e)=>e.click()')
    def click(name):
        node=page.get_by_role('button',name=name,exact=False).first
        box=node.bounding_box();assert box
        # These startup/settings controls are visible; no DOM scrolling is used.
        assert 0 <= box['y']+box['height']/2 <= page.viewport_size['height']
        if device:page.touchscreen.tap(box['x']+box['width']/2,box['y']+box['height']/2)
        else:page.mouse.click(box['x']+box['width']/2,box['y']+box['height']/2)
        page.wait_for_timeout(250)
    try:
        page.goto(BASE,wait_until='domcontentloaded')
        semantics()
        if case=='asset-retry':
            page.get_by_text('Core flight data could not be loaded',exact=False).wait_for(timeout=15000)
            click('Retry loading')
        page.get_by_text('Small steps. Infinite possibilities.',exact=True).wait_for(timeout=60000)
        if case in ('storage-denied','storage-quota'):
            page.get_by_text('SESSION ONLY',exact=True).wait_for(timeout=8000)
            page.get_by_text('Session only: progress stays in this tab.',exact=False).wait_for()
            if case=='storage-quota':
                page.get_by_text('$37.0',exact=False).wait_for()
                assert page.evaluate(f"localStorage.getItem('{KEY}') === __oldSave")
                page.evaluate('__restoreStorage()')
                page.get_by_text('LOCAL SAVE',exact=True).wait_for(timeout=8000)
                assert page.evaluate(f"JSON.parse(JSON.parse(localStorage.getItem('{KEY}'))).funding") == 37
        if case=='audio-activation':
            click('Settings')
            page.get_by_text('Safari could not start sound.',exact=False).wait_for(timeout=8000)
            assert page.evaluate('__missionAudio.starts')==0
            page.evaluate('__missionAudio.blockResume=false')
            click('Enable sound')
            page.wait_for_function("__missionAudio.starts>0 && __missionAudio.lastStartState==='running'",timeout=10000)
            page.get_by_text('Sound enabled.',exact=True).wait_for()
            # Muting updates both live gains, not just a saved preference flag.
            switch=page.get_by_role('switch').first
            box=switch.bounding_box();assert box
            if device:page.touchscreen.tap(box['x']+box['width']/2,box['y']+box['height']/2)
            else:page.mouse.click(box['x']+box['width']/2,box['y']+box['height']/2)
            page.wait_for_function('__missionAudio.gains.every(g=>g.gain.value===0)',timeout=5000)
        assert not errors,errors
        page.screenshot(path=str(OUTPUT/(label+'.png')))
        print('PASS '+label,flush=True)
        return {'scenario':label,'uncaught_errors':errors}
    except Exception:
        page.screenshot(path=str(OUTPUT/(label+'-failure.png')))
        (OUTPUT/(label+'-failure.txt')).write_text(page.locator('body').inner_text())
        raise
    finally:context.close()


def main():
    OUTPUT.mkdir(parents=True,exist_ok=True)
    results=[]
    with sync_playwright() as p:
        for engine in os.getenv('MISSION_BROWSERS','webkit,chromium').split(','):
            options={'headless':True}
            if engine=='chromium' and os.getenv('CHROMIUM_PATH'):options['executable_path']=os.environ['CHROMIUM_PATH']
            browser=getattr(p,engine).launch(**options)
            try:
                for device in ([None,p.devices['iPhone 13']] if engine=='webkit' else [None]):
                    for case in ['asset-retry','storage-denied','storage-quota','audio-activation']:
                        results.append(exercise(browser,device,engine,case))
            finally:browser.close()
    (OUTPUT/'compatibility-faults.json').write_text(json.dumps(results,indent=2))


if __name__=='__main__':main()
