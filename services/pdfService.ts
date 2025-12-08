
// Declaration for the global pdfjsLib loaded via CDN in index.html
declare const pdfjsLib: any;

export const convertFileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const pdfToImages = async (file: File): Promise<string[]> => {
  const fileArrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(fileArrayBuffer).promise;
  const images: string[] = [];

  // Limit to 30 pages to handle larger question banks/books
  const maxPages = Math.min(pdf.numPages, 30); 

  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    // Increased scale to 3.0 (~216 DPI) for maximum precision on mathematical symbols and small fonts
    const viewport = page.getViewport({ scale: 3.0 }); 
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (context) {
      // Disable image smoothing for sharper text edges during extraction
      context.imageSmoothingEnabled = false;
      await page.render({ canvasContext: context, viewport: viewport }).promise;
      // Use PNG for lossless quality. This is critical for OCR of small text and subscripts.
      // Although larger in size, it prevents compression artifacts that confuse the AI.
      const base64 = canvas.toDataURL('image/png').split(',')[1];
      images.push(base64);
    }
  }

  return images;
};
