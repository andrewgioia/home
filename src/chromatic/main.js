// Color state and persistence
const storageKey = 'chromatic.colors.v1';
const colorInputs = {
  foreground: {
    picker: document.querySelector('.fg input[type="color"]'),
    hex: document.querySelector('#fgcolor'),
    button: document.querySelector('#fgpicker'),
  },
  background: {
    picker: document.querySelector('.bg input[type="color"]'),
    hex: document.querySelector('#bgcolor'),
    button: document.querySelector('#bgpicker'),
  },
};
const score = document.querySelector('#score');
const badge = document.querySelector('#badge');
const minimalMode = document.querySelector('#minimal-mode');
const requirements = [
  { element: document.querySelector('#aa-regular b'), minimum: 4.5 },
  { element: document.querySelector('#aa-large b'), minimum: 3 },
  { element: document.querySelector('#aaa-regular b'), minimum: 7 },
  { element: document.querySelector('#aaa-large b'), minimum: 4.5 },
];
const ratioFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});
const colors = loadColors();

function normalizeHex(value) {
  if (typeof value !== 'string') return null;
  let hex = value.trim().replace(/^#/, '');
  if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return null;
  if (hex.length === 3) hex = [...hex].map(character => character.repeat(2)).join('');
  return `#${hex.toLowerCase()}`;
}

function loadColors() {
  const defaults = {
    foreground: colorInputs.foreground.picker.value,
    background: colorInputs.background.picker.value,
  };

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved?.version !== 1) return defaults;
    return {
      foreground: normalizeHex(saved.foreground) ?? defaults.foreground,
      background: normalizeHex(saved.background) ?? defaults.background,
    };
  } catch {
    // Unavailable storage or malformed data must not prevent using the app.
    return defaults;
  }
}

function saveColors() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ version: 1, ...colors }));
  } catch {
    // Keep working in memory when browser storage is blocked or full.
  }
}

function setColor(role, value) {
  const hex = normalizeHex(value);
  if (!hex) return;
  colors[role] = hex;
  renderColors();
}

// WCAG uses linear sRGB luminance and the unrounded ratio for every threshold.
function rgbChannels(hex) {
  return hex.slice(1).match(/.{2}/g).map(channel => parseInt(channel, 16) / 255);
}

function linearChannel(value) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const [red, green, blue] = rgbChannels(hex).map(linearChannel);
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrastRatio(foreground, background) {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function contrastStatus(ratio) {
  if (ratio >= 7) return { name: 'aaa', label: 'Meets AAA!', minimalLabel: 'AAA' };
  if (ratio >= 4.5) return { name: 'aa', label: 'Meets AA', minimalLabel: 'AA' };
  if (ratio >= 3) return { name: 'aa-large-only', label: 'AA large only', minimalLabel: 'AA Lg' };
  return { name: 'fails-aa', label: 'Fails AA', minimalLabel: 'Fail' };
}

function renderUIContrast() {
  // Match the native app's threshold for light backgrounds.
  const useBlack = minimalMode.checked && luminance(colors.background) > 0.179;
  const style = document.documentElement.style;
  if (useBlack) {
    style.setProperty('--contrast', 'rgb(0 0 0 / 1)');
    style.setProperty('--contrast-mix', 'rgb(0 0 0 / 0.25)');
  } else {
    // Restore the stylesheet defaults for dark backgrounds and the default UI.
    style.removeProperty('--contrast');
    style.removeProperty('--contrast-mix');
  }
}

function renderColors() {
  renderUIContrast();
  for (const [role, inputs] of Object.entries(colorInputs)) {
    document.documentElement.style.setProperty(`--${role}`, colors[role]);
    inputs.picker.value = colors[role];
    // Preserve the draft and caret while someone is typing a hex value.
    if (document.activeElement !== inputs.hex) inputs.hex.value = colors[role];
  }

  const ratio = contrastRatio(colors.foreground, colors.background);
  const status = contrastStatus(ratio);
  score.textContent = ratioFormat.format(ratio);
  badge.textContent = minimalMode.checked ? status.minimalLabel : status.label;
  badge.dataset.status = status.name;

  for (const { element, minimum } of requirements) {
    const passes = ratio >= minimum;
    element.textContent = passes ? '✅' : '❌';
    element.setAttribute('role', 'img');
    element.setAttribute('aria-label', passes ? 'Pass' : 'Fail');
  }
}

for (const [role, { picker, hex, button }] of Object.entries(colorInputs)) {
  button.addEventListener('click', () => picker.click());

  picker.addEventListener('input', () => setColor(role, picker.value));
  picker.addEventListener('change', () => {
    setColor(role, picker.value);
    saveColors();
    recordColor(picker.value);
  });

  let colorBeforeEdit;
  hex.addEventListener('focus', () => { colorBeforeEdit = colors[role]; });
  hex.addEventListener('input', () => {
    hex.setAttribute('aria-invalid', String(!normalizeHex(hex.value)));
    setColor(role, hex.value);
  });
  hex.addEventListener('blur', () => {
    // Record only a finished, valid edit—not intermediate hex keystrokes.
    const picked = normalizeHex(hex.value);
    if (picked && picked !== colorBeforeEdit) recordColor(picked);
    // Incomplete or invalid drafts leave the last valid color intact.
    hex.value = colors[role];
    hex.removeAttribute('aria-invalid');
    saveColors();
  });
  hex.addEventListener('keydown', event => {
    if (event.key === 'Enter') hex.blur();
  });
}

renderColors();

// Popover visibility and geometry
const popover = document.querySelector('[data-popover]');
const shape = popover.querySelector('#shape');
const toggleButton = document.querySelector('#toggle');
const closeButton = document.querySelector('#close');

function togglePopover() {
  closeContextMenus();
  const isOpen = popover.classList.contains('is-closed');

  if (!isOpen && popover.contains(document.activeElement)) {
    toggleButton.focus({ preventScroll: true });
  }

  popover.classList.toggle('is-closed', !isOpen);
  popover.inert = !isOpen;
  popover.setAttribute('aria-hidden', String(!isOpen));
  toggleButton.setAttribute('aria-expanded', String(isOpen));
}

toggleButton.addEventListener('click', togglePopover);
closeButton.addEventListener('click', togglePopover);

// One path supplies both the glass clip and rim, with fixed-size corners.
// Measure layout dimensions so the opening animation cannot distort the path.

function updatePopoverShape() {
  const width = popover.offsetWidth;
  const height = popover.offsetHeight;
  const center = width / 2;
  const right = width - 1;
  const bottom = height - 1;
  const corner = 23;

  shape.setAttribute('d', `
    M ${1 + corner} 20
    H ${center - 22}
    Q ${center - 17} 20 ${center - 13} 16
    L ${center - 4} 7
    Q ${center} 3 ${center + 4} 7
    L ${center + 13} 16
    Q ${center + 17} 20 ${center + 22} 20
    H ${right - corner}
    Q ${right} 20 ${right} ${20 + corner}
    V ${bottom - corner}
    Q ${right} ${bottom} ${right - corner} ${bottom}
    H ${1 + corner}
    Q 1 ${bottom} 1 ${bottom - corner}
    V ${20 + corner}
    Q 1 20 ${1 + corner} 20
    Z
  `);
}

updatePopoverShape();
new ResizeObserver(updatePopoverShape).observe(popover);

// Settings: native popover dismissal, real checkboxes, and local preferences.
const settingsButton = document.querySelector('#settings');
const settingsMenu = document.querySelector('#settings-menu');
const preferenceKey = 'chromatic.preferences.v1';
const preferences = [...settingsMenu.querySelectorAll('input:not(:disabled)')];
const notice = document.querySelector('#notice');
let noticeTimer;

function announce(message) {
  clearTimeout(noticeTimer);
  notice.textContent = message;
  noticeTimer = setTimeout(() => { notice.textContent = ''; }, 6000);
}

function loadPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(preferenceKey));
    for (const input of preferences) {
      if (typeof saved?.[input.id] === 'boolean') input.checked = saved[input.id];
    }
  } catch {
    // Keep the default checkboxes when storage is unavailable or invalid.
  }
}

function applyPreferences() {
  popover.classList.toggle('is-minimal', minimalMode.checked);
  renderColors();
}

function savePreferences() {
  try {
    const values = Object.fromEntries(preferences.map(input => [input.id, input.checked]));
    localStorage.setItem(preferenceKey, JSON.stringify(values));
  } catch {
    // The controls still work without persistence.
  }
}

// Shared positioning and keyboard behavior for every footer menu.
const contextMenus = [...document.querySelectorAll('.context-menu')].map(menu => ({
  menu,
  button: document.querySelector(`[popovertarget="${menu.id}"]`),
}));

function positionContextMenus() {
  for (const { menu, button } of contextMenus) {
    if (!menu.matches(':popover-open')) continue;
    const anchor = button.getBoundingClientRect();
    const bounds = menu.getBoundingClientRect();
    const gap = 6;
    const left = Math.max(8, Math.min(anchor.left, innerWidth - bounds.width - 8));
    const below = anchor.bottom + gap;
    const top = below + bounds.height <= innerHeight - 8 ? below : anchor.top - bounds.height - gap;
    menu.style.left = `${left}px`;
    menu.style.top = `${Math.max(8, top)}px`;
  }
}

function closeContextMenus() {
  for (const { menu, button } of contextMenus) {
    menu.hidePopover();
    button.setAttribute('aria-expanded', 'false');
  }
}

for (const { menu, button } of contextMenus) {
  menu.addEventListener('beforetoggle', event => {
    if (event.newState === 'open') requestAnimationFrame(positionContextMenus);
  });
  menu.addEventListener('toggle', event => {
    button.setAttribute('aria-expanded', String(event.newState === 'open'));
  });
  menu.addEventListener('keydown', event => {
    const controls = [...menu.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
    const index = controls.indexOf(document.activeElement);
    let next;
    if (event.key === 'ArrowDown') next = (index + 1) % controls.length;
    if (event.key === 'ArrowUp') next = index < 0 ? controls.length - 1 : (index - 1 + controls.length) % controls.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = controls.length - 1;
    if (next !== undefined && controls.length) {
      event.preventDefault();
      controls[next].focus();
    }
    if (event.key === 'Escape') button.focus();
    if (event.key === 'Tab') {
      requestAnimationFrame(() => {
        if (!menu.contains(document.activeElement)) closeContextMenus();
      });
    }
  });
}
for (const input of preferences) {
  input.addEventListener('change', () => {
    applyPreferences();
    savePreferences();
    closeContextMenus();
    settingsButton.focus({ preventScroll: true });
  });
}
new ResizeObserver(positionContextMenus).observe(popover);
window.addEventListener('resize', positionContextMenus);
window.addEventListener('scroll', positionContextMenus, true);
loadPreferences();
applyPreferences();

document.querySelector('#about').addEventListener('click', () => {
  closeContextMenus();
  settingsButton.focus({ preventScroll: true });
  document.querySelector('#about-dialog').showModal();
});

function contrastReport() {
  const ratio = contrastRatio(colors.foreground, colors.background);
  const result = minimum => ratio >= minimum ? 'Pass' : 'Fail';
  return [
    `Foreground: ${colors.foreground.toUpperCase()}`,
    `Background: ${colors.background.toUpperCase()}`,
    `Contrast: ${ratio.toFixed(4)}:1`,
    `WCAG 2.2 AA: regular ${result(4.5)}, large ${result(3)}`,
    `WCAG 2.2 AAA: regular ${result(7)}, large ${result(4.5)}`,
  ].join('\n');
}

// Clipboard actions share feedback and a manual-copy fallback.
async function copyText(value, title, trigger) {
  closeContextMenus();
  trigger.focus({ preventScroll: true });
  try {
    await navigator.clipboard.writeText(value);
    announce('Copied to clipboard.');
  } catch {
    const dialog = document.querySelector('#copy-dialog');
    const text = document.querySelector('#copy-report');
    document.querySelector('#copy-title').textContent = title;
    text.setAttribute('aria-label', title);
    text.rows = value.split('\n').length + 1;
    text.value = value;
    dialog.showModal();
    text.focus();
    text.select();
  }
}

document.querySelector('#copy-contrast').addEventListener('click', () => {
  copyText(contrastReport(), 'Copy contrast value', settingsButton);
});

document.querySelector('#export-menu').addEventListener('click', event => {
  const item = event.target.closest('button[data-format]');
  if (!item) return;
  const hex = colors[item.dataset.color];
  const value = item.dataset.format === 'hex'
    ? hex.toUpperCase()
    : `rgb(${rgbChannels(hex).map(channel => Math.round(channel * 255)).join(', ')})`;
  copyText(value, `Copy ${item.dataset.color} ${item.dataset.format.toUpperCase()}`, document.querySelector('#export'));
});

document.querySelector('#quit').addEventListener('click', () => {
  closeContextMenus();
  window.close();
  setTimeout(() => {
    if (!window.closed) {
      if (!popover.inert) togglePopover();
      announce('Your browser keeps this tab open. Close it with ⌘W on Mac or Ctrl+W on Windows/Linux.');
    }
  }, 150);
});

// This is a page shortcut, not a system-wide hotkey. Browsers may reserve it.
document.addEventListener('keydown', event => {
  if (!document.querySelector('#foreground-shortcut').checked || event.repeat || event.isComposing) return;
  if (event.metaKey && event.shiftKey && !event.altKey && !event.ctrlKey && event.code === 'KeyO') {
    event.preventDefault();
    closeContextMenus();
    if (popover.inert) togglePopover();
    colorInputs.foreground.picker.click();
  }
});

// Match the Mac app: blend in linear sRGB, then test the actual 8-bit hex.
function adjustedColor(original, fixed, target) {
  const start = rgbChannels(original);
  const passes = hex => contrastRatio(hex, fixed) >= target;
  const startsPassing = passes(original);

  function mix(endpoint, amount) {
    const end = rgbChannels(endpoint);
    const channels = start.map((channel, index) => {
      const linear = linearChannel(channel) + (linearChannel(end[index]) - linearChannel(channel)) * amount;
      const encoded = linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055;
      return Math.min(255, Math.max(0, Math.round(encoded * 255))).toString(16).padStart(2, '0');
    });
    return `#${channels.join('')}`;
  }

  function boundary(endpoint) {
    if (passes(endpoint) === startsPassing) return null;
    let lower = 0;
    let upper = 1;
    for (let step = 0; step < 48; step++) {
      const middle = (lower + upper) / 2;
      if (passes(mix(endpoint, middle)) === startsPassing) lower = middle;
      else upper = middle;
    }
    return mix(endpoint, startsPassing ? lower : upper);
  }

  // Reduce excess contrast toward the unchanged color; otherwise try both ends.
  if (startsPassing) return boundary(fixed);
  const candidates = ['#000000', '#ffffff'].map(boundary).filter(Boolean);
  const distance = hex => rgbChannels(hex).reduce((sum, channel, index) => sum + (channel - start[index]) ** 2, 0);
  return candidates.sort((first, second) => distance(first) - distance(second))[0] ?? null;
}

document.querySelector('#adjust-menu').addEventListener('click', event => {
  const item = event.target.closest('button[data-ratio]');
  if (!item) return;
  const role = item.dataset.color;
  const target = Number(item.dataset.ratio);
  const fixedRole = role === 'foreground' ? 'background' : 'foreground';
  const adjusted = adjustedColor(colors[role], colors[fixedRole], target);
  closeContextMenus();
  document.querySelector('#adjust').focus({ preventScroll: true });
  if (!adjusted) {
    announce(`Cannot reach ${target}:1 by changing only the ${role}. Try adjusting the ${fixedRole}.`);
    return;
  }
  setColor(role, adjusted);
  saveColors();
});

// History records committed picks only; live rendering never adds entries.
const historyKey = 'chromatic.history.v1';
const historyMenu = document.querySelector('#history-menu');
const historyButton = document.querySelector('#history');
const historyEmpty = document.querySelector('#history-empty');
const clearHistoryButton = document.querySelector('#clear-history');
let colorHistory = loadHistory();

function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(historyKey));
    if (!Array.isArray(saved)) return [];
    return [...new Set(saved.map(normalizeHex).filter(Boolean))].slice(0, 10);
  } catch {
    return [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem(historyKey, JSON.stringify(colorHistory));
  } catch {
    // History stays usable for this session when storage is unavailable.
  }
}

function recordColor(value) {
  const hex = normalizeHex(value);
  if (!hex) return;
  colorHistory = [hex, ...colorHistory.filter(color => color !== hex)].slice(0, 10);
  saveHistory();
  renderHistory();
}

function renderHistory() {
  historyMenu.querySelectorAll('[data-history-item]').forEach(item => item.remove());
  const entries = document.createDocumentFragment();
  colorHistory.forEach((hex, index) => {
    const item = document.createElement('li');
    item.dataset.historyItem = '';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'history-color';
    button.dataset.hex = hex;
    button.autofocus = index === 0;
    button.setAttribute('aria-label', `Copy ${hex.toUpperCase()}`);
    const swatch = document.createElement('span');
    swatch.className = 'menu-icon history-swatch';
    swatch.style.setProperty('--swatch', hex);
    swatch.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.textContent = hex.toUpperCase();
    button.append(swatch, label);
    item.append(button);
    entries.append(item);
  });
  historyMenu.insertBefore(entries, historyEmpty);
  historyEmpty.hidden = colorHistory.length > 0;
  historyMenu.autofocus = colorHistory.length === 0;
  clearHistoryButton.disabled = colorHistory.length === 0;
}

historyMenu.addEventListener('click', event => {
  const item = event.target.closest('button[data-hex]');
  if (item) copyText(item.dataset.hex.toUpperCase(), 'Copy hex code', historyButton);
});
clearHistoryButton.addEventListener('click', () => {
  closeContextMenus();
  historyButton.focus({ preventScroll: true });
  colorHistory = [];
  saveHistory();
  renderHistory();
});

renderHistory();

// Menu bar clock uses the visitor's timezone, keeping the original 24-hour style.
const menuDate = document.querySelector('#menu-date');
const menuTime = document.querySelector('#menu-time');
let clockTimer;

function updateClock() {
  clearTimeout(clockTimer);
  const now = new Date();
  menuDate.textContent = now.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  }).replaceAll(',', '');
  menuTime.textContent = now.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  menuTime.dateTime = now.toISOString();
  clockTimer = setTimeout(updateClock, 60000 - Date.now() % 60000);
}

// Refresh immediately when returning from a suspended or background tab.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) updateClock();
});
window.addEventListener('focus', updateClock);
updateClock();
