import { jsPDF } from 'jspdf';
import { CATEGORIES, HIGHLIGHTS, IMAGES, INTRO, TAGLINE, APP_URL } from './content';
import { loadImageDataUrl } from './loadImage';

const M = 50;

export async function exportPromoPdf() {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  let y;
  const write = (str, size, color, bold) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(str, W - M * 2);
    if (y + lines.length * size * 1.3 > H - M) { doc.addPage(); y = M; }
    doc.text(lines, M, y);
    y += lines.length * size * 1.3;
  };

  // Cover
  doc.setFillColor(33, 27, 43); doc.rect(0, 0, W, H, 'F');
  doc.addImage(await loadImageDataUrl(IMAGES.hero), 'JPEG', 0, 0, W, H * 0.55);
  y = H * 0.55 + 50;
  write("AUDIOTOOL · LET'S BUILD SUBMISSION", 11, [255, 190, 150], true);
  y += 6;
  write(TAGLINE, 22, [248, 243, 237], true);
  y += 10;
  write(INTRO, 11, [215, 205, 215], false);

  // Differentiator
  doc.addPage(); y = M;
  write('WHY IT STANDS OUT', 11, [200, 100, 60], true);
  write('Provenance that travels with every export', 20, [30, 25, 35], true);
  y += 6;
  HIGHLIGHTS.forEach((h) => write(`•  ${h}`, 11, [60, 55, 65], false));

  // Six equal sections
  CATEGORIES.forEach((c) => {
    y += 22;
    if (y > H - 200) { doc.addPage(); y = M; }
    write(`${c.num} · ${c.title.toUpperCase()}`, 11, [200, 100, 60], true);
    write(c.short, 18, [30, 25, 35], true);
    write(c.blurb, 11, [60, 55, 65], false);
    y += 4;
    c.features.forEach((f) => write(`•  ${f}`, 10.5, [60, 55, 65], false));
    write(`In the app: ${c.routes.join('  ·  ')}`, 9.5, [130, 120, 135], false);
  });

  // CTA
  y += 26;
  write('Try it live — launch the Audiotool Bridge', 18, [30, 25, 35], true);
  write(`${APP_URL}/audiotool`, 13, [200, 100, 60], true);
  write(`Submission kit: ${APP_URL}/hackathon  ·  Verifier: ${APP_URL}/verify`, 10, [130, 120, 135], false);
  doc.save('BASE-Station-Audiotool-Submission.pdf');
}