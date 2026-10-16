/* Shared by the popup, isolated content script and dependency-free unit tests. */
((root) => {
  'use strict';
  const DEFAULTS = Object.freeze({
    dark: true,
    motion: true,
    buyerReply: 'Здравствуйте, {buyer}! Спасибо за сообщение. Скоро отвечу вам.',
    reviewReply: '{buyer}, спасибо за отзыв и покупку! Буду рад видеть вас снова 💜',
    reviewAutofill: false,
    language: 'en'
  });
  const LANGUAGES = Object.freeze({ en: 'English', ru: 'Русский', uk: 'Українська', de: 'Deutsch', fr: 'Français', es: 'Español' });
  const TAGS = Object.freeze({ good: { label: 'Надёжный', icon: '✓' }, neutral: { label: 'Без оценки', icon: '•' }, bad: { label: 'Осторожно', icon: '!' } });
  function userId(value) {
    try {
      const url = new URL(value, 'https://funpay.com');
      if (url.origin !== 'https://funpay.com') return null;
      return url.pathname.match(/^\/users\/(\d+)\/?$/)?.[1] || null;
    } catch { return null; }
  }
  function settings(value) {
    const v = value && typeof value === 'object' ? value : {};
    return {
      ...DEFAULTS,
      ...Object.fromEntries(['dark', 'motion', 'reviewAutofill'].filter(k => typeof v[k] === 'boolean').map(k => [k, v[k]])),
      ...Object.fromEntries(['buyerReply', 'reviewReply'].filter(k => typeof v[k] === 'string').map(k => [k, v[k].slice(0, 2000)])),
      language: Object.hasOwn(LANGUAGES, v.language) ? v.language : DEFAULTS.language
    };
  }
  function buyer(value) {
    const v = value && typeof value === 'object' ? value : {};
    return { name: typeof v.name === 'string' ? v.name.slice(0, 100) : '', tag: Object.hasOwn(TAGS, v.tag) ? v.tag : 'neutral', label: typeof v.label === 'string' ? v.label.slice(0, 24) : '', note: typeof v.note === 'string' ? v.note.slice(0, 500) : '', ignored: v.ignored === true };
  }
  function renderTemplate(text, name) {
    return String(text).replaceAll('{buyer}', name || 'покупатель').trim().slice(0, 2000);
  }
  function translationUrl(text, language) {
    if (!text.trim()) return null;
    const url = new URL('https://translate.google.com/');
    url.search = new URLSearchParams({ sl: 'auto', tl: Object.hasOwn(LANGUAGES, language) ? language : 'en', text: text.slice(0, 4500), op: 'translate' });
    return url.href;
  }
  function mayReply(message, context) {
    return Boolean(context.armed && context.visible && !context.ignored && !context.busy && message.id && message.author === context.target && context.target && message.text?.trim() && !context.seen.includes(message.id) && context.now - context.lastSent >= 60000);
  }
  function messageNumber(id) {
    return typeof id === 'string' && /^\d{1,30}$/.test(id) ? BigInt(id) : null;
  }
  root.FPH = Object.freeze({ DEFAULTS, LANGUAGES, TAGS, userId, settings, buyer, renderTemplate, translationUrl, mayReply, messageNumber });
})(globalThis);
