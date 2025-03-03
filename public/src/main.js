// Import npm packages (installed via npm)
import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun } from "docx";

// Function to export text as PDF
export function exportAsPdf(text, filename) {
    const pdf = new jsPDF();
    
    // Define custom margins
    const marginLeft = 20;
    const marginRight = 20;
    const marginTop = 20;
    const marginBottom = 20;
    
    // Calculate available width and height
    const pageWidth = pdf.internal.pageSize.getWidth() - marginLeft - marginRight;
    const pageHeight = pdf.internal.pageSize.getHeight() - marginTop - marginBottom;
    
    let y = marginTop;
    const lineHeight = 10;

    // Split the text into paragraphs based on newline
    const paragraphs = text.split('\n');

    paragraphs.forEach(paragraph => {
        const wrappedLines = pdf.splitTextToSize(paragraph, pageWidth);

        wrappedLines.forEach(line => {
            // If we're exceeding the page height, add a new page
            if (y + lineHeight > pageHeight + marginTop) {
                pdf.addPage();
                y = marginTop;
            }
            pdf.text(line, marginLeft, y);
            y += lineHeight;
        });
    });

    pdf.save(filename);
}


export function exportAsDocx(text, filename) {
    // Split on newlines
    const lines = text.split('\n');

    // Create an array of Paragraph objects, one per line
    const docParagraphs = lines.map(line => {
        return new Paragraph({
            children: [
                new TextRun({ text: line, size: 24 })
            ]
        });
    });

    const doc = new Document({
        sections: [
            { children: docParagraphs }
        ]
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
