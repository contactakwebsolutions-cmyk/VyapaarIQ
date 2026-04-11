const { generateReportPDF } = require('./src/services/pdfService');
const fs = require('fs');
const path = require('path');

async function testPDF() {
    const data = { sale: 5000, expense: 1000, payment: 500 };
    const transactions = [
        { created_at: new Date(), type: 'sale', amount: 2000, category: 'Saree', customer_name: null },
        { created_at: new Date(), type: 'expense', amount: 500, category: 'Rent', customer_name: null },
        { created_at: new Date(), type: 'payment', amount: 500, category: null, customer_name: 'Kishore' }
    ];

    try {
        console.log('Generating test PDF...');
        const filePath = await generateReportPDF(data, transactions, 'Test Transaction Report', 'test_report.pdf');
        console.log('PDF generated at:', filePath);
        
        if (fs.existsSync(filePath)) {
            console.log('✅ File exists. Size:', fs.statSync(filePath).size, 'bytes');
        } else {
            console.error('❌ File does not exist!');
        }
    } catch (err) {
        console.error('❌ Error generating PDF:', err);
    }
}

testPDF();
