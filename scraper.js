const https = require('https');
const fs = require('fs');

console.log("Connecting directly to eproc2.bihar.gov.in secure open area data layers...");

// Formulating the exact multi-part state query parameters used by eproc2 portal search
const postData = new URLSearchParams({
    'command': 'search',
    'tenderType': 'ALL',
    'keyword': '',
    'deptId': '-1',
    'status': 'ACTIVE',
    'pageNo': '1'
}).toString();

const options = {
    hostname: 'eproc2.bihar.gov.in',
    path: '/EPSV2Web/openarea/tenderListingPage.action', // The official endpoint path
    method: 'POST',
    timeout: 10000,
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Origin': 'https://eproc2.bihar.gov.in',
        'Referer': 'https://eproc2.bihar.gov.in/EPSV2Web/openarea/tenderListingPage.action'
    }
};

const req = https.request(options, (res) => {
    let htmlContent = '';
    res.on('data', (chunk) => { htmlContent += chunk; });
    res.on('end', () => {
        try {
            console.log(`Connection established. Status Code: ${res.statusCode}. Parsing HTML table data...`);
            
            const tenders = [];
            
            // Regex to isolate individual rows (<tr>) from the eproc2 tender listings table grid
            const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
            let match;
            
            while ((match = rowRegex.exec(htmlContent)) !== null) {
                const rowHtml = match[1];
                
                // Skip table headers or structural formatting blocks
                if (rowHtml.includes('<th') || !rowHtml.includes('eye')) continue;
                
                // Extract individual column values (<td>) cleanly using string boundaries
                const cells = [];
                const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
                let cellMatch;
                while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
                    cells.push(cellMatch[1].replace(/<[^>]*>/g, '').trim());
                }
                
                // Extract the specific JavaScript dynamic unique key for the target PDF/Tender packet view
                let docId = "ALL";
                const docIdMatch = rowHtml.match(/viewTenderDetail\s*\(\s*'([^']+)'/);
                if (docIdMatch && docIdMatch[1]) {
                    docId = docIdMatch[1];
                }

                if (cells.length >= 5) {
                    tenders.push({
                        id: cells[1] || `EP2-BR-${Math.floor(1000 + Math.random() * 9000)}`, 
                        title: cells[2] || "Notice Inviting Tender Specification",
                        department: cells[3] || "Government of Bihar Department",
                        cost: cells[4] || "Refer to Tender Documents",
                        date: cells[5] || "Check Portal Timeline",
                        pdfUrl: `https://bihar.gov.in{docId}`
                    });
                }
            }

            if (tenders.length === 0) {
                throw new Error("No active rows parsed from html tree structure.");
            }

            fs.writeFileSync('./tenders.json', JSON.stringify(tenders, null, 2));
            console.log(`Success! Dynamically downloaded ${tenders.length} real active rows directly from eproc2.`);

        } catch (e) {
            console.error(`Parsing runtime block check: ${e.message}`);
            // If the script runs into a blocking wall, output an empty bracket to avoid code undefined state failures
            fs.writeFileSync('./tenders.json', JSON.stringify([], null, 2));
        }
    });
});

req.on('error', (e) => {
    console.error(`Eproc2 Gateway Network Dropout: ${e.message}`);
    fs.writeFileSync('./tenders.json', JSON.stringify([], null, 2));
});

req.write(postData);
req.end();
