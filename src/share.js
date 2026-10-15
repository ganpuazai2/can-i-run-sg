// Draws the 1080×1080 share image and hands it to the phone's share sheet.

const W = 1080, H = 1080, PAD = 120;
const INK = "#0f2a44", MUTED = "#5b7085", LINK = "#1b6fa3";
const FONT = "Inter, 'Noto Sans Tamil', sans-serif";

export const VERDICT_COLORS = ["#1e9e5a", "#c98a00", "#d64545"];
export const RECAP_COLOR = "#2d9cdb";

// Chinese has no spaces between words, so wrap it character by character.
function wrapText(ctx, text, maxWidth) {
  const spaced = /\s/.test(text);
  const parts = spaced ? text.split(" ") : [...text];
  const lines = [];
  let line = "";
  for (const part of parts) {
    const next = line ? line + (spaced ? " " : "") + part : part;
    if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = part; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * @param {object} card
 * @param {string} card.color accent colour (verdict colour)
 * @param {string} card.brand  e.g. "Can I Run? · Singapore"
 * @param {string} card.kicker region, date and time line
 * @param {string} card.big    the verdict word
 * @param {string} card.lead   one-line advice
 * @param {{label: string, value: string|number, note?: string}[]} card.stats up to two
 * @param {string} [card.foot]
 */
export function drawShareCard({ color, brand, kicker, big, lead, stats, foot }) {
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#f5f9fc"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.roundRect(60, 60, W - 120, H - 120, 40); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(60, 60, W - 120, 16, [40, 40, 0, 0]); ctx.fill();

  ctx.fillStyle = MUTED;
  ctx.font = `600 36px ${FONT}`; ctx.fillText(brand, PAD, 170);
  ctx.font = `500 34px ${FONT}`; ctx.fillText(kicker, PAD, 222);

  // Shrink the verdict word until it fits; Tamil words are long.
  let size = 170;
  do { ctx.font = `800 ${size}px ${FONT}`; size -= 10; } while (ctx.measureText(big).width > W - 2 * PAD && size > 60);
  ctx.fillStyle = color; ctx.fillText(big, PAD - 8, 420);

  ctx.fillStyle = INK; ctx.font = `500 44px ${FONT}`;
  wrapText(ctx, lead, W - 2 * PAD).slice(0, 2).forEach((line, i) => ctx.fillText(line, PAD, 510 + i * 60));

  const boxW = (W - 2 * PAD - 30) / 2;
  stats.slice(0, 2).forEach((s, i) => {
    const x = PAD + i * (boxW + 30);
    ctx.fillStyle = "#eef4f9"; ctx.beginPath(); ctx.roundRect(x, 650, boxW, 200, 24); ctx.fill();
    ctx.fillStyle = MUTED; ctx.font = `600 32px ${FONT}`; ctx.fillText(s.label, x + 32, 705);
    ctx.fillStyle = INK; ctx.font = `700 84px ${FONT}`; ctx.fillText(String(s.value), x + 32, 800);
    if (s.note) { ctx.fillStyle = MUTED; ctx.font = `500 28px ${FONT}`; ctx.fillText(s.note, x + 32, 838); }
  });

  if (foot) { ctx.fillStyle = MUTED; ctx.font = `500 32px ${FONT}`; ctx.fillText(foot, PAD, 920); }
  ctx.fillStyle = LINK; ctx.font = `600 32px ${FONT}`; ctx.fillText(location.host, PAD, 975);
  return canvas;
}

/** Opens the share sheet where supported, otherwise downloads the image. */
export async function shareImage(canvas, text, filename) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: `${text} ${location.origin}` });
      return "shared";
    } catch (e) {
      if (e.name === "AbortError") return "cancelled";
    }
  }
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  return "saved";
}
