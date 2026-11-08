import asyncio,json,re,os
from pathlib import Path
BASE_URL=os.getenv("MISSION_URL","http://127.0.0.1:8080").rstrip("/")
OUTPUT=Path(os.getenv("MISSION_QA_OUTPUT","work/browser-qa"));OUTPUT.mkdir(parents=True,exist_ok=True)
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
  context=await browser.new_context(viewport={'width':1440,'height':1100})
  await context.route('**/*',lambda route:route.continue_() if route.request.url.startswith(BASE_URL) else route.abort())
  page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  async def click(text):
   print('CLICK',text,flush=True);loc=page.get_by_role('button',name=text,exact=False)
   if await loc.count()==0:loc=page.get_by_text(text,exact=False)
   await loc.first.click(force=True);await page.wait_for_timeout(450)
  async def ready():
   await page.goto(BASE_URL);await page.locator('flt-semantics-placeholder').evaluate('(e)=>e.click()');await page.get_by_text('Small steps. Infinite possibilities.',exact=True).wait_for()
  await ready();print('Offline desktop startup passed',flush=True)
  await click('Enter mission control');await click('Touch the edge');await click('Design spacecraft')
  await page.get_by_text('FLIGHT READY',exact=True).wait_for();await page.screenshot(path=str(OUTPUT/'workshop.png'))
  await click('Proceed to launch');await click('Save & return to console')
  await ready();await click('Continue mission');await page.get_by_text('SIMULATION PAUSED',exact=True).wait_for();print('Reload and paused active-flight restore passed',flush=True)
  await click('Ignition & liftoff')
  sep=page.get_by_role('button',name='Separate interstage',exact=True)
  await sep.wait_for(timeout=45000);await sep.click(force=True)
  await page.screenshot(path=str(OUTPUT/'flight.png'));print('Animated ascent controls passed',flush=True)
  await page.get_by_text('Beyond the launch.',exact=True).wait_for(timeout=55000)
  # Mission 1 uses deterministic seed 43; accept the first anomaly response.
  buttons=page.get_by_role('button'); names=await buttons.all_text_contents();print('OPS',names,flush=True)
  for option in ['Shed instrument load','Enter safe mode','Correct trajectory · 120 m/s']:
   if await page.get_by_role('button',name=option,exact=True).count():await click(option);break
  for action in ['Execute manoeuvre','Confirm approach','Collect observations','Transmit & complete']:await click(action)
  await page.get_by_text('Knowledge, brought home.',exact=True).wait_for();await page.screenshot(path=str(OUTPUT/'success.png'));print('Full mission success passed',flush=True)
  await click('Back to the programme');await click('Overview Overview') if await page.get_by_role('button',name='Overview Overview',exact=True).count() else await click('Overview')
  await ready();body=await page.locator('body').inner_text();assert '$50.2' in body,body;assert '01 / 04' in body,body
  print('Reward, unlock and reload persistence passed',flush=True)
  # Verify the NASA feature fails gracefully with external network blocked.
  await click('Discovery Discovery') if await page.get_by_role('button',name='Discovery Discovery',exact=True).count() else await click('Discovery')
  await click('Discover NASA images');await page.get_by_text('NASA is unreachable right now.',exact=False).wait_for(timeout=15000);print('NASA offline fallback passed',flush=True)
  mobile=await context.new_page();await mobile.set_viewport_size({'width':390,'height':844});await mobile.goto(BASE_URL);await mobile.locator('flt-semantics-placeholder').evaluate('(e)=>e.click()');await mobile.get_by_text('Small steps. Infinite possibilities.',exact=True).wait_for();await mobile.screenshot(path=str(OUTPUT/'mobile.png'));print('Phone viewport passed',flush=True)
  assert not errors,errors;print('PASS: no uncaught browser errors',flush=True)
  await browser.close()
asyncio.run(main())
