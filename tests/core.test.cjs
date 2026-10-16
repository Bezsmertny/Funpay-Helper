const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../extension/shared.js');
const { FPH } = globalThis;
test('extracts only canonical FunPay user IDs', () => {
  assert.equal(FPH.userId('/users/42/'), '42');
  assert.equal(FPH.userId('https://funpay.com/users/123/'), '123');
  for (const url of ['https://evil.test/users/42/', 'https://funpay.com.evil.test/users/42/', '/users/42/delete', '/users/abc/', '/chat/', 'javascript:alert(1)']) assert.equal(FPH.userId(url), null);
});
test('storage validation rejects wrong types and unknown settings', () => {
  const result = FPH.settings({ dark: false, motion: 'false', language: '__proto__', buyerReply: 'x'.repeat(2500), extra: 'invalid' });
  assert.equal(result.dark, false); assert.equal(result.motion, true); assert.equal(result.language, 'en');
  assert.equal(result.buyerReply.length, 2000); assert.equal(result.extra, undefined);
  assert.deepEqual(FPH.buyer({ tag: 'constructor', ignored: 'yes', note: 'x'.repeat(900) }), { tag: 'neutral', ignored: false, name: '', label: '', note: 'x'.repeat(500) });
});
test('message ordering rejects missing IDs and supports large numeric IDs without rounding', () => {
  assert.equal(FPH.messageNumber('9007199254740993'), 9007199254740993n);
  for (const value of ['', 'm2', null, '1.5', '-1']) assert.equal(FPH.messageNumber(value), null);
});
test('templates substitute literal names without evaluating HTML', () => {
  assert.equal(FPH.renderTemplate('Привет, {buyer}! {buyer}', '<img src=x>'), 'Привет, <img src=x>! <img src=x>');
  assert.equal(FPH.renderTemplate(' {buyer} ', ''), 'покупатель');
});
test('translation encodes user text as data on a fixed HTTPS destination', () => {
  const url = new URL(FPH.translationUrl('A & B? <tag> #1', 'uk'));
  assert.equal(url.origin, 'https://translate.google.com'); assert.equal(url.searchParams.get('text'), 'A & B? <tag> #1'); assert.equal(url.searchParams.get('tl'), 'uk');
  assert.equal(FPH.translationUrl('  ', 'en'), null);
  assert.equal(new URL(FPH.translationUrl('x'.repeat(5000), 'en')).searchParams.get('text').length, 4500);
});
test('auto reply gates identity, visibility, ignore, cooldown and duplicate history', () => {
  const msg = { id: 'm2', author: '42', text: 'Здравствуйте' };
  const ctx = { armed: true, visible: true, target: '42', ignored: false, busy: false, seen: [], lastSent: 1000, now: 61000 };
  assert.equal(FPH.mayReply(msg, ctx), true);
  for (const override of [{ armed: false }, { visible: false }, { target: '43' }, { target: null }, { ignored: true }, { busy: true }, { seen: ['m2'] }, { now: 60999 }]) assert.equal(FPH.mayReply(msg, { ...ctx, ...override }), false);
  for (const override of [{ id: '' }, { author: null }, { text: ' ' }]) assert.equal(FPH.mayReply({ ...msg, ...override }, ctx), false);
});
