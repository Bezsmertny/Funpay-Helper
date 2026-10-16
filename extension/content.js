/* global FPH, chrome */
(() => {
  'use strict';
  if (document.getElementById('fph-root')) return;
  const host = document.createElement('div'); host.id = 'fph-root';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host{all:initial;color-scheme:dark;position:fixed;bottom:22px;right:22px;z-index:2147483000;font:13px/1.5 system-ui,sans-serif;color:#eee9f7}*{box-sizing:border-box}[hidden]{display:none!important}button,input,textarea,select{font:inherit}button{cursor:pointer}button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid #c2a5ff;outline-offset:3px}button:disabled{opacity:.4;cursor:not-allowed}.launch{border:1px solid #cbb3ff40;background:#211c2d;color:#ddccff;border-radius:15px;padding:12px 18px;box-shadow:0 7px 24px #0004;font-weight:650;display:block;margin-left:auto}.launch span{display:inline-grid;place-items:center;background:#c3a6fa;color:#21192e;border-radius:6px;width:22px;height:22px;font-size:14px;font-style:italic;margin-right:7px}.panel{background:#15151e;border:1px solid #ffffff18;border-radius:18px;width:min(330px,calc(100vw - 32px));max-height:calc(100vh - 110px);overflow:auto;box-shadow:0 18px 70px #0006;margin-bottom:10px;padding:20px}.head{display:flex;justify-content:space-between;align-items:center}.head strong{font-size:16px;letter-spacing:-.5px}.head small{display:block;color:#8f839e;font-size:10px;margin-top:2px}.close{color:#9f91af;background:transparent;border:none;font-size:22px;padding:0 4px}.eyebrow{font-size:9px;letter-spacing:1.5px;color:#8e829f;margin:22px 0 9px}.actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}.action{border:1px solid #ffffff0d;background:#201e2b;color:#d1c1e5;border-radius:10px;min-height:60px;padding:10px 8px;font-size:11px;line-height:1.6;transition:background .16s,transform .16s}.action:hover{background:#2a2539;transform:translateY(-1px)}.action span{display:block;font-size:17px;color:#c5a7ff}.wide{grid-column:1/-1;min-height:38px}.current{border:1px solid #ffffff0b;border-radius:10px;background:#1c1a26;padding:12px;display:flex;gap:9px;align-items:center}.avatar{background:#c4a9fa1c;color:#d1b6ff;display:grid;place-items:center;border-radius:8px;width:30px;height:30px;font-weight:700}.current div:last-child{min-width:0}.current strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.current small{font-size:10px;color:#92829f}.toggle{display:flex;align-items:flex-start;gap:8px;padding:12px 0 0;color:#b4a2c8;font-size:11px}.toggle input{accent-color:#bfa0fb;margin-top:3px}.help{font-size:10px;color:#8c7c9c;line-height:1.6;margin:7px 0 0}.status{color:#c9b4e7;background:#c8a9ff09;border:1px solid #c8a9ff10;border-radius:8px;padding:9px 10px;font-size:11px;margin-top:15px;overflow-wrap:anywhere;min-height:36px}.status.error{color:#edba98}.editor{border-top:1px solid #ffffff13;margin-top:16px;padding-top:14px}.editor h3{font-size:13px;margin:0 0 10px}.editor label{display:block;font-size:10px;color:#a797ba;margin-top:10px}.editor select,.editor textarea{margin-top:5px;width:100%;border:1px solid #ffffff19;background:#101017;color:#d8c7ed;border-radius:7px;padding:8px;font-size:12px}.editor textarea{resize:vertical;max-height:160px;min-height:70px}.editor .buttons{display:flex;gap:8px;margin-top:12px}.primary,.secondary{border:0;border-radius:7px;padding:9px 13px;font-size:11px}.primary{background:#c2a5f8;color:#251b34;flex:1;font-weight:650}.secondary{background:#30283c;color:#c1adD8}.local{font-size:9px;color:#7e708c;margin:14px 0 0}.toolbar{display:flex;gap:10px;justify-content:space-between;margin:14px 0 -6px}.toolbar button{background:none;border:0;color:#a28dbb;font-size:10px;padding:0}.pick-cancel{color:#e8ba98!important}@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}:host-context(html:not(.fph-motion)) *{transition:none!important}
    </style>
    <section id="panel" class="panel" hidden aria-label="FunPay Helper">
      <div class="head"><div><strong>funpay <span style="color:#c2a5fa">helper</span></strong><small>Маленькие инструменты. Большая разница.</small></div><button id="close" class="close" aria-label="Закрыть панель">×</button></div>
      <div class="eyebrow">ПОКУПАТЕЛЬ</div>
      <div class="current"><span id="avatar" class="avatar">?</span><div><strong id="buyer-name">Выберите покупателя</strong><small id="buyer-description">Откройте чат или профиль</small></div></div>
      <div class="eyebrow">ПОД РУКОЙ</div>
      <div class="actions">
        <button id="mark" class="action"><span>◇</span>Метка покупателя</button>
        <button id="ignore" class="action"><span>⊘</span><b id="ignore-label" style="font-weight:400">В локальный игнор</b></button>
        <button id="reply" class="action"><span>↩</span>Ответ покупателю</button>
        <button id="review" class="action"><span>♡</span>Ответы на отзывы</button>
        <button id="translate" class="action wide">文 &nbsp; Перевести описание / выделение ↗</button>
      </div>
      <label class="toggle"><input id="auto" type="checkbox"><span>Автоответ в этом чате</span></label>
      <p class="help">Только новые сообщения выбранного покупателя. Вкладка должна быть видна. Не чаще раза в минуту.</p>
      <div class="toolbar"><button id="pick">Выбрать по ссылке на профиль</button><button id="show-ignored">Показать игнор</button></div>
      <section id="editor" class="editor" hidden aria-label="Метка покупателя">
        <h3>Запомнить покупателя</h3>
        <label>Метка<select id="tag"><option value="neutral">• Без оценки</option><option value="good">✓ Надёжный</option><option value="bad">! Осторожно</option></select></label>
        <label>Своя подпись<input id="label" maxlength="24" placeholder="Например: VIP или Сложный заказ" style="margin-top:5px;width:100%;border:1px solid #ffffff19;background:#101017;color:#d8c7ed;border-radius:7px;padding:8px;font-size:12px"></label>
        <label>Личная заметка<textarea id="note" maxlength="500" placeholder="Например: постоянный покупатель, любит быстрые ответы"></textarea></label>
        <div class="buttons"><button id="save" class="primary">Сохранить</button><button id="cancel" class="secondary">Отмена</button></div>
      </section>
      <output id="status" class="status" style="display:block" aria-live="polite">Готов помочь ✦</output>
      <p class="local">Игнор и метки локальные. Блокировку в аккаунте FunPay расширение не меняет.</p>
    </section>
    <button id="launch" class="launch" aria-expanded="false"><span>fh</span>Helper</button>`;
  document.documentElement.append(host);
  const $ = id => shadow.getElementById(id);
  let preferences = FPH.settings();
  let records = {};
  let target = null;
  let picked = null;
  let editing = null;
  let picking = false;
  let showIgnored = false;
  let armed = null;
  let busy = false;
  let seen = new Set();
  let lastSent = 0;
  let storageReady = false;
  let timer;
  const reviewed = new WeakSet();
  const decorated = new WeakMap();
  const handledMessages = new WeakSet();
  const placeholders = new WeakMap();
  function status(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
  function visible(el) { return Boolean(el && el.getClientRects().length && !el.closest('[hidden]') && getComputedStyle(el).visibility !== 'hidden'); }
  function linkUser(link) {
    const id = link && FPH.userId(link.href);
    return id ? { id, name: link.textContent.trim().slice(0, 100) || `Покупатель #${id}` } : null;
  }
  function chatTarget() {
    for (const a of document.querySelectorAll('.chat-header a[href*="/users/"], .chat-header-info a[href*="/users/"], .chat-header .media-user-name[href]')) {
      const user = linkUser(a); if (user && visible(a)) return user;
    }
    return null;
  }
  function chatKey() {
    const node = new URL(location.href).searchParams.get('node');
    return node && /^[\w-]{1,100}$/.test(node) ? node : null;
  }
  function getForm() {
    const field = document.querySelector('form.chat-form textarea, .chat-form form textarea, form[action*="/chat/"] textarea');
    const form = field?.closest('form');
    const submit = form?.querySelector('button[type="submit"], input[type="submit"]');
    return field && submit && visible(field) && visible(submit) && !field.disabled && !field.readOnly && !submit.disabled ? { field, form, submit } : null;
  }
  function getMessages() {
    return [...document.querySelectorAll('.chat-msg-item[data-id], .chat-message[data-id]')].map(el => ({
      el, id: el.getAttribute('data-id'),
      author: FPH.userId(el.querySelector('.chat-msg-author-link[href], .chat-message-author a[href]')?.href || ''),
      text: el.querySelector('.chat-msg-text, .chat-message-text')?.textContent || ''
    }));
  }
  function setField(field, text) {
    const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field, text);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function disarm(message) {
    armed = null; $('auto').checked = false;
    if (message) status(message);
  }
  function updateTarget() {
    const header = chatTarget();
    const profileId = FPH.userId(location.href);
    const profile = profileId ? { id: profileId, name: document.querySelector('.profile-header h1, h1')?.textContent.trim().slice(0, 100) || `Покупатель #${profileId}` } : null;
    const next = picked || header || profile;
    if (next?.id !== target?.id) { editing = null; $('editor').hidden = true; if (armed) disarm('Автоответ выключен: покупатель изменился.'); }
    target = next;
    if (armed && (armed.key !== chatKey() || armed.user !== header?.id)) disarm('Автоответ выключен: чат изменился.');
    const record = FPH.buyer(records[target?.id]);
    if (armed && record.ignored) disarm('Автоответ выключен: покупатель в игноре.');
    const name = target?.name || 'Выберите покупателя';
    if ($('buyer-name').textContent !== name) $('buyer-name').textContent = name;
    const description = target ? `#${target.id} · ${record.ignored ? 'Локальный игнор' : record.label || FPH.TAGS[record.tag].label}` : 'Откройте чат или профиль';
    if ($('buyer-description').textContent !== description) $('buyer-description').textContent = description;
    $('avatar').textContent = target?.name?.charAt(0).toUpperCase() || '?';
    $('ignore-label').textContent = record.ignored ? 'Убрать из игнора' : 'В локальный игнор';
    for (const name of ['mark', 'ignore']) $(name).disabled = !target || !storageReady;
    $('reply').disabled = !getForm() || !target || header?.id !== target.id;
    $('auto').disabled = !header || !chatKey() || header.id !== target?.id || !getForm() || record.ignored || !storageReady || !navigator.locks;
  }
  function applyPreferences() {
    document.documentElement.classList.toggle('fph-dark', preferences.dark);
    document.documentElement.classList.toggle('fph-motion', preferences.motion);
  }
  function badgeLinks() {
    for (const link of document.querySelectorAll('a[href*="/users/"]')) {
      const user = linkUser(link); if (!user) continue;
      let entry = decorated.get(link);
      if (entry && entry.id !== user.id) { entry.badge.remove(); decorated.delete(link); entry = null; }
      const record = records[user.id];
      if (!record || (!record.note && !record.label && record.tag === 'neutral' && !record.ignored)) { if (entry) { entry.badge.remove(); decorated.delete(link); } continue; }
      if (!entry || !entry.badge.isConnected) {
        const badge = document.createElement('button'); badge.type = 'button'; badge.className = 'fph-badge';
        badge.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); picked = user; updateTarget(); openPanel(); openEditor(); });
        link.after(badge); entry = { id: user.id, badge }; decorated.set(link, entry);
      }
      const label = record.ignored ? '⊘ Игнор' : `${FPH.TAGS[record.tag].icon} ${record.label || FPH.TAGS[record.tag].label}`;
      if (entry.badge.textContent !== label) entry.badge.textContent = label;
      entry.badge.dataset.tag = record.ignored ? 'bad' : record.tag;
      entry.badge.title = record.note || 'Изменить метку';
      entry.badge.setAttribute('aria-label', `${label}: ${user.name}. Изменить метку`);
    }
  }
  function applyIgnore(messages) {
    for (const { el, author } of messages) {
      const hide = Boolean(records[author]?.ignored && !showIgnored);
      el.classList.toggle('fph-ignored', hide);
      let placeholder = placeholders.get(el);
      if (hide && (!placeholder || !placeholder.isConnected)) {
        placeholder = document.createElement('div'); placeholder.className = 'fph-ignore-placeholder';
        const button = document.createElement('button'); button.type = 'button'; button.textContent = '⊘ Сообщение в локальном игноре · показать';
        button.onclick = () => { showIgnored = true; $('show-ignored').textContent = 'Скрыть игнор'; scan(); };
        placeholder.append(button); el.after(placeholder); placeholders.set(el, placeholder);
      }
      if (placeholder) placeholder.hidden = !hide;
    }
  }
  function reviewFields() {
    return [...document.querySelectorAll('form.review-reply-form textarea, .review-item .review-answer-form textarea, .review-item form[data-action="reply"] textarea, .review-container .review-answer-form textarea')].filter(field => visible(field) && !field.disabled && !field.readOnly);
  }
  function fillReviews(manual = false) {
    let count = 0;
    for (const field of reviewFields()) {
      if (field.value.trim() || (!manual && reviewed.has(field))) continue;
      const item = field.closest('.review-item, .review-container');
      const name = item?.querySelector('a[href*="/users/"]')?.textContent.trim() || 'покупатель';
      const text = FPH.renderTemplate(preferences.reviewReply, name);
      if (!text) continue;
      setField(field, text); reviewed.add(field); count++;
    }
    if (manual) status(count ? `Подготовлено ответов: ${count}. Проверьте и отправьте на FunPay.` : 'Откройте форму ответа на отзыв. Уже введённый текст не заменяется.');
  }
  async function autoReply(message, snapshot) {
    busy = true;
    try {
      await navigator.locks.request(`fph:reply:${snapshot.key}`, { ifAvailable: true }, async lock => {
        if (!lock || !armed || armed !== snapshot || document.visibilityState !== 'visible') return;
        const key = `replies:${snapshot.key}:${snapshot.user}`;
        const stored = await chrome.storage.local.get(key);
        const ledger = stored[key] || { ids: [], lastSent: 0 };
        const ids = Array.isArray(ledger.ids) ? ledger.ids : [];
        const current = chatTarget();
        if (!FPH.mayReply(message, { armed: armed === snapshot && chatKey() === snapshot.key, visible: document.visibilityState === 'visible', target: current?.id === snapshot.user ? snapshot.user : null, ignored: records[snapshot.user]?.ignored, busy: false, seen: ids, lastSent: ledger.lastSent || 0, now: Date.now() })) return;
        const form = getForm();
        if (!form || form.field.value.trim()) { status('Автоответ пропущен: в поле уже есть ваш текст.'); return; }
        const text = FPH.renderTemplate(preferences.buyerReply, target?.name);
        if (!text) { disarm('Заполните шаблон ответа в настройках расширения.'); return; }
        // Reserve before submission. A reload or another tab must never retry a possibly sent answer.
        const now = Date.now();
        await chrome.storage.local.set({ [key]: { ids: [...ids, message.id].slice(-200), lastSent: now } });
        if (armed !== snapshot || records[snapshot.user]?.ignored || chatKey() !== snapshot.key || chatTarget()?.id !== snapshot.user || document.visibilityState !== 'visible' || !form.field.isConnected || form.field.value.trim()) return;
        lastSent = now;
        setField(form.field, text);
        if (!form.submit.disabled) {
          form.form.requestSubmit(form.submit);
          status('Автоответ передан форме FunPay. Проверьте появление сообщения в чате.');
        } else { disarm('Форма не готова к отправке. Ответ оставлен в поле.'); }
      });
    } catch { disarm('Автоответ остановлен: не удалось сохранить защиту от повторов.'); }
    finally { busy = false; }
  }
  function scan() {
    updateTarget();
    badgeLinks();
    const messages = getMessages(); applyIgnore(messages);
    if (preferences.reviewAutofill) fillReviews();
    if (!armed) return;
    const fresh = messages.filter(message => !handledMessages.has(message.el) && !seen.has(message.id) && FPH.messageNumber(message.id) !== null && FPH.messageNumber(message.id) > armed.after);
    // Older messages inserted by history pagination are never new incoming events.
    for (const message of messages) { const number = FPH.messageNumber(message.id); if (number !== null && number > armed.after) armed.after = number; }
    for (const message of messages) { handledMessages.add(message.el); seen.add(message.id); }
    if (seen.size > 2000) seen = new Set([...seen].slice(-1000));
    const candidate = fresh.filter(m => m.author === armed.user).at(-1);
    if (candidate && FPH.mayReply(candidate, { armed: true, visible: document.visibilityState === 'visible', target: armed.user, ignored: records[armed.user]?.ignored, busy, seen: [], now: Date.now(), lastSent })) void autoReply(candidate, armed);
  }
  function openPanel() { $('panel').hidden = false; $('launch').setAttribute('aria-expanded', 'true'); }
  function openEditor() {
    if (!target) { status('Откройте профиль или выберите ссылку на покупателя.'); return; }
    editing = { ...target }; const record = FPH.buyer(records[target.id]);
    $('tag').value = record.tag; $('label').value = record.label; $('note').value = record.note; $('editor').hidden = false; $('note').focus();
  }
  $('launch').onclick = () => { const wasHidden = $('panel').hidden; $('panel').hidden = !wasHidden; $('launch').setAttribute('aria-expanded', String(wasHidden)); };
  $('close').onclick = () => { $('panel').hidden = true; $('launch').setAttribute('aria-expanded', 'false'); $('launch').focus(); };
  shadow.addEventListener('keydown', event => { if (event.key === 'Escape') { $('panel').hidden = true; $('launch').setAttribute('aria-expanded', 'false'); $('launch').focus(); } });
  $('mark').onclick = openEditor;
  $('cancel').onclick = () => { editing = null; $('editor').hidden = true; };
  $('save').onclick = async () => {
    if (!editing) return;
    const user = { ...editing }; $('save').disabled = true;
    try {
      await chrome.storage.local.set({ [`buyer:${user.id}`]: { ...FPH.buyer(records[user.id]), name: user.name, tag: $('tag').value, label: $('label').value.trim(), note: $('note').value.trim() } });
      $('editor').hidden = true; editing = null; status('Метка и заметка сохранены только у вас.');
    } catch { status('Не удалось сохранить. Попробуйте ещё раз.', true); }
    finally { $('save').disabled = false; }
  };
  $('ignore').onclick = async () => {
    if (!target) return;
    const user = { ...target }; const record = FPH.buyer(records[user.id]);
    try {
      await chrome.storage.local.set({ [`buyer:${user.id}`]: { ...record, name: user.name, ignored: !record.ignored } });
      if (!record.ignored) disarm();
      status(record.ignored ? 'Локальный игнор снят.' : 'Сообщения скрыты локально. Блокировка в аккаунте FunPay не менялась.');
    } catch { status('Не удалось сохранить игнор.', true); }
  };
  $('show-ignored').onclick = () => { showIgnored = !showIgnored; $('show-ignored').textContent = showIgnored ? 'Скрыть игнор' : 'Показать игнор'; scan(); };
  $('reply').onclick = () => {
    const form = getForm(); if (!form || !target || chatTarget()?.id !== target.id) { status('Откройте чат с доступной формой сообщения и выберите его покупателя.'); return; }
    if (form.field.value.trim()) { status('В поле уже есть ваш текст. Сначала отправьте или очистите его.'); return; }
    const text = FPH.renderTemplate(preferences.buyerReply, target.name);
    if (!text) { status('Заполните шаблон в настройках расширения.'); return; }
    setField(form.field, text); form.field.focus(); status('Ответ вставлен. Проверьте и отправьте его на FunPay.');
  };
  $('review').onclick = () => fillReviews(true);
  $('auto').onchange = () => {
    if (!$('auto').checked) { disarm('Автоответ выключен.'); return; }
    const current = chatTarget(); const key = chatKey();
    if (!current || !key || !getForm() || !navigator.locks || current.id !== target?.id || records[current.id]?.ignored) { disarm('Не удалось определить чат и покупателя.'); return; }
    if (!preferences.buyerReply.trim()) { disarm('Сначала заполните шаблон ответа в настройках.'); return; }
    const numbers = getMessages().map(m => FPH.messageNumber(m.id)).filter(n => n !== null);
    if (!numbers.length) { disarm('Дождитесь загрузки истории с числовыми ID сообщений. Эта разметка пока не поддерживается.'); return; }
    if (!confirm(`Включить автоотправку для ${current.name}? Helper будет отправлять ваш шаблон на новые сообщения, пока эта вкладка видна. Проверьте шаблон в настройках. При перезагрузке автоответ выключится.`)) { disarm(); return; }
    armed = { user: current.id, key, after: numbers.reduce((a, b) => a > b ? a : b, 0n) }; seen = new Set(getMessages().map(m => m.id));
    status('Автоответ включён для этого чата. Жду новое сообщение.');
  };
  $('pick').onclick = () => { picking = !picking; $('pick').textContent = picking ? 'Отменить выбор' : 'Выбрать по ссылке на профиль'; $('pick').classList.toggle('pick-cancel', picking); status(picking ? 'Нажмите на имя покупателя — ссылку на его профиль на странице.' : 'Выбор отменён.'); };
  document.addEventListener('click', event => {
    if (!picking) return;
    const link = event.target.closest('a[href]'); const user = linkUser(link);
    if (!user) return;
    event.preventDefault(); event.stopImmediatePropagation(); picked = user; picking = false;
    $('pick').textContent = 'Выбрать по ссылке на профиль'; $('pick').classList.remove('pick-cancel');
    updateTarget(); openPanel(); openEditor();
  }, true);
  $('translate').onclick = () => {
    const selected = window.getSelection()?.toString().trim();
    const description = [...document.querySelectorAll('.lot-desc-text, .lot-description, .offer-description, [data-role="lot-description"]')].filter(visible).map(el => el.innerText.trim()).filter(Boolean).join('\n\n');
    const text = selected || description;
    if (!text) { status('Выделите описание лота на странице и нажмите перевод.'); return; }
    const url = FPH.translationUrl(text, preferences.language);
    window.open(url, '_blank', 'noopener,noreferrer');
    status(text.length > 4500 ? 'Открыт перевод первых 4500 символов в Google Translate.' : 'Текст открыт в Google Translate.');
  };
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.settings) { preferences = FPH.settings(changes.settings.newValue); applyPreferences(); }
    for (const [key, change] of Object.entries(changes)) if (/^buyer:\d+$/.test(key)) { if (change.newValue) records[key.slice(6)] = FPH.buyer(change.newValue); else delete records[key.slice(6)]; }
    scan();
  });
  chrome.storage.local.get(null).then(stored => {
    preferences = FPH.settings(stored.settings);
    records = Object.fromEntries(Object.entries(stored).filter(([key]) => /^buyer:\d+$/.test(key)).map(([key, value]) => [key.slice(6), FPH.buyer(value)]));
    storageReady = true; applyPreferences(); scan();
    new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(scan, 150); }).observe(document.body, { childList: true, subtree: true, characterData: true });
    // A route can change without a DOM mutation. Poll only route identity, not the whole page.
    let route = location.href;
    setInterval(() => { if (route !== location.href) { route = location.href; picked = null; disarm(); scan(); } }, 750);
    window.addEventListener('pagehide', () => disarm());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      // Background timers can be throttled. Rebase before scanning on return so
      // messages received while hidden cannot be replayed as fresh messages.
      if (armed) for (const message of getMessages()) {
        seen.add(message.id); handledMessages.add(message.el);
        const number = FPH.messageNumber(message.id);
        if (number !== null && number > armed.after) armed.after = number;
      }
      scan();
    });
  }).catch(() => { status('Хранилище расширения недоступно. Перезагрузите страницу.', true); updateTarget(); });
})();
