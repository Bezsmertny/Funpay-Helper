"""Chromium DOM tests against an intercepted fixture, never a real account.

Requires chromium + Python websockets (only for this optional browser test).
The default mode injects production sources and a chrome.storage test adapter,
because managed cloud Chromium disallows extension installation. Set
FPH_REAL_EXTENSION=1 to load the actual unpacked extension on an unmanaged
Chromium 137+ with the Extensions.loadUnpacked DevTools command.
The extension itself has no build or runtime dependencies.
"""
import base64
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
import urllib.request

from websockets.sync.client import connect

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = base64.b64encode((ROOT / 'tests/fixture.html').read_bytes()).decode()
EXT = ROOT / 'extension'
REAL = os.environ.get('FPH_REAL_EXTENSION') == '1'
EXT_ID = ''.join(chr(ord('a') + int(c, 16)) for c in hashlib.sha256(str(EXT).encode()).hexdigest()[:32])
OUTPUT = ROOT / 'dist'
OUTPUT.mkdir(exist_ok=True)
STORAGE_ADAPTER = r"""
(() => {
  const listeners = [];
  const prefix = 'fph-test:';
  const emit = changes => listeners.forEach(listener => listener(changes, 'local'));
  const read = key => JSON.parse(localStorage.getItem(prefix + key) || 'null');
  window.chrome = {storage:{local:{
    async get(keys) {
      if (keys === null) keys = Object.keys(localStorage).filter(k => k.startsWith(prefix)).map(k => k.slice(prefix.length));
      if (typeof keys === 'string') keys = [keys];
      return Object.fromEntries(keys.map(k => [k, read(k)]));
    },
    async set(values) {
      const changes = {};
      for (const [key,value] of Object.entries(values)) {
        const oldValue = read(key); localStorage.setItem(prefix+key, JSON.stringify(value));
        changes[key] = {oldValue, newValue:value};
      }
      queueMicrotask(() => emit(changes));
    },
    async remove(key) { const oldValue=read(key);localStorage.removeItem(prefix+key);queueMicrotask(()=>emit({[key]:{oldValue}})); }
  },onChanged:{addListener(listener){listeners.push(listener);}}}};
  window.addEventListener('storage',event=>{
    if(event.key?.startsWith(prefix)) emit({[event.key.slice(prefix.length)]:{oldValue:JSON.parse(event.oldValue),newValue:JSON.parse(event.newValue)}});
  });
})();
"""


class CDP:
    def __init__(self, url):
        self.ws = connect(url, max_size=20_000_000, proxy=None)
        self.counter = 0
        self.results = {}
        self.errors = []

    def send(self, method, params=None):
        self.counter += 1
        self.ws.send(json.dumps({'id': self.counter, 'method': method, 'params': params or {}}))
        return self.counter

    def call(self, method, params=None):
        request = self.send(method, params)
        deadline = time.monotonic() + 15
        while request not in self.results:
            if time.monotonic() > deadline:
                raise TimeoutError(method)
            data = json.loads(self.ws.recv(timeout=15))
            if 'id' in data:
                self.results[data['id']] = data
                continue
            event = data.get('method')
            p = data.get('params', {})
            if event == 'Fetch.requestPaused':
                path = urllib.parse.urlsplit(p['request']['url']).path
                if path.startswith('/__fph/'):
                    file = EXT / Path(path).name
                    mime = {'.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html'}.get(file.suffix, 'text/plain')
                    body = base64.b64encode(file.read_bytes()).decode() if file.is_file() else ''
                else:
                    body, mime = FIXTURE, 'text/html'
                self.send('Fetch.fulfillRequest', {'requestId': p['requestId'], 'responseCode': 200, 'responseHeaders': [{'name': 'Content-Type', 'value': mime + '; charset=utf-8'}], 'body': body})
            elif event == 'Page.javascriptDialogOpening':
                self.send('Page.handleJavaScriptDialog', {'accept': True})
            elif event == 'Runtime.exceptionThrown':
                self.errors.append(p['exceptionDetails'])
        response = self.results.pop(request)
        if 'error' in response:
            raise RuntimeError(response['error'])
        return response.get('result', {})

    def evaluate(self, expression):
        result = self.call('Runtime.evaluate', {'expression': expression, 'awaitPromise': True, 'returnByValue': True})
        if 'exceptionDetails' in result:
            raise RuntimeError(result['exceptionDetails'])
        return result.get('result', {}).get('value')

    def wait(self, expression, timeout=6):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if self.evaluate(f'Boolean({expression})'):
                return
            time.sleep(.08)
        raise AssertionError(f'Timed out: {expression}')

    def close(self):
        self.ws.close()


SHADOW = "document.getElementById('fph-root').shadowRoot"


def click(cdp, selector):
    cdp.evaluate(f"{SHADOW}.querySelector({json.dumps(selector)}).click()")


def screenshot(cdp, filename):
    data = cdp.call('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': False})
    (OUTPUT / filename).write_bytes(base64.b64decode(data['data']))


def run():
    (OUTPUT / 'browser-results.json').unlink(missing_ok=True)
    profile = tempfile.mkdtemp(prefix='fph-chromium-')
    log = open(Path(profile) / 'chromium.log', 'w')
    command = [os.environ.get('CHROMIUM', shutil.which('chromium') or 'chromium'), '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--enable-unsafe-extension-debugging', f'--user-data-dir={profile}', 'about:blank']
    process = subprocess.Popen(command, stdout=log, stderr=log)
    clients = []
    checks = []

    def passed(label):
        checks.append(label)
        print(f'PASS {label}', flush=True)

    try:
        port_file = Path(profile) / 'DevToolsActivePort'
        for _ in range(100):
            if port_file.exists():
                break
            if process.poll() is not None:
                raise RuntimeError((Path(profile) / 'chromium.log').read_text())
            time.sleep(.1)
        port, endpoint = port_file.read_text().splitlines()
        browser = CDP(f'ws://127.0.0.1:{port}{endpoint}')
        if REAL:
            loaded_id = browser.call('Extensions.loadUnpacked', {'path': str(EXT)})['id']
            assert loaded_id == EXT_ID, (loaded_id, EXT_ID)
        browser.close()

        def page(url='about:blank'):
            request = urllib.request.Request(f'http://127.0.0.1:{port}/json/new?{url}', method='PUT')
            with urllib.request.urlopen(request) as response:
                target = json.load(response)
            cdp = CDP(target['webSocketDebuggerUrl'])
            cdp.target_id = target['id']
            cdp.call('Page.enable')
            cdp.call('Runtime.enable')
            if not REAL:
                cdp.call('Page.addScriptToEvaluateOnNewDocument', {'source': STORAGE_ADAPTER})
            clients.append(cdp)
            return cdp

        chat = page()
        chat.call('Emulation.setDeviceMetricsOverride', {'width': 1280, 'height': 900, 'deviceScaleFactor': 1, 'mobile': False})
        chat.call('Fetch.enable', {'patterns': [{'urlPattern': 'https://funpay.com/*', 'resourceType': 'Document'}]})
        chat.call('Page.navigate', {'url': 'https://funpay.com/chat/?node=test-42'})
        def inject(cdp):
            if not REAL:
                cdp.wait("document.readyState === 'complete' && !!document.querySelector('.chat-form')")
                cdp.evaluate((EXT / 'shared.js').read_text())
                cdp.evaluate((EXT / 'content.js').read_text())
                cdp.evaluate("const theme=document.createElement('style');theme.textContent=" + json.dumps((EXT / 'theme.css').read_text()) + ";document.head.append(theme)")
        inject(chat)
        chat.wait("!!document.getElementById('fph-root')?.shadowRoot && document.documentElement.classList.contains('fph-dark')")
        chat.wait(f"{SHADOW}.getElementById('buyer-name').textContent === 'Alex'")
        passed('Unpacked extension loads on HTTPS origin' if REAL else 'Production content script and theme initialize with test storage adapter')
        assert chat.evaluate("getComputedStyle(document.body).backgroundColor") == 'rgb(17, 19, 25)'
        click(chat, '#launch')
        click(chat, '#reply')
        assert 'Alex' in chat.evaluate("document.querySelector('.chat-form textarea').value")
        assert chat.evaluate('sent.length') == 0
        click(chat, '#reply')
        assert 'уже есть' in chat.evaluate(f"{SHADOW}.getElementById('status').textContent")
        chat.evaluate("document.querySelector('.chat-form textarea').value=''")
        passed('Manual reply inserts template, never submits or overwrites a draft')

        click(chat, '#mark')
        chat.evaluate(f"{SHADOW}.getElementById('tag').value='good'; {SHADOW}.getElementById('label').value='VIP'; {SHADOW}.getElementById('note').value='<img src=x onerror=alert(1)> Постоянный клиент'")
        click(chat, '#save')
        chat.wait("document.querySelector('.chat-header + .fph-badge') || document.querySelector('.chat-header .fph-badge')")
        assert 'VIP' in chat.evaluate("document.querySelector('.fph-badge').textContent")
        passed('Buyer tag and note persist; profile links receive badges')
        click(chat, '#ignore')
        chat.wait("document.querySelector('[data-id=\"100\"]').classList.contains('fph-ignored')")
        assert chat.evaluate("getComputedStyle(document.querySelector('[data-id=\"100\"]')).display") == 'none'
        click(chat, '#show-ignored')
        chat.wait("!document.querySelector('[data-id=\"100\"]').classList.contains('fph-ignored')")
        click(chat, '#ignore')
        passed('Local ignore hides incoming messages, reveal and unignore restore them')
        click(chat, '#review')
        assert 'Alex' in chat.evaluate("document.querySelector('.review-reply-form textarea').value")
        assert chat.evaluate('reviewSent.length') == 0
        passed('Review answer fills correct form without publishing')
        if not REAL:
            chat.evaluate("window.opened=[];window.open=(url)=>{window.opened.push(url);return null}")
            click(chat, '#translate')
            url = urllib.parse.urlsplit(chat.evaluate('opened[0]'))
            assert url.netloc == 'translate.google.com'
            assert 'Быстрая доставка' in urllib.parse.parse_qs(url.query)['text'][0]
            chat.evaluate("const range=document.createRange();range.setStart(document.querySelector('.lot-desc-text').firstChild,0);range.setEnd(document.querySelector('.lot-desc-text').firstChild,7);getSelection().removeAllRanges();getSelection().addRange(range)")
            click(chat, '#translate')
            assert urllib.parse.parse_qs(urllib.parse.urlsplit(chat.evaluate('opened[1]')).query)['text'][0] == 'Быстрая'
            chat.evaluate('getSelection().removeAllRanges()')
            passed('Translation action extracts descriptions or selection into encoded Google Translate URL')

        popup = page()
        if not REAL:
            popup.call('Fetch.enable', {'patterns': [{'urlPattern': 'https://funpay.com/*'}]})
        popup.call('Page.navigate', {'url': f'chrome-extension://{EXT_ID}/popup.html' if REAL else 'https://funpay.com/__fph/popup.html'})
        popup.call('Emulation.setDeviceMetricsOverride', {'width': 410, 'height': 780, 'deviceScaleFactor': 2, 'mobile': False})
        popup.wait("document.getElementById('dark')?.checked === true")
        screenshot(popup, 'popup.png')
        popup.evaluate("document.getElementById('dark').click()")
        chat.wait("!document.documentElement.classList.contains('fph-dark')")
        popup.evaluate("document.getElementById('dark').click(); document.querySelector('[data-tab=answers]').click(); const f=document.getElementById('buyerReply'); f.value='Привет, {buyer}! Скоро отвечу.'; f.dispatchEvent(new Event('input',{bubbles:true})); document.getElementById('reviewAutofill').click()")
        popup.wait("document.getElementById('save-status').textContent === 'Сохранено'")
        popup.evaluate("document.querySelector('[data-tab=buyers]').click()")
        popup.wait("document.querySelector('.buyer-row p')?.textContent.includes('<img')")
        assert popup.evaluate("document.querySelectorAll('#buyers-list img').length") == 0
        passed('Production popup saves preferences live and displays stored notes as text')
        assert popup.evaluate("chrome.storage.local.get('buyer:42').then(v => v['buyer:42'].tag)") == 'good'
        chat.evaluate("document.querySelector('.review-reply-form textarea').value=''; const f=document.createElement('form');f.className='review-reply-form';f.innerHTML='<textarea></textarea>';document.querySelector('.review-item').append(f)")
        chat.wait("document.querySelector('.review-item form:last-child textarea').value.includes('Alex')")
        passed('Optional review autofill reacts to newly opened reply forms')
        chat.call('Page.bringToFront')
        chat.wait("document.visibilityState === 'visible'")
        click(chat, '#auto')
        chat.wait(f"{SHADOW}.getElementById('auto').checked")
        time.sleep(.3)
        assert chat.evaluate('sent.length') == 0
        chat.evaluate("addMessage('99')")
        time.sleep(.3)
        assert chat.evaluate('sent.length') == 0
        passed('Older history inserted after arming is never treated as a new message')
        chat.evaluate("addMessage('101','99')")
        time.sleep(.3)
        assert chat.evaluate('sent.length') == 0
        chat.evaluate("addMessage('102')")
        chat.wait('sent.length === 1')
        assert chat.evaluate('sent[0]') == 'Привет, Alex! Скоро отвечу.'
        chat.evaluate("addMessage('102');addMessage('103')")
        time.sleep(.4)
        assert chat.evaluate('sent.length') == 1
        passed('Armed auto reply sends only new target messages; duplicate and cooldown blocked')

        # The ledger is shared across tabs; a second visible chat must not resend an ID.
        second = page()
        second.call('Fetch.enable', {'patterns': [{'urlPattern': 'https://funpay.com/*', 'resourceType': 'Document'}]})
        second.call('Page.navigate', {'url': 'https://funpay.com/chat/?node=test-42'})
        inject(second)
        second.wait(f"!!document.getElementById('fph-root')?.shadowRoot && !{SHADOW}.getElementById('auto').disabled")
        click(second, '#launch')
        click(second, '#auto')
        second.wait(f"{SHADOW}.getElementById('auto').checked")
        # Clear only the cooldown, retaining the recorded ID, to prove cross-tab dedup.
        popup.evaluate("chrome.storage.local.get('replies:test-42:42').then(v=>chrome.storage.local.set({'replies:test-42:42':{...v['replies:test-42:42'],lastSent:0}}))")
        second.evaluate("addMessage('102')")
        time.sleep(.4)
        assert second.evaluate('sent.length') == 0
        passed('Durable reply ledger prevents repeats in a second tab')
        second.evaluate("document.querySelector('.chat-form textarea').value='Мой незаконченный ответ';addMessage('104')")
        time.sleep(.4)
        assert second.evaluate('sent.length') == 0
        assert second.evaluate("document.querySelector('.chat-form textarea').value") == 'Мой незаконченный ответ'
        second.evaluate("document.querySelector('.chat-form textarea').value=''")
        chat.call('Page.bringToFront')
        second.wait("document.visibilityState === 'hidden'")
        second.evaluate("addMessage('105')")
        time.sleep(.4)
        second.call('Page.bringToFront')
        time.sleep(.3)
        assert second.evaluate('sent.length') == 0
        passed('Hidden tab does not send or later replay messages received in the background')
        second.evaluate("document.querySelector('.chat-form textarea').value='';history.pushState({},'', '?node=test-43')")
        second.wait(f"!{SHADOW}.getElementById('auto').checked")
        passed('Auto reply protects existing drafts and disarms after chat navigation')

        chat.call('Page.bringToFront')
        screenshot(chat, 'panel.png')
        # Capture the popup back in its default tab for a reviewable artifact.
        popup.evaluate("document.querySelector('[data-tab=workspace]').click()")
        popup.call('Page.bringToFront')
        screenshot(popup, 'popup.png')
        errors = [error for client in clients for error in client.errors]
        assert not errors, json.dumps(errors, ensure_ascii=False)
        passed('No uncaught JavaScript exceptions')
        scope = 'Actual unpacked extension' if REAL else 'Production sources injected with chrome.storage test adapter; extension installation unverified'
        (OUTPUT / 'browser-results.json').write_text(json.dumps({'passed': len(checks), 'checks': checks, 'scope': scope + '; intercepted FunPay fixture, not live account'}, ensure_ascii=False, indent=2))
        print(f'{len(checks)} browser checks passed', flush=True)
    except Exception:
        for index, client in enumerate(clients):
            try:
                print('DIAGNOSTICS', index, client.evaluate("JSON.stringify({url:location.href,title:document.title,body:document.body?.innerText.slice(0,300),helper:!!document.getElementById('fph-root')})"), client.errors, flush=True)
            except Exception as error:
                print('Diagnostics unavailable:', error, flush=True)
        print((Path(profile) / 'chromium.log').read_text()[-6000:], flush=True)
        raise
    finally:
        for client in clients:
            client.close()
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
        log.close()
        shutil.rmtree(profile, ignore_errors=True)


if __name__ == '__main__':
    run()
