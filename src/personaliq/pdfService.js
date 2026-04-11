const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { personalText } = require('./messages');
const translit = require('../services/transliterationService');

function getTeluguFontPath() {
    const envPath = process.env.TELUGU_FONT_PATH;
    if (envPath && fs.existsSync(envPath)) return envPath;

    const candidates = [
        'C:\\\\Windows\\\\Fonts\\\\gautami.ttf',
        'C:\\\\Windows\\\\Fonts\\\\nirmala.ttf',
        'C:\\\\Windows\\\\Fonts\\\\Nirmala.ttf',
        '/usr/share/fonts/truetype/noto/NotoSansTelugu-Regular.ttf',
        '/usr/share/fonts/truetype/noto/NotoSansTeluguUI-Regular.ttf',
        '/usr/share/fonts/truetype/lohit-telugu/Lohit-Telugu.ttf'
    ];

    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

function formatCurrency(amount) {
    const n = typeof amount === 'number' ? amount : parseFloat(amount);
    return `₹${Math.round(n * 100) / 100}`;
}

async function generatePersonalReportPDF({ lang, title, summary, transactions, filename }) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
            const filePath = path.join(__dirname, '../../tmp', filename);

            const tmpDir = path.join(__dirname, '../../tmp');
            if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            const primaryColor = '#0047AB';
            const secondaryColor = '#F1F3F4';
            const textColor = '#333333';

            const teluguFontPath = lang === 'telugu' ? getTeluguFontPath() : null;
            if (teluguFontPath) doc.registerFont('Telugu', teluguFontPath);
            const effectiveLang = (lang === 'telugu' && !teluguFontPath) ? 'english' : lang;
            const baseFont = (effectiveLang === 'telugu') ? 'Telugu' : 'Helvetica';
            const boldFont = (effectiveLang === 'telugu') ? 'Telugu' : 'Helvetica-Bold';

            const safeText = (text) => {
                const s = text == null ? '' : String(text);
                if (effectiveLang === 'english' && lang === 'telugu') return translit.toEnglish(s) || s;
                return s;
            };

            // Header
            doc.rect(0, 0, 600, 80).fill(primaryColor);
            doc.fillColor('white').fontSize(24).font(boldFont).text('PersonalIQ', 50, 25);
            doc.fontSize(12).font(baseFont).text(effectiveLang === 'telugu' ? 'మీ వ్యక్తిగత సహాయకుడు' : 'Your Personal Assistant', 50, 52);

            // Title + date
            doc.fillColor(primaryColor).fontSize(18).font(boldFont).text(safeText(title), 50, 100);
            doc.fillColor(textColor).fontSize(10).font(baseFont).text(`${effectiveLang === 'telugu' ? 'తయారు చేసిన సమయం' : 'Generated'}: ${new Date().toLocaleString()}`, 50, 125, { align: 'right' });

            // Summary (2x2)
            const startY = 160;
            const boxWidth = 242;
            const boxHeight = 50;
            const spacing = 15;

            doc.rect(50, startY, boxWidth, boxHeight).fill(secondaryColor);
            doc.fillColor(primaryColor).fontSize(9).font(boldFont).text(effectiveLang === 'telugu' ? 'బ్యాలెన్స్' : 'BALANCE', 60, startY + 10);
            doc.fillColor(textColor).fontSize(13).font(baseFont).text(formatCurrency(summary.balance), 60, startY + 25);

            doc.rect(50 + boxWidth + spacing, startY, boxWidth, boxHeight).fill(secondaryColor);
            doc.fillColor('#D32F2F').fontSize(9).font(boldFont).text(effectiveLang === 'telugu' ? 'ఈరోజు ఖర్చు' : 'TODAY EXPENSE', 60 + boxWidth + spacing, startY + 10);
            doc.fillColor(textColor).fontSize(13).font(baseFont).text(formatCurrency(summary.todayExpense), 60 + boxWidth + spacing, startY + 25);

            doc.rect(50, startY + boxHeight + spacing, boxWidth, boxHeight).fill('#E3F2FD');
            doc.fillColor('#0277BD').fontSize(9).font(boldFont).text(effectiveLang === 'telugu' ? 'మొత్తం ఖర్చు' : 'TOTAL EXPENSE', 60, startY + boxHeight + spacing + 10);
            doc.fillColor(textColor).fontSize(13).font(baseFont).text(formatCurrency(summary.totalExpense), 60, startY + boxHeight + spacing + 25);

            doc.rect(50 + boxWidth + spacing, startY + boxHeight + spacing, boxWidth, boxHeight).fill('#E8F5E9');
            doc.fillColor('#2E7D32').fontSize(9).font(boldFont).text(effectiveLang === 'telugu' ? 'స్థితి' : 'STATUS', 60 + boxWidth + spacing, startY + boxHeight + spacing + 10);
            doc.fillColor(textColor).fontSize(10).font(baseFont).text(safeText(summary.statusMessage || '-'), 60 + boxWidth + spacing, startY + boxHeight + spacing + 25, { width: boxWidth - 20, ellipsis: true });

            // History title
            doc.moveDown(8);
            const historyY = 320;
            doc.fillColor(textColor).fontSize(14).font(boldFont).text(effectiveLang === 'telugu' ? 'లావాదేవీల చరిత్ర' : 'Transactions History', 0, historyY, { align: 'center', width: doc.page.width });

            const tableHeaderY = historyY + 30;
            const col1 = 50, col2 = 140, col3 = 250, col4 = 440;

            doc.rect(50, tableHeaderY, 500, 25).fill(primaryColor);
            doc.fillColor('white').fontSize(10).font(boldFont);
            doc.text(effectiveLang === 'telugu' ? 'తేదీ' : 'DATE', col1 + 10, tableHeaderY + 7);
            doc.text(effectiveLang === 'telugu' ? 'రకం' : 'TYPE', col2, tableHeaderY + 7);
            doc.text(effectiveLang === 'telugu' ? 'నోట్/వర్గం' : 'NOTE/CAT', col3, tableHeaderY + 7);
            doc.text(effectiveLang === 'telugu' ? 'మొత్తం' : 'AMOUNT', col4, tableHeaderY + 7, { align: 'right', width: 100 });

            let currentY = tableHeaderY + 25;
            let alternate = false;

            transactions.forEach((tx) => {
                if (currentY > 750) {
                    doc.addPage();
                    currentY = 50;
                }

                if (alternate) doc.rect(50, currentY, 500, 25).fill('#F9F9F9');
                alternate = !alternate;

                doc.fillColor(textColor).font(baseFont).fontSize(9);
                doc.text(new Date(tx.created_at).toLocaleDateString(), col1 + 10, currentY + 7);

                const typeColor = tx.type === 'expense' ? '#D32F2F' : '#2E7D32';
                const typeLabel = tx.type === 'expense'
                    ? (effectiveLang === 'telugu' ? 'ఖర్చు' : 'EXPENSE')
                    : (effectiveLang === 'telugu' ? 'ఆదాయం' : 'INCOME');
                doc.fillColor(typeColor).font(boldFont).text(typeLabel, col2, currentY + 7);
                
                doc.fillColor(textColor).font(baseFont).text(safeText(tx.note || tx.category || '-'), col3, currentY + 7, { width: 180, ellipsis: true });
                doc.font(boldFont).text(formatCurrency(parseFloat(tx.amount)), col4, currentY + 7, { align: 'right', width: 100 });

                doc.moveTo(50, currentY + 25).lineTo(550, currentY + 25).lineWidth(0.5).strokeColor('#EEEEEE').stroke();
                currentY += 25;
            });

            // Footer
            const pageCount = doc.bufferedPageRange().count;
            for (let i = 0; i < pageCount; i++) {
                doc.switchToPage(i);
                doc.fillColor('#999999').fontSize(8).font(baseFont).text(
                    `Page ${i + 1} of ${pageCount}  |  PersonalIQ`,
                    50,
                    780,
                    { align: 'center' }
                );
            }

            doc.end();
            stream.on('finish', () => resolve(filePath));
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = { generatePersonalReportPDF };
