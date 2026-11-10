"""Release acceptance: physical construction, campaign completion, orbital example.
Touch drags/swipes use scripted PointerEvents because Playwright WebKit exposes
trusted taps but no public multi-event finger-drag API. No production hooks.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=os.getenv('MISSION_URL','http://127.0.0.1:8080/mission-control-game/')
OUTPUT=Path(os.getenv('MISSION_QA_OUTPUT','work/browser-qa'))
CAMPAIGN='flutter.mission_control_v1'
EDITOR='flutter.assembly_simulator_v1'

class Controls:
    def __init__(self,browser,device,label):
        self.touch=device is not None;self.label=label;self.errors=[]
        self.ctx=browser.new_context(**(device or {'viewport':{'width':1440,'height':1000}}))
        self.page=self.ctx.new_page();self.page.on('pageerror',lambda e:self.errors.append(str(e)))
    def ready(self):
        p=self.page;p.goto(BASE)
        p.locator('flt-semantics-placeholder').wait_for(state='attached',timeout=60000)
        p.locator('flt-semantics-placeholder').evaluate('(e)=>e.click()')
        p.get_by_text('Flight director console.',exact=True).wait_for(timeout=60000)
    def canvas(self):
        self.page.locator('flt-semantics-host').evaluate("""host=>{const disable=n=>{if(n.style)n.style.setProperty('pointer-events','none','important');if(n.shadowRoot)disable(n.shadowRoot);for(const c of n.children||[])disable(c);};disable(host);}""")
    def finger(self,kind,x,y):
        self.page.locator('flutter-view').evaluate("""(v,p)=>v.dispatchEvent(new PointerEvent(p.kind,{bubbles:true,cancelable:true,pointerId:79,pointerType:'touch',isPrimary:true,button:0,buttons:p.kind==='pointerup'?0:1,pressure:p.kind==='pointerup'?0:.5,clientX:p.x,clientY:p.y,width:10,height:10}))""",{'kind':kind,'x':x,'y':y})
    def scroll(self,delta):
        self.canvas();p=self.page;w=p.viewport_size['width'];h=p.viewport_size['height']
        if not self.touch:p.mouse.move(w*.85,h*.7);p.mouse.wheel(0,delta)
        else:
            start=h*(.72 if delta>0 else .58);distance=min(abs(delta),h*.27)*(1 if delta>0 else -1)
            self.finger('pointerdown',w*.85,start)
            for step in range(1,9):self.finger('pointermove',w*.85,start-distance*step/8);p.wait_for_timeout(20)
            p.wait_for_timeout(100);self.finger('pointerup',w*.85,start-distance)
        p.wait_for_timeout(250)
    def locate(self,name):
        p=self.page
        for role in ['button','checkbox','radio','switch']:
            node=p.get_by_role(role,name=name,exact=False)
            if node.count():return node.first
        node=p.get_by_label(name,exact=True)
        if node.count():return node.first
        return p.get_by_text(name,exact=True).first
    def box(self,name,overlay=False):
        p=self.page;h=p.viewport_size['height']
        # Flutter retains semantics for clipped scroll children. On phones the
        # catalogue/control panel starts below the canvas; a DOM box above it
        # cannot receive a real finger gesture even when Playwright calls it visible.
        floor=75
        if self.touch and not overlay:
            for label in ['Rocket assembly grid','Vehicle tracking view','Flight trajectory map']:
                canvas=p.get_by_role('img',name=label,exact=True)
                bounds=canvas.bounding_box() if canvas.count() else None
                if bounds:floor=max(floor,min(h*.6,bounds['y']+bounds['height']+8))
        for attempt in range(24):
            node=self.locate(name);box=node.bounding_box() if node.count() else None
            if box and floor<box['y']+box['height']/2<h-65:return box
            delta=(box['y']+box['height']/2-h*(.8 if self.touch else .65)) if box else (-500 if attempt<8 else 500)
            self.scroll(delta)
        raise AssertionError('Control not reachable: '+name)
    def tap(self,name,overlay=False):
        box=self.box(name,overlay);self.canvas();p=self.page;x=box['x']+box['width']/2;y=box['y']+box['height']/2
        if self.touch:p.touchscreen.tap(x,y)
        else:p.mouse.click(x,y)
        p.wait_for_timeout(300)
        print(self.label+': '+name,flush=True)
    def grid(self,x,y):
        b=self.page.get_by_role('img',name='Rocket assembly grid',exact=True).bounding_box();assert b
        return b['x']+(x+.5)*b['width']/9,b['y']+(y+.5)*b['height']/12
    def raw_tap(self,x,y):
        self.canvas()
        if self.touch:self.page.touchscreen.tap(x,y)
        else:self.page.mouse.click(x,y)
        self.page.wait_for_timeout(250)
    def drag(self,name,x,y):
        b=self.box(name);start=(b['x']+b['width']/2,b['y']+b['height']/2);end=self.grid(x,y);self.canvas();p=self.page
        if self.touch:
            self.finger('pointerdown',*start);p.wait_for_timeout(700)
            for step in range(1,17):self.finger('pointermove',start[0]+(end[0]-start[0])*step/16,start[1]+(end[1]-start[1])*step/16);p.wait_for_timeout(25)
            self.finger('pointerup',*end)
        else:p.mouse.move(*start);p.mouse.down();p.mouse.move(*end,steps=24);p.mouse.up()
        p.wait_for_timeout(500)
    def read(self,key):
        return self.page.evaluate("key=>{const p=JSON.parse(localStorage.getItem(key));return typeof p==='string'?JSON.parse(p):p;}",key)
    def wait(self,key,expr,timeout=20000):
        self.page.wait_for_function(f"()=>{{const raw=JSON.parse(localStorage.getItem('{key}'));const p=typeof raw==='string'?JSON.parse(raw):raw;return p&&({expr});}}",timeout=timeout)
    def finish(self):
        assert not self.errors,self.errors;print('PASS '+self.label,flush=True);self.ctx.close()
    def fail(self):
        self.page.screenshot(path=str(OUTPUT/(self.label+'-failure.png')))
        (OUTPUT/(self.label+'-failure.txt')).write_text(self.page.locator('body').inner_text());self.ctx.close()

def editor(browser,device,label):
    c=Controls(browser,device,label+'-editor')
    try:
        c.ready();c.tap('Build & fly a rocket');c.tap('New empty assembly');c.tap('Start empty')
        for name,x,y in [('Command capsule',4,1),('Transfer tank',4,2),('Booster engine',4,3)]:c.drag(name,x,y)
        c.wait(EDITOR,'p.design.length===3')
        assert [p['kind'] for p in c.read(EDITOR)['design']]==['capsule','tank_small','engine']
        c.raw_tap(*c.grid(4,2));c.tap('Duplicate part');c.wait(EDITOR,'p.design.length===4');c.tap('Undo');c.wait(EDITOR,'p.design.length===3');c.tap('Redo');c.wait(EDITOR,'p.design.length===4');c.tap('Undo');c.wait(EDITOR,'p.design.length===3')
        c.tap('Zoom in');c.tap('Fit assembly');c.page.screenshot(path=str(OUTPUT/(label+'-new-editor.png')))
        c.tap('Launch assembled rocket');c.tap('Ignite & launch')
        if c.touch:c.tap('+1°')
        else:c.page.keyboard.down('KeyD');c.page.wait_for_timeout(500);c.page.keyboard.up('KeyD')
        c.wait(EDITOR,'p.flight&&p.flight.time>1&&p.flight.angle>0')
        assert len(c.read(EDITOR)['flight']['parts'])==3
        c.tap('Pause simulation');before=c.read(EDITOR)['flight']['time']
        c.tap('25×');c.tap('Auto-pause: Off');c.tap('In 1 minute',overlay=True);c.tap('Resume simulation')
        c.page.get_by_text('Auto-paused: In 1 minute. Rate reset to 1×.',exact=True).wait_for(timeout=30000)
        c.wait(EDITOR,f'p.flight.time>={before+59.9}')
        assert abs(c.read(EDITOR)['flight']['time']-before-60)<.15
        c.tap('Trajectory map')
        c.page.screenshot(path=str(OUTPUT/(label+'-new-flight.png')))
        c.finish()
    except Exception:c.fail();raise

def campaign(browser,device,label):
    c=Controls(browser,device,label+'-campaign')
    try:
        c.ready();c.tap('Enter mission control');c.tap('Touch the edge');c.tap('Design spacecraft')
        c.page.get_by_text('CAMPAIGN / Touch the edge',exact=True).wait_for()
        c.tap('Load mission baseline');c.tap('Launch assembled rocket')
        c.wait(CAMPAIGN,"p.active&&p.active.stage==='assembly'")
        assert abs(c.read(CAMPAIGN)['funding']-35)<.001
        c.tap('Ignite & launch');c.tap('10×')
        c.wait(CAMPAIGN,'p.active.snapshot.flight.time>10')
        c.tap('Pause simulation');c.page.reload();c.page.locator('flt-semantics-placeholder').wait_for(state='attached',timeout=60000);c.page.locator('flt-semantics-placeholder').evaluate('(e)=>e.click()');c.page.get_by_text('Flight director console.',exact=True).wait_for(timeout=60000)
        c.tap('Continue mission');c.page.get_by_text('Resume simulation',exact=True).wait_for()
        assert abs(c.read(CAMPAIGN)['funding']-35)<.001 and c.read(CAMPAIGN)['attempts']==1
        c.tap('10×');c.tap('Resume simulation')
        c.wait(CAMPAIGN,"p.active&&p.active.snapshot.phase==='operations'",timeout=90000)
        event=c.read(CAMPAIGN)['active']['snapshot']['operations']['event']
        c.tap(['Use battery reserve','Reacquire the link','Use a longer coast · 60 Wh'][event])
        for name in ['Execute mission manoeuvre','Confirm destination approach','Collect payload observations','Downlink & complete mission']:c.tap(name)
        c.wait(CAMPAIGN,'p.active===null&&p.assemblyReport&&p.assemblyReport.success===true')
        p=c.read(CAMPAIGN);assert p['science']>0 and abs(p['funding']-51)<.001 and len(p['assemblySettlements'])==1
        c.page.screenshot(path=str(OUTPUT/(label+'-assembled-mission-report.png')));c.finish()
    except Exception:c.fail();raise

def orbit(browser):
    c=Controls(browser,None,'chromium-orbital-example')
    try:
        c.ready();c.tap('Build & fly a rocket');c.tap('Load orbital example');c.tap('Launch assembled rocket');c.tap('Orbital flight tutor');c.tap('10×');c.tap('Ignite & launch')
        condition="""p.flight&&(()=>{const f=p.flight,r=Math.hypot(f.x,f.y),v2=f.vx*f.vx+f.vy*f.vy,mu=3.986004418e14,E=v2/2-mu/r,h=f.x*f.vy-f.y*f.vx,e=Math.sqrt(Math.max(0,1+2*E*h*h/(mu*mu))),pe=h*h/(mu*(1+e))-6371000,ap=-mu/E-(pe+6371000)-6371000;return E<0&&pe>120000&&ap<450000;})()"""
        c.wait(EDITOR,condition,timeout=120000);c.tap('Pause simulation');c.tap('Trajectory map');c.page.screenshot(path=str(OUTPUT/'verified-orbit-map.png'))
        assert c.read(EDITOR)['flight']['parts'] and sum(p['fuel'] for p in c.read(EDITOR)['flight']['parts'])>0;c.finish()
    except Exception:c.fail();raise

def main():
    OUTPUT.mkdir(parents=True,exist_ok=True)
    with sync_playwright() as p:
        for engine in os.getenv('MISSION_BROWSERS','webkit,chromium').split(','):
            opts={'headless':True}
            if engine=='chromium' and os.getenv('CHROMIUM_PATH'):opts['executable_path']=os.environ['CHROMIUM_PATH']
            browser=getattr(p,engine).launch(**opts)
            try:
                for device in ([None,p.devices['iPhone 13']] if engine=='webkit' else [None]):
                    label=engine+('-iphone' if device else '-desktop')
                    if 'editor' in os.getenv('ASSEMBLY_CASES','editor,campaign,orbit'):editor(browser,device,label)
                    if 'campaign' in os.getenv('ASSEMBLY_CASES','editor,campaign,orbit'):campaign(browser,device,label)
                if engine=='chromium' and 'orbit' in os.getenv('ASSEMBLY_CASES','editor,campaign,orbit'):orbit(browser)
            finally:browser.close()
if __name__=='__main__':main()
