const hiddenClass = `info-hidden`;
const storageKey = `sketch-info-hidden`;

const style = document.createElement(`style`);
style.textContent = `
  #_info-toggle {
    position: fixed;
    bottom: 12px;
    right: 12px;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.35);
    color: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 10px;
    font-family: 'Overpass Mono', monospace;
    cursor: pointer;
    user-select: none;
    backdrop-filter: blur(4px);
    letter-spacing: 0.05em;
    transition: opacity 0.15s;
  }
  #_info-toggle:hover {
    background: rgba(0, 0, 0, 0.55);
    color: rgba(255, 255, 255, 0.9);
  }
  body.${hiddenClass} #debug,
  body.${hiddenClass} #label,
  body.${hiddenClass} #mode-desc,
  body.${hiddenClass} #main h1,
  body.${hiddenClass} #main h2 {
    display: none !important;
  }
`;
document.head.appendChild(style);

const btn = document.createElement(`button`);
btn.id = `_info-toggle`;
document.body.appendChild(btn);

function setHidden(hidden) {
  document.body.classList.toggle(hiddenClass, hidden);
  btn.textContent = hidden ? `show info` : `hide info`;
  localStorage.setItem(storageKey, hidden ? `1` : ``);
}

btn.addEventListener(`click`, () => setHidden(!document.body.classList.contains(hiddenClass)));

document.addEventListener(`keydown`, e => {
  if ((e.key === `h` || e.key === `H`) && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const tag = document.activeElement?.tagName;
    if (tag === `INPUT` || tag === `TEXTAREA` || tag === `SELECT`) return;
    setHidden(!document.body.classList.contains(hiddenClass));
  }
});

setHidden(!!localStorage.getItem(storageKey));
