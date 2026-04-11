const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { t } = require('../config/i18n');

function getTeluguFontPath() {
    const envPath = process.env.TELUGU_FONT_PATH;
    if (envPath && fs.existsSync(envPath)) return envPath;

    const candidates = [
        // Windows
        'C:\\\\Windows\\\\Fonts\\\\gautami.ttf',
        'C:\\\\Windows\\\\Fonts\\\\nirmala.ttf',
        'C:\\\\Windows\\\\Fonts\\\\Nirmala.ttf',
        // Linux (common locations)
        '/usr/share/fonts/truetype/noto/NotoSansTelugu-Regular.ttf',
        '/usr/share/fonts/truetype/noto/NotoSansTeluguUI-Regular.ttf',
        '/usr/share/fonts/truetype/lohit-telugu/Lohit-Telugu.ttf'
    ];

    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

function formatCurrency(amount, lang) {
    const prefix = lang === 'telugu' ? 'రూ.' : 'Rs.';
    return `${prefix}${amount}`;
}

/**
 * Generates a professional PDF report for business transactions
 * @param {Object} data Summary data { sale, expense, payment, profit }
 * @param {Array} transactions List of transaction records
 * @param {string} title Report title
 * @param {string} filename Output filename
 * @returns {Promise<string>} Path to the generated PDF
 */
async function generateReportPDF(data, transactions, title, filename, lang = 'english') {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
            const filePath = path.join(__dirname, '../../tmp', filename);
            
            const tmpDir = path.join(__dirname, '../../tmp');
            if (!fs.existsSync(tmpDir)) {
                fs.mkdirSync(tmpDir, { recursive: true });
            }

            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            // Colors
            const primaryColor = '#0047AB'; // Cobalt Blue
            const secondaryColor = '#F1F3F4'; // Light Gray
            const textColor = '#333333';

            const teluguFontPath = lang === 'telugu' ? getTeluguFontPath() : null;
            if (teluguFontPath) {
                doc.registerFont('Telugu', teluguFontPath);
            }
            const baseFont = (lang === 'telugu' && teluguFontPath) ? 'Telugu' : 'Helvetica';
            const boldFont = (lang === 'telugu' && teluguFontPath) ? 'Telugu' : 'Helvetica-Bold';

            // --- HEADER ---
            doc.rect(0, 0, 600, 80).fill(primaryColor);
            doc.fillColor('white').fontSize(24).font(boldFont).text('VyapaarIQ', 50, 25);
            doc.fontSize(12).font(baseFont).text(lang === 'telugu' ? 'మీ వ్యాపార సహాయకుడు' : 'Your Business Assistant', 50, 52);
            doc.moveDown(2);

            // --- REPORT TITLE & DATE ---
            doc.fillColor(primaryColor).fontSize(18).font(boldFont).text(title, 50, 100);
            doc.fillColor(textColor).fontSize(10).font(baseFont).text(`${t(lang, 'pdf_generated_label')}: ${new Date().toLocaleString()}`, 50, 125, { align: 'right' });
            doc.moveDown(2);

            // --- SUMMARY SECTION (Premium 2x2 Grid) ---
            const startY = 160;
            const boxWidth = 242;
            const boxHeight = 50;
            const spacing = 15;

            // Row 1, Box 1: Sales
            doc.rect(50, startY, boxWidth, boxHeight).fill(secondaryColor);
            doc.fillColor(primaryColor).fontSize(9).font(boldFont).text(t(lang, 'pdf_summary_sales'), 60, startY + 10);
            doc.fillColor(textColor).fontSize(13).font(baseFont).text(formatCurrency(data.sale, lang), 60, startY + 25);

            // Row 1, Box 2: Expenses
            doc.rect(50 + boxWidth + spacing, startY, boxWidth, boxHeight).fill(secondaryColor);
            doc.fillColor('#D32F2F').fontSize(9).font(boldFont).text(t(lang, 'pdf_summary_expenses'), 60 + boxWidth + spacing, startY + 10);
            doc.fillColor(textColor).fontSize(13).font(baseFont).text(formatCurrency(data.expense, lang), 60 + boxWidth + spacing, startY + 25);

            // Row 2, Box 1: Profit
            const profit = data.sale - data.expense;
            const profitColor = profit >= 0 ? '#2E7D32' : '#D32F2F';
            doc.rect(50, startY + boxHeight + spacing, boxWidth, boxHeight).fill(profit >= 0 ? '#E8F5E9' : '#FFEBEE');
            doc.fillColor(profitColor).fontSize(9).font(boldFont).text(t(lang, 'pdf_summary_profit'), 60, startY + boxHeight + spacing + 10);
            doc.fillColor(textColor).fontSize(13).font(baseFont).text(formatCurrency(profit, lang), 60, startY + boxHeight + spacing + 25);

            // Row 2, Box 2: Received
            doc.rect(50 + boxWidth + spacing, startY + boxHeight + spacing, boxWidth, boxHeight).fill('#E3F2FD');
            doc.fillColor('#0277BD').fontSize(9).font(boldFont).text(t(lang, 'pdf_summary_received'), 60 + boxWidth + spacing, startY + boxHeight + spacing + 10);
            doc.fillColor(textColor).fontSize(13).font(baseFont).text(formatCurrency(data.payment, lang), 60 + boxWidth + spacing, startY + boxHeight + spacing + 25);

            doc.moveDown(8);
            const historyY = 320;
            doc.fillColor(textColor).fontSize(14).font(boldFont).text(t(lang, 'pdf_history_title'), 0, historyY, { align: 'center', width: doc.page.width });
            
            const tableHeaderY = historyY + 30;
            const col1 = 50, col2 = 140, col3 = 250, col4 = 440;

            // Table Header Background
            doc.rect(50, tableHeaderY, 500, 25).fill(primaryColor);
            doc.fillColor('white').fontSize(10).font(boldFont);
            doc.text(t(lang, 'pdf_col_date'), col1 + 10, tableHeaderY + 7);
            doc.text(t(lang, 'pdf_col_type'), col2, tableHeaderY + 7);
            doc.text(t(lang, 'pdf_col_category'), col3, tableHeaderY + 7);
            doc.text(t(lang, 'pdf_col_amount'), col4, tableHeaderY + 7, { align: 'right', width: 100 });

            let currentY = tableHeaderY + 25;
            let alternate = false;

            transactions.forEach((tx, index) => {
                if (currentY > 750) {
                    doc.addPage();
                    currentY = 50;
                }

                // Zebra Striping
                if (alternate) {
                    doc.rect(50, currentY, 500, 25).fill('#F9F9F9');
                }
                alternate = !alternate;

                doc.fillColor(textColor).font(baseFont).fontSize(9);
                doc.text(new Date(tx.created_at).toLocaleDateString(), col1 + 10, currentY + 7);
                
                const typeColor = tx.type === 'expense' ? '#D32F2F' : (tx.type === 'sale' ? '#0047AB' : '#2E7D32');
                const typeLabel = tx.type === 'sale'
                    ? t(lang, 'pdf_type_sale')
                    : (tx.type === 'expense' ? t(lang, 'pdf_type_expense') : t(lang, 'pdf_type_payment'));
                doc.fillColor(typeColor).font(boldFont).text(typeLabel, col2, currentY + 7);
                
                doc.fillColor(textColor).font(baseFont).text(tx.category || tx.customer_name || '-', col3, currentY + 7, { width: 180, ellipsis: true });
                doc.font(boldFont).text(formatCurrency(parseFloat(tx.amount), lang), col4, currentY + 7, { align: 'right', width: 100 });

                // Row Border Line
                doc.moveTo(50, currentY + 25).lineTo(550, currentY + 25).lineWidth(0.5).strokeColor('#EEEEEE').stroke();
                
                currentY += 25;
            });

            // --- FOOTER ---
            const pageCount = doc.bufferedPageRange().count;
            for (let i = 0; i < pageCount; i++) {
                doc.switchToPage(i);
                doc.fillColor('#999999').fontSize(8).text(
                    `Page ${i + 1} of ${pageCount}  |  VyapaarIQ - Growth & Clarity`,
                    50,
                    780,
                    { align: 'center' }
                );
            }

            doc.end();
            stream.on('finish', () => resolve(filePath));
        } catch (error) {
            reject(error);
        }
    });
}

module.exports = {
    generateReportPDF
};
