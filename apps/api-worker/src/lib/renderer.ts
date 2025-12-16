import puppeteer from "@cloudflare/puppeteer";
import { Env } from "../types";

export async function renderChatToPdf(
  htmlContent: string,
  env: Env,
): Promise<Uint8Array> {
  if (!env.BROWSER) {
    throw new Error("BROWSER binding is not configured");
  }

  const browser = await puppeteer.launch(env.BROWSER);
  const page = await browser.newPage();

  await page.setContent(htmlContent, { waitUntil: "networkidle0" });

  // Add some basic styling for the PDF
  await page.addStyleTag({
    content: `
      body { font-family: sans-serif; padding: 20px; line-height: 1.5; }
      .message { margin-bottom: 15px; padding: 10px; border-radius: 8px; }
      .user { background: #f0f0f0; }
      .assistant { background: #e6f3ff; }
      img { max-width: 100%; height: auto; }
    `,
  });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: {
      top: "1cm",
      right: "1cm",
      bottom: "1cm",
      left: "1cm",
    },
  });

  await browser.close();

  return pdfBuffer;
}
