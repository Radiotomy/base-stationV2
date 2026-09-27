import { jsPDF } from 'jspdf';
import { DECK_SLIDES } from './deckSlides';
import { loadImageDataUrl } from './loadImage';

const W = 1439, H = 810;

function background(doc) {
  doc.setFillColor(33, 27, 43);
  doc.rect(0, 0, W, H, 'F');
  doc.setFillColor(41, 34, 50);
  doc.setDrawColor(80, 72, 90);
  doc.roundedRect(24, 24, W - 48, H - 48, 20, 20, 'FD');
}

function text(doc, str, x, y, size, maxW, color = [248, 243, 237], bold = true) {
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(str, maxW);
  doc.text(lines, x, y);
  return y + lines.length * size * 1.2;
}

export async function exportDeckPdf() {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'px', format: [W, H], hotfixes: ['px_scaling'] });
  for (let i = 0; i < DECK_SLIDES.length; i++) {
    const s = DECK_SLIDES[i];
    if (i > 0) doc.addPage([W, H], 'landscape');
    background(doc);
    if (s.kind === 'hero') {
      doc.addImage(await loadImageDataUrl(s.image), 'JPEG', 25, 25, W - 50, H - 50);
      doc.setGState(new doc.GState({ opacity: 0.7 }));
      doc.setFillColor(22, 18, 29);
      doc.rect(25, 25, W - 50, H - 50, 'F');
      doc.setGState(new doc.GState({ opacity: 1 }));
      text(doc, s.title, 100, 480, 52, 1110);
    } else if (s.kind === 'overview') {
      text(doc, s.eyebrow.toUpperCase(), 80, 110, 18, 600, [255, 190, 150]);
      text(doc, s.title, 80, 160, 46, 1200);
      s.items.forEach((c, j) => {
        const x = 80 + (j % 3) * 430, y = 250 + Math.floor(j / 3) * 250;
        doc.setFillColor(52, 44, 62);
        doc.roundedRect(x, y, 400, 220, 14, 14, 'F');
        text(doc, c.num, x + 24, y + 50, 26, 350, [255, 190, 150]);
        text(doc, c.short, x + 24, y + 95, 28, 350);
        text(doc, c.blurb, x + 24, y + 135, 15, 350, [210, 200, 210], false);
      });
    } else {
      doc.addImage(await loadImageDataUrl(s.image), 'JPEG', 790, 60, 600, H - 120);
      let y = text(doc, s.eyebrow.toUpperCase(), 80, 120, 18, 640, [255, 190, 150]);
      y = text(doc, s.title, 80, y + 30, 44, 660);
      if (s.body) y = text(doc, s.body, 80, y + 10, 20, 660, [220, 210, 220], false);
      (s.bullets || []).forEach((b) => { y = text(doc, `•  ${b}`, 80, y + 14, 19, 660, [235, 228, 235], false); });
    }
  }
  doc.save('BASE-Station-Audiotool-Deck.pdf');
}