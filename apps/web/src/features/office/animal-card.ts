'use client';

/**
 * A shareable PNG of your animal (docs/office/07, O4): the avatar SVG already on screen, drawn on a
 * 1080 × 1350 card with your name. Everything happens in the browser; nothing is uploaded.
 */
export async function downloadAnimalCard(
  svg: SVGSVGElement,
  text: { name: string; line: string; brand: string },
  fileName: string,
): Promise<void> {
  const W = 1080;
  const H = 1350;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', '700');
  clone.setAttribute('height', '700');
  const xml = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  await img.decode();

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  if (!g) return;

  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1e1b4b');
  bg.addColorStop(1, '#0f0d2e');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, 560, 50, W / 2, 560, 520);
  glow.addColorStop(0, 'rgba(253, 224, 71, 0.45)');
  glow.addColorStop(1, 'rgba(253, 224, 71, 0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);

  g.drawImage(img, (W - 700) / 2, 210, 700, 700);

  g.textAlign = 'center';
  g.fillStyle = '#ffffff';
  g.font = '800 96px system-ui, "Segoe UI", sans-serif';
  g.fillText(fit(g, text.name, W - 120), W / 2, 1050);
  g.fillStyle = '#fde68a';
  g.font = '600 44px system-ui, "Segoe UI", sans-serif';
  g.fillText(fit(g, text.line, W - 120), W / 2, 1130);
  g.fillStyle = 'rgba(255, 255, 255, 0.6)';
  g.font = '600 34px system-ui, "Segoe UI", sans-serif';
  g.fillText(text.brand, W / 2, 1290);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Shortens a line with "…" until it fits. */
function fit(g: CanvasRenderingContext2D, s: string, max: number): string {
  if (g.measureText(s).width <= max) return s;
  let out = s;
  while (out.length > 1 && g.measureText(`${out}…`).width > max) out = out.slice(0, -1);
  return `${out}…`;
}
