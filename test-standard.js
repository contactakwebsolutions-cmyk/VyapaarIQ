const { generateReportPDF } = require('./src/services/pdfService');
const fs = require('fs');

async function testStandardizedPDF() {
    const data = { 
        sale: 10000, 
        expense: 2000, 
        payment: 5000 // Total Received
    };
    
    // In our new logic, generateReportPDF expects (data, transactions, title, filename)
    // data should contain { sale, expense, payment }
    
    const transactions = [
        { created_at: new Date(), type: 'sale', amount: 5000, category: 'Saree', customer_name: null },
        { created_at: new Date(), type: 'payment', amount: 2000, category: null, customer_name: 'Kishore' },
        { created_at: new Date(), type: 'expense', amount: 1000, category: 'Rent', customer_name: null }
    ];

    try {
        console.log('Generating Standardized Premium PDF (2x2 Grid)...');
        const filePath = await generateReportPDF(data, transactions, 'Weekly Standardized Report', 'standard_report.pdf');
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

testStandardizedPDF();
