// Import npm packages (installed via npm)
import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun } from "docx";

// Function to export text as PDF
export function exportAsPdf(text, filename) {
    const pdf = new jsPDF();
    
    const margin = 10;
    const pageWidth = pdf.internal.pageSize.getWidth() - 2 * margin;
    const pageHeight = pdf.internal.pageSize.getHeight() - 2 * margin;
    
    let y = margin; // Initial Y position
    const lineHeight = 10; // Space between lines
    
    const lines = pdf.splitTextToSize(text, pageWidth);

    lines.forEach(line => {
        if (y + lineHeight > pageHeight) {
            pdf.addPage(); // Add a new page if needed
            y = margin; // Reset Y position
        }
        pdf.text(line, margin, y);
        y += lineHeight;
    });

    pdf.save(filename);
}


// Function to export as DOCX
export function exportAsDocx(text, filename) {
    const doc = new Document({
        sections: [{
            children: [
                new Paragraph({
                    children: [
                        new TextRun({ text: text, size: 24 })
                    ]
                })
            ]
        }]
    });

    Packer.toBlob(doc).then(blob => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

window.exportAsPdf = exportAsPdf;
window.exportAsDocx = exportAsDocx;
