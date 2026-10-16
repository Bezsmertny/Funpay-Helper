/* global FPH, chrome */
'use strict';
const $ = id => document.getElementById(id);
let preferences;
let buyers = {};
let saveQueue = Promise.resolve();
function status(text, error = false) {
  $('save-status').textContent = text;
  $('save-status').style.color = error ? '#e9b798' : '#a9c5b3';
}
function saveSettings() {
  preferences = FPH.settings({ ...preferences, ...Object.fromEntries(['dark', 'motion', 'reviewAutofill'].map(k => [k, $(k).checked])), ...Object.fromEntries(['buyerReply', 'reviewReply', 'language'].map(k => [k, $(k).value])) });
  const snapshot = { ...preferences };
  status('Сохраняю…');
  saveQueue = saveQueue.catch(() => {}).then(() => chrome.storage.local.set({ settings: snapshot })).then(() => status('Сохранено')).catch(() => status('Не удалось сохранить', true));
}
function renderBuyers() {
  const list = $('buyers-list');
  list.replaceChildren();
  $('buyer-count').textContent = Object.keys(buyers).length;
  const query = $('search').value.toLowerCase().trim();
  const entries = Object.entries(buyers).filter(([id, b]) => `${id} ${b.name} ${b.label} ${b.note}`.toLowerCase().includes(query));
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'empty'; empty.textContent = query ? 'Ничего не найдено' : 'Здесь появятся ваши покупатели ✧'; list.append(empty);
  }
  for (const [id, raw] of entries) {
    const b = FPH.buyer(raw);
    const row = document.createElement('div'); row.className = 'buyer-row';
    const info = document.createElement('div'); info.className = 'buyer-info';
    const link = document.createElement('a'); link.href = `https://funpay.com/users/${id}/`; link.target = '_blank'; link.rel = 'noreferrer'; link.textContent = b.name || 'Покупатель';
    const code = document.createElement('span'); code.className = 'buyer-id'; code.textContent = `#${id}`;
    const note = document.createElement('p'); note.textContent = b.note || (b.ignored ? 'В локальном игноре' : 'Без заметки');
    info.append(link, code, note);
    const badge = document.createElement('span'); badge.className = `buyer-badge ${b.tag}`; badge.textContent = b.ignored ? '⊘ Игнор' : b.label || FPH.TAGS[b.tag].label;
    const remove = document.createElement('button'); remove.className = 'remove-buyer'; remove.textContent = '×'; remove.title = 'Удалить метку, заметку и игнор'; remove.setAttribute('aria-label', `Удалить запись ${b.name || id}`);
    remove.onclick = async () => {
      if (!confirm(`Удалить метку, заметку и игнор для ${b.name || id}?`)) return;
      try { await chrome.storage.local.remove(`buyer:${id}`); } catch { status('Не удалось удалить', true); }
    };
    row.append(info, badge, remove); list.append(row);
  }
}
async function init() {
  const stored = await chrome.storage.local.get(null);
  preferences = FPH.settings(stored.settings);
  buyers = Object.fromEntries(Object.entries(stored).filter(([key]) => /^buyer:\d+$/.test(key)).map(([key, val]) => [key.slice(6), FPH.buyer(val)]));
  for (const [value, label] of Object.entries(FPH.LANGUAGES)) { const opt = document.createElement('option'); opt.value = value; opt.textContent = label; $('language').append(opt); }
  for (const key of ['dark', 'motion', 'reviewAutofill']) $(key).checked = preferences[key];
  for (const key of ['buyerReply', 'reviewReply', 'language']) $(key).value = preferences[key];
  for (const key of Object.keys(FPH.DEFAULTS)) $(key).addEventListener('change', saveSettings);
  // Persist template edits as they are typed; closing the popup must not lose a draft.
  for (const key of ['buyerReply', 'reviewReply']) $(key).addEventListener('input', saveSettings);
  $('search').addEventListener('input', renderBuyers);
  document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-selected', b === button ? 'true' : 'false'); });
    document.querySelectorAll('.tab-panel').forEach(panel => { panel.hidden = panel.id !== button.dataset.tab; });
  }));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const [key, change] of Object.entries(changes)) if (/^buyer:\d+$/.test(key)) { if (change.newValue) buyers[key.slice(6)] = FPH.buyer(change.newValue); else delete buyers[key.slice(6)]; }
    renderBuyers();
  });
  renderBuyers();
}
init().catch(() => { status('Хранилище недоступно', true); document.querySelectorAll('input,textarea,select').forEach(el => el.disabled = true); });
