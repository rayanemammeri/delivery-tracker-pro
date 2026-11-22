import type { DailyReport } from './report';
import { formatDateLong } from './time';

/** Les polices PDF standard ne connaissent pas certains espaces/symboles Unicode : on les normalise. */
const clean = (s: string) => s.replace(/[  ]/g, ' ').replace(/−/g, '-').replace(/—/g, '-').replace(/➜/g, '>');

/** Génère et télécharge le bilan quotidien en PDF (bibliothèque chargée à la demande). */
export async function exportReportPdf(r: DailyReport): Promise<void> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 86, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(r.title, 40, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(clean(`Date : ${formatDateLong(r.date)}`), 40, 64);
  doc.text('Delivery Tracker Pro', W - 40, 42, { align: 'right' });

  let y = 110;
  for (const sec of r.sections) {
    const body = sec.rows.map(([k, v]) => [clean(k), clean(v)]);
    autoTable(doc, {
      startY: y,
      head: [[clean(sec.title), '']],
      body,
      foot: sec.total ? [[clean(sec.total[0]), { content: clean(sec.total[1]), styles: { halign: 'right' } }]] : undefined,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 5, textColor: [30, 41, 59] },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [236, 253, 245], textColor: [6, 95, 70], fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right', cellWidth: 150 } },
      margin: { left: 40, right: 40 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 14;
  }
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(doc.splitTextToSize(clean(r.note), W - 80), 40, y + 6);
  doc.text(clean(`Généré le ${new Date().toLocaleString('fr-CA')}`), 40, doc.internal.pageSize.getHeight() - 24);

  doc.save(`bilan-${r.date}.pdf`);
}
