"""Exercise the real release build at its repository subpath, without a CDN.

Requires a running HTTP server. No production game test hooks are added.
"""
import json
import os
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
from browser_audio_probe import AUDIO_PROBE

BASE = os.getenv('MISSION_URL', 'http://127.0.0.1:8080/mission-control-game/').rstrip('/') + '/'
OUTPUT = Path(os.getenv('MISSION_QA_OUTPUT', 'work/browser-qa'))
KEY = 'flutter.mission_control_v1'


def run_scenario(browser, device=None, engine="browser"):
    touch = device is not None
    label = engine + ('-iphone-touch' if touch else '-desktop')
    context = browser.new_context(**(device or {'viewport': {'width': 1440, 'height': 1000}}))
    context.add_init_script(AUDIO_PROBE)
    page = context.new_page()
    errors, asset_errors, requests, results = [], [], [], []
    origin = urlsplit(BASE).netloc
    path = urlsplit(BASE).path

    def route_request(route):
        url = urlsplit(route.request.url)
        if url.netloc == origin and url.path.startswith(path):
            route.continue_()
        else:
            # NASA is optional. Deliberately block it and every renderer/font CDN.
            route.abort()

    context.route('**/*', route_request)
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: (
        asset_errors.append(f'{response.status} {response.url}')
        if response.status >= 400 else requests.append(response.url)
    ))

    def passed(check):
        results.append(check)
        print(f'{label}: {check}', flush=True)

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

    def ready():
        page.goto(BASE, wait_until='domcontentloaded')
        page.locator('flt-semantics-placeholder, flt-semantics').first.wait_for(state='attached', timeout=60000)
        node=page.locator('flt-semantics-placeholder')
        if node.count():
            node.evaluate('(element) => element.click()')
        page.get_by_text('Flight director console.', exact=True).wait_for(timeout=60000)
        canvas_pointer()

    def saved():
        return page.evaluate("""key => {
          const value=JSON.parse(localStorage.getItem(key));
          return typeof value==='string' ? JSON.parse(value) : value;
        }""", KEY)

    def wait_saved(expression):
        page.wait_for_function(
            f'() => {{const raw=JSON.parse(localStorage.getItem("{KEY}")); const p=typeof raw==="string"?JSON.parse(raw):raw;return p && ({expression});}}',
            timeout=8000,
        )
        return saved()

    def pointer_throttle(fraction):
        slider = page.get_by_role('slider').first
        box = visible_box(slider)
        assert box, 'Throttle has no hit area'
        # Flutter exposes the accessible *thumb*, not the entire track. The
        # telemetry row supplies the full slider width (24px track padding).
        percent = str(round(saved()['active']['flight']['throttle'] * 100))
        left = page.get_by_text('MAIN THROTTLE', exact=True).bounding_box()
        right = page.get_by_text(percent + '%', exact=True).first.bounding_box()
        assert left and right
        track_left, track_right = left['x'] + 24, right['x'] + right['width'] - 24
        x = track_left + (track_right - track_left) * fraction
        y = box['y'] + box['height'] / 2
        canvas_pointer()
        if touch:
            page.touchscreen.tap(x, y)
        else:
            page.mouse.move(box['x'] + box['width'] / 2, y)
            page.mouse.down()
            page.mouse.move(x, y, steps=8)
            page.mouse.up()
        page.wait_for_timeout(200)

    try:
        ready()
        click('Enter mission control')
        click('Touch the edge')
        click('Subsystem design planner')
        click('Pin design for comparison')
        click('Scout light launcher · $3M · 1500 kg')
        page.get_by_text('Cost -2.0 M', exact=False).wait_for()
        click('Atlas training launcher · $5M · 5000 kg')
        passed('launcher selection and pinned engineering comparison')
        click('Electrical')
        click('Solar wings')
        page.get_by_text('Power demand exceeds generation', exact=False).wait_for()
        click('Solar wings')
        page.get_by_text('FLIGHT READY', exact=True).wait_for()
        passed('builder removal/replacement and live readiness')
        page.screenshot(path=str(OUTPUT / (label + '-builder.png')))
        page.wait_for_function("__missionAudio.starts > 0 && __missionAudio.lastStartState === 'running' && __missionAudio.durations.every(d => d > 0)", timeout=10000)
        passed('original audio buffers decode and play after a user gesture')
        click('Proceed to launch')
        page.get_by_role('button', name='Ignition & liftoff', exact=True).wait_for()
        pointer_throttle(.6)
        state = wait_saved('p.active?.flight?.throttle < .95')
        assert .2 < state['active']['flight']['throttle'] < .95
        passed('touch throttle' if touch else 'mouse throttle drag')
        if not touch:
            before = state['active']['flight']['throttle']
            page.keyboard.press('s')
            state = wait_saved(f'p.active?.flight?.throttle < {before - .02}')
            page.keyboard.press('a')
            wait_saved('p.active?.flight?.guidance === 1')
            page.keyboard.press('d')
            wait_saved('p.active?.flight?.guidance === 0')
            for _ in range(20):
                page.keyboard.press('w')
            wait_saved('p.active?.flight?.throttle === 1')
            passed('keyboard throttle and pitch')
        else:
            pointer_throttle(1)
            wait_saved('p.active?.flight?.throttle === 1')
        page.screenshot(path=str(OUTPUT / f'{label}-flight-controls.png'))
        click('Save & return to console')
        ready()
        click('Continue mission')
        page.get_by_role('button', name='Ignition & liftoff', exact=True).wait_for()
        passed('reload restores active flight paused')
        if touch:
            click('Ignition & liftoff')
            page.get_by_role('button', name='Pause flight', exact=True).wait_for(timeout=5000)
            passed('touch ignition')
        else:
            page.keyboard.press('Space')
            page.get_by_role('button', name='Pause flight', exact=True).wait_for()
            page.keyboard.press('Escape')
            page.get_by_role('button', name='Resume flight', exact=True).wait_for()
            page.keyboard.press('Space')
            passed('keyboard launch, pause and resume')
        stage = page.get_by_role('button', name='Separate interstage', exact=True)
        stage.wait_for(timeout=90000)
        if touch:
            click('Separate interstage')
        else:
            page.keyboard.press('g')
        wait_saved('p.active?.flight?.separated === true')
        passed('stage separation')
        page.wait_for_function('__missionAudio.loopStarts > 0', timeout=10000)
        passed('engine audio loop starts')
        page.screenshot(path=str(OUTPUT / (label + '-ascent.png')))
        page.get_by_text('Beyond the launch.', exact=True).wait_for(timeout=90000)
        page.wait_for_function('__missionAudio.activeLoops.size === 0', timeout=5000)
        for option in ['Shed instrument load', 'Enter safe mode', 'Correct trajectory · 120 m/s']:
            if page.get_by_role('button', name=option, exact=True).count():
                click(option)
                break
        for action in ['Execute manoeuvre', 'Confirm approach', 'Collect observations', 'Transmit & complete']:
            click(action)
        page.get_by_text('Knowledge, brought home.', exact=True).wait_for()
        page.screenshot(path=str(OUTPUT / f'{label}-success.png'))
        passed('flight, event, manoeuvre, science and downlink success')
        ready()
        state = saved()
        assert abs(state['funding'] - 50.2) < .001, state
        assert state['completed'] == ['space']
        assert 'Reached Space' in state['achievements']
        passed('campaign reward, unlock, achievement and saved progress')
        # Avoid relying on desktop tooltip text in the compact touch navigation.
        click('Discovery')
        click('Discover NASA images')
        page.get_by_text('NASA is unreachable right now.', exact=False).wait_for(timeout=15000)
        passed('optional NASA failure leaves offline field notes usable')
        assert not asset_errors, asset_errors
        assert not errors, errors
        assert all(urlsplit(url).path.startswith(path) for url in requests), requests
        # Verify loading-screen recovery without altering normal gameplay.
        page.evaluate("document.body.insertAdjacentHTML('beforeend','<div id=boot></div>');showMissionLoadError()")
        page.get_by_role('button', name='Retry loading', exact=True).wait_for()
        passed('loading failure offers retry')
        return {'scenario': label, 'checks': results, 'same_origin_responses': len(requests), 'uncaught_errors': errors}
    except Exception:
        page.screenshot(path=str(OUTPUT / f'{label}-failure.png'))
        (OUTPUT / f'{label}-failure.txt').write_text(page.locator('body').inner_text())
        raise
    finally:
        context.close()


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    summary = []
    with sync_playwright() as playwright:
        for engine in os.getenv('MISSION_BROWSERS', 'webkit,chromium').split(','):
            kind = getattr(playwright, engine)
            options = {'headless': True}
            if engine == 'chromium' and os.getenv('CHROMIUM_PATH'):
                options['executable_path'] = os.environ['CHROMIUM_PATH']
            browser = kind.launch(**options)
            try:
                print(f'Testing {engine} desktop at {BASE}', flush=True)
                result = run_scenario(browser, engine=engine)
                result['engine'] = engine
                summary.append(result)
                print(json.dumps(result), flush=True)
                if engine == 'webkit':
                    print('Testing WebKit iPhone touchscreen', flush=True)
                    result = run_scenario(browser, playwright.devices['iPhone 13'], engine=engine)
                    result['engine'] = 'webkit'
                    summary.append(result)
                    print(json.dumps(result), flush=True)
            finally:
                browser.close()
    (OUTPUT / 'summary.json').write_text(json.dumps(summary, indent=2))
    print('PASS: ' + ', '.join(item['scenario'] for item in summary), flush=True)


if __name__ == '__main__':
    main()
