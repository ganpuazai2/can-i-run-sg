// Small DOM helpers shared across the UI.

export const $ = id => document.getElementById(id);

const svg = (body, width = 2) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  verdict: [
    svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 2.6),
    svg('<path d="M12 6v8"/><path d="M12 18h.01"/>', 2.6),
    svg('<path d="M7 7l10 10M17 7L7 17"/>', 2.6),
  ],
  moon: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
};

let toastTimer;
export function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

/** `view` names the dialog so it can be re-rendered when the language changes. */
export function openModal(html, view = "") {
  $("modalBody").innerHTML = html;
  $("modalBody").dataset.view = view;
  $("modal").hidden = false;
}
export const closeModal = () => ($("modal").hidden = true);
export const openModalView = () => ($("modal").hidden ? "" : $("modalBody").dataset.view);

export function confetti() {
  const colors = ["#2d9cdb", "#ff7a59", "#1e9e5a", "#0f2a44"];
  for (let i = 0; i < 28; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti";
    piece.style.background = colors[i % colors.length];
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.animationDuration = 1.4 + Math.random() * 1.6 + "s";
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 3200);
  }
}
