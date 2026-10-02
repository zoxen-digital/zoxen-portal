/**
 * Renders the invoice on the page ([data-invoice-doc]) into a real A4 PDF file and downloads it.
 * The invoice is cloned at a fixed desktop width so phones get the same layout as desktop.
 */
export async function downloadInvoicePdf(fileName: string) {
  const source = document.querySelector<HTMLElement>("[data-invoice-doc]");
  if (!source) throw new Error("Invoice not found on this page");

  const [{ toJpeg }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);

  const WIDTH = 860;
  const holder = document.createElement("div");
  holder.className = "paper";
  holder.style.cssText = `position:fixed;left:-20000px;top:0;width:${WIDTH}px;background:#fff;pointer-events:none;`;
  const clone = source.cloneNode(true) as HTMLElement;
  Object.assign(clone.style, {
    width: `${WIDTH}px`,
    maxWidth: `${WIDTH}px`,
    margin: "0",
    padding: "40px",
    border: "none",
    borderRadius: "0",
    boxShadow: "none",
  });
  holder.appendChild(clone);
  document.body.appendChild(holder);

  try {
    await document.fonts?.ready;
    const dataUrl = await toJpeg(clone, { pixelRatio: 2, quality: 0.95, backgroundColor: "#ffffff" });
    const img = new Image();
    img.src = dataUrl;
    await img.decode();

    const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
    const pageW = 210;
    const pageH = 297;
    const margin = 8;
    const usableW = pageW - margin * 2;
    const usableH = pageH - margin * 2;
    const fullH = (img.height * usableW) / img.width;

    if (fullH <= usableH * 1.3) {
      // Fits (or nearly fits) on one page: scale to fit.
      const scale = Math.min(1, usableH / fullH);
      const w = usableW * scale;
      const h = fullH * scale;
      pdf.addImage(dataUrl, "JPEG", (pageW - w) / 2, margin, w, h);
    } else {
      // Long invoice: slice into A4 pages.
      const pxPerMm = img.width / usableW;
      const slicePx = Math.floor(usableH * pxPerMm);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      canvas.width = img.width;
      for (let y = 0, page = 0; y < img.height; y += slicePx, page++) {
        const h = Math.min(slicePx, img.height - y);
        canvas.height = h;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, h);
        ctx.drawImage(img, 0, y, img.width, h, 0, 0, img.width, h);
        if (page > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", margin, margin, usableW, h / pxPerMm);
      }
    }

    pdf.save(`${fileName.replace(/[^\w.-]+/g, "-")}.pdf`);
  } finally {
    holder.remove();
  }
}
