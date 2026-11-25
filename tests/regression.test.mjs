import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

function readPublic(relPath) {
  return readFileSync(new URL('../public/' + relPath, import.meta.url), 'utf8');
}

// Exercise the shipped externalized scripts without adding a production dependency.
function page(file, search = '', options = {}) {
  const elements = new Map();
  const docListeners = {};
  let qrFailure = false;
  let drawFailure = false;
  let generated = 0;
  let downloads = 0;
  let focusedId = null;

  function element(tagName = 'DIV', id = '') {
    const attributes = new Map();
    const classes = new Set();
    const el = {
      id,
      tagName,
      value: '',
      disabled: false,
      hidden: id === 'saveModal',
      children: [],
      set textContent(value) { this._textContent = value; this.children = []; },
      get textContent() { return this._textContent || ''; },
      listeners: {},
      classList: {
        add: name => classes.add(name),
        remove: name => classes.delete(name),
        contains: name => classes.has(name)
      },
      setAttribute(name, value) { attributes.set(name, value); },
      removeAttribute(name) {
        attributes.delete(name);
        if (name === 'href') delete this.href;
        if (name === 'src') delete this.src;
      },
      getAttribute(name) { return attributes.get(name); },
      replaceChildren(...children) { this.children = children; },
      appendChild(child) { this.children.push(child); },
      removeChild(child) { this.children = this.children.filter(x => x !== child); },
      querySelector(selector) { return this.children.find(x => x.tagName.toLowerCase() === selector) || null; },
      addEventListener(name, fn) { this.listeners[name] = fn; },
      focus() { focusedId = id || tagName; },
      click() { downloads++; },
      getContext() {
        return new Proxy({}, {
          get: (_, key) => key === 'drawImage'
            ? () => {
                if (drawFailure) throw new Error('Export failed');
              }
            : () => {}
        });
      },
      toDataURL() { return 'data:image/png;base64,test'; }
    };
    return el;
  }

  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, element('DIV', id));
      return elements.get(id);
    },
    querySelector(selector) { return this.getElementById(selector); },
    createElement(tag) { return element(tag.toUpperCase()); },
    addEventListener(name, fn) { docListeners[name] = fn; },
    body: element('BODY')
  };

  function QRCode(target) {
    generated++;
    if (qrFailure) throw new Error('Too long data');
    target.setAttribute('title', 'sensitive URL');
    target.appendChild(element('CANVAS'));
  }
  QRCode.CorrectLevel = { H: 2 };

  const context = vm.createContext({
    document,
    QRCode,
    URL,
    URLSearchParams,
    navigator: { userAgent: options.userAgent || 'Mozilla/5.0 Chrome/130.0' },
    window: { location: { href: 'https://example.com/sub/index.html', search }, open() {} }
  });

  const html = readPublic(file);
  const scriptMatches = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  assert.ok(scriptMatches.length > 0, `${file} should reference external scripts`);

  for (const [, attrs, body] of scriptMatches) {
    assert.equal(body.trim(), '', `${file} must not contain inline <script> code`);
    assert.match(attrs, /\bdefer\b/, `${file} script tags should use defer`);
    const srcMatch = attrs.match(/\bsrc="([^"]+)"/);
    assert.ok(srcMatch, `${file} script tag must specify src`);
    const src = srcMatch[1];
    if (src === 'qrcode.min.js') {
      continue;
    }
    const scriptCode = readPublic(src);
    vm.runInContext(scriptCode, context, { filename: 'public/' + src });
  }

  return {
    get: id => document.getElementById(id),
    docListeners,
    run: code => vm.runInContext(code, context),
    failQr: value => { qrFailure = value; },
    failDraw: value => { drawFailure = value; },
    count: () => generated,
    downloads: () => downloads,
    focused: () => focusedId,
    triggerInput() {
      document.getElementById('plateNumber').listeners.input();
    },
    fill(plate, phone = '13800138000') {
      document.getElementById('plateNumber').value = plate;
      document.getElementById('phoneNumber').value = phone;
      document.getElementById('plateNumber').listeners.input();
    }
  };
}

test('normalizes ordinary and new-energy plates (including U+2022 bullet); avoids redundant QR work', () => {
  const p = page('index.html');
  for (const plate of ['京A88888', '京A•88888', '粤b·123456', '粤b•123456']) {
    p.fill(plate);
    assert.equal(p.get('downloadButton').disabled, false);
    const url = new URL(p.get('previewLink').href);
    assert.equal(url.pathname, '/sub/info.html');
    assert.equal(url.searchParams.get('phoneNumber'), '13800138000');
  }
  assert.equal(p.get('plateNumber').value, '粤B123456');
  assert.equal(p.get('previewPlate').classList.contains('plate--nev'), true);
  p.triggerInput();
  // Only 2 distinct normalized plates (京A88888 and 粤B123456) should trigger QR generation.
  assert.equal(p.count(), 2);
  assert.equal(p.get('qrcode').getAttribute('title'), undefined);

  p.fill('京A•88888');
  assert.equal(p.get('plateNumber').value, '京A88888');
  assert.equal(p.get('previewPlate').classList.contains('plate--nev'), false);
});

test('normalizes pasted +86 and formatted phone numbers without truncating prematurely', () => {
  const indexHtml = readPublic('index.html');
  const maxLengthMatch = indexHtml.match(/id="phoneNumber"[^>]*maxlength="(\d+)"/);
  assert.ok(maxLengthMatch && Number(maxLengthMatch[1]) >= 20, 'phoneNumber maxlength must allow pasted +86 formats');

  const p = page('index.html');
  for (const phone of ['+86 138-0013-8000', '+8613800138000', '0086 138 0013 8000', '138 0013 8000']) {
    p.fill('京A88888', phone);
    assert.equal(p.get('phoneNumber').value, '13800138000');
    assert.equal(p.get('downloadButton').disabled, false);
    assert.equal(p.get('phoneNumberError').textContent, '');
  }

  // Overlong +86 numbers must not be silently truncated into a valid 11-digit phone number.
  p.fill('京A88888', '+86 138-0013-80001');
  assert.equal(p.get('downloadButton').disabled, true);
  assert.equal(p.get('phoneNumberError').textContent, '请输入 11 位中国大陆手机号');
});

test('overlong plates are rejected rather than silently changing identity', () => {
  const p = page('index.html');
  p.fill('粤B1234567');
  assert.equal(p.get('plateNumber').value, '粤B1234567');
  assert.equal(p.get('downloadButton').disabled, true);
  assert.equal(p.get('plateNumberError').textContent, '请输入正确的车牌号');
  assert.equal(p.get('previewNumber').textContent, '123456');
});

test('invalid inputs and clearing remove actionable links and sensitive titles', () => {
  const p = page('index.html');
  p.fill('京A88888');
  p.get('qrcode').setAttribute('title', 'old phone number');
  p.get('resetButton').listeners.click();
  assert.equal(p.get('qrcode').getAttribute('title'), undefined);
  assert.equal(p.get('previewLink').href, undefined);
  assert.equal(p.get('previewLink').getAttribute('aria-disabled'), 'true');
  assert.equal(p.get('downloadButton').disabled, true);
  p.fill('京A88888', '23800138000');
  assert.equal(p.get('downloadButton').disabled, true);
});

test('QR failures leave no usable link and retrying the same input works', () => {
  const p = page('index.html');
  p.failQr(true);
  p.fill('京A88888');
  assert.equal(p.get('previewLink').href, undefined);
  assert.equal(p.get('downloadButton').disabled, true);
  assert.match(p.get('qrStatus').textContent, /生成失败/);
  p.failQr(false);
  p.triggerInput();
  assert.equal(p.get('downloadButton').disabled, false);
});

test('IME input is not committed before composition ends', () => {
  const p = page('index.html');
  p.get('plateNumber').value = '粤b·12345';
  p.get('plateNumber').listeners.compositionstart();
  p.get('plateNumber').listeners.input();
  assert.equal(p.get('plateNumber').value, '粤b·12345');
  p.get('plateNumber').listeners.compositionend();
  assert.equal(p.get('plateNumber').value, '粤B12345');
});

test('exports recover from errors and discard a stale asynchronous download', async () => {
  const p = page('index.html');
  p.fill('京A88888');
  p.failDraw(true);
  await p.get('downloadButton').listeners.click();
  assert.match(p.get('qrStatus').textContent, /下载失败/);
  assert.equal(p.get('downloadButton').disabled, false);
  p.failDraw(false);
  const pending = p.get('downloadButton').listeners.click();
  p.get('resetButton').listeners.click();
  await pending;
  assert.equal(p.downloads(), 0);
  assert.equal(p.get('downloadButton').disabled, true);
  p.fill('京A88888');
  await p.get('downloadButton').listeners.click();
  assert.equal(p.downloads(), 1);
});

test('WeChat browser download shows accessible long-press save modal instead of silent download', async () => {
  const p = page('index.html', '', {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) MicroMessenger/8.0.47'
  });
  p.fill('京A88888');
  await p.get('downloadButton').listeners.click();
  assert.equal(p.downloads(), 0);
  assert.equal(p.get('saveModal').hidden, false);
  assert.equal(p.get('saveModalImage').src, 'data:image/png;base64,test');
  assert.match(p.get('qrStatus').textContent, /长按/);
  assert.equal(p.focused(), 'closeSaveModal');

  p.docListeners.keydown({ key: 'Escape' });
  assert.equal(p.get('saveModal').hidden, true);
  assert.equal(p.get('saveModalImage').src, undefined);
  assert.equal(p.focused(), 'downloadButton');
});

test('existing info links still dial correctly and normalize formatted plates including U+2022', () => {
  for (const rawPlate of ['粤b·123456', '粤b•123456']) {
    const p = page('info.html', '?plateNumber=' + encodeURIComponent(rawPlate) + '&phoneNumber=13800138000');
    assert.equal(p.get('carProvince').textContent, '粤');
    assert.equal(p.get('carLetter').textContent, 'B');
    assert.equal(p.get('carNumber').textContent, '123456');
    assert.equal(p.get('carPlate').classList.contains('plate--nev'), true);
    assert.equal(p.get('callButton').href, 'tel:13800138000');
    assert.equal(p.get('callButton').getAttribute('aria-disabled'), 'false');
  }
});

test('malformed info links cannot create executable or arbitrary dial links', () => {
  for (const input of ['', '?plateNumber=<img%20src=x%20onerror=alert(1)>&phoneNumber=javascript:alert(1)', '?plateNumber=京A123456789&phoneNumber=13800138000%3B123']) {
    const p = page('info.html', input);
    assert.equal(p.get('callButton').href, undefined);
    assert.equal(p.get('carNumber').textContent, '车牌无效');
    assert.equal(p.get('.plate-dot').hidden, true);
    assert.equal(p.get('carPlate').classList.contains('plate--nev'), false);
  }
});

test('strict CSP headers, robots.txt, pure-static copy, and externalized assets are enforced', () => {
  for (const file of ['index.html', 'info.html']) {
    const html = readPublic(file);
    assert.doesNotMatch(html, /<style\b/i, `${file} must not contain inline <style>`);
    assert.doesNotMatch(html, /\sstyle=/i, `${file} must not contain inline style attributes`);
    assert.match(html, /<link\s+rel="stylesheet"\s+href="styles\.css">/);
  }

  const indexHtml = readPublic('index.html');
  assert.doesNotMatch(indexHtml, /class="button call-preview"/, 'static call-preview must not use interactive .button class');

  const infoHtml = readPublic('info.html');
  assert.doesNotMatch(infoHtml, /为保护隐私/, 'info.html must not falsely imply phone privacy/encryption');
  assert.match(infoHtml, /纯静态/);

  const headers = readPublic('_headers');
  assert.match(headers, /X-Content-Type-Options:\s*nosniff/);
  assert.match(headers, /X-Frame-Options:\s*DENY/);
  assert.match(headers, /Referrer-Policy:\s*no-referrer/);
  assert.match(headers, /Permissions-Policy:/);
  assert.match(headers, /Content-Security-Policy:\s*default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'/);
  assert.doesNotMatch(headers, /unsafe-inline|unsafe-eval/);
  assert.match(headers, /\/info\n\s+X-Robots-Tag:\s*noindex,\s*nofollow/);
  assert.match(headers, /\/info\.html\n\s+X-Robots-Tag:\s*noindex,\s*nofollow/);

  const robots = readPublic('robots.txt');
  assert.match(robots, /Disallow:\s*\/info/);

  const css = readPublic('styles.css');
  assert.match(css, /--accent:\s*#047857;/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);

  // Publishable files must live in public/, not repo root.
  for (const moved of ['index.html', 'info.html', 'qrcode.min.js', 'electric-car-charging.svg', '_headers']) {
    assert.equal(existsSync(new URL('../' + moved, import.meta.url)), false, `${moved} should be moved into public/`);
    assert.equal(existsSync(new URL('../public/' + moved, import.meta.url)), true, `public/${moved} should exist`);
  }
});
