import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

// Exercise the shipped inline scripts without adding a production dependency.
function page(file, search = '') {
  const elements = new Map();
  let qrFailure = false;
  let drawFailure = false;
  let generated = 0;
  let downloads = 0;
  function element(tagName = 'DIV') {
    const attributes = new Map();
    const classes = new Set();
    return {
      tagName, value: '', disabled: false, children: [],
      set textContent(value) { this._textContent = value; this.children = []; },
      get textContent() { return this._textContent || ''; },
      listeners: {}, classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
      setAttribute(name, value) { attributes.set(name, value); },
      removeAttribute(name) { attributes.delete(name); if (name === 'href') delete this.href; },
      getAttribute(name) { return attributes.get(name); },
      replaceChildren(...children) { this.children = children; },
      appendChild(child) { this.children.push(child); },
      removeChild(child) { this.children = this.children.filter(x => x !== child); },
      querySelector(selector) { return this.children.find(x => x.tagName.toLowerCase() === selector) || null; },
      addEventListener(name, fn) { this.listeners[name] = fn; },
      focus() {}, click() { downloads++; },
      getContext() {
        return new Proxy({}, { get: (_, key) => key === 'drawImage' ? () => {
          if (drawFailure) throw new Error('Export failed');
        } : () => {} });
      },
      toDataURL() { return 'data:image/png;base64,test'; }
    };
  }
  const document = {
    getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    querySelector(selector) { return this.getElementById(selector); },
    createElement(tag) { return element(tag.toUpperCase()); },
    body: element()
  };
  function QRCode(target) {
    generated++;
    if (qrFailure) throw new Error('Too long data');
    target.setAttribute('title', 'sensitive URL');
    target.appendChild(element('CANVAS'));
  }
  QRCode.CorrectLevel = { H: 2 };
  const context = vm.createContext({
    document, QRCode, URL, URLSearchParams,
    window: { location: { href: 'https://example.com/sub/index.html', search }, open() {} }
  });
  const html = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
    vm.runInContext(match[1], context, { filename: file });
  }
  return {
    get: id => document.getElementById(id),
    run: code => vm.runInContext(code, context),
    failQr: value => { qrFailure = value; },
    failDraw: value => { drawFailure = value; },
    count: () => generated,
    downloads: () => downloads,
    fill(plate, phone = '13800138000') {
      document.getElementById('plateNumber').value = plate;
      document.getElementById('phoneNumber').value = phone;
      vm.runInContext('updateState()', context);
    }
  };
}

test('normalizes ordinary and new-energy plates; avoids redundant QR work', () => {
  const p = page('index.html');
  for (const plate of ['京A88888', '粤b·123456']) {
    p.fill(plate);
    assert.equal(p.get('downloadButton').disabled, false);
    const url = new URL(p.get('previewLink').href);
    assert.equal(url.pathname, '/sub/info.html');
    assert.equal(url.searchParams.get('phoneNumber'), '13800138000');
  }
  assert.equal(p.get('plateNumber').value, '粤B123456');
  p.run('updateState()');
  assert.equal(p.count(), 2);
  assert.equal(p.get('qrcode').getAttribute('title'), undefined);
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
  p.run('updateState()');
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

test('existing info links still dial correctly and normalize formatted plates', () => {
  const p = page('info.html', '?plateNumber=' + encodeURIComponent('粤b·123456') + '&phoneNumber=13800138000');
  assert.equal(p.get('carNumber').textContent, '123456');
  assert.equal(p.get('callButton').href, 'tel:13800138000');
  assert.equal(p.get('callButton').getAttribute('aria-disabled'), 'false');
});

test('malformed info links cannot create executable or arbitrary dial links', () => {
  for (const input of ['', '?plateNumber=<img%20src=x%20onerror=alert(1)>&phoneNumber=javascript:alert(1)', '?plateNumber=京A123456789&phoneNumber=13800138000%3B123']) {
    const p = page('info.html', input);
    assert.equal(p.get('callButton').href, undefined);
    assert.equal(p.get('carNumber').textContent, '车牌无效');
    assert.equal(p.get('.plate-dot').hidden, true);
  }
});
