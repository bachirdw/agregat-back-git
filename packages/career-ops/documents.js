import { readConfined, writeConfined } from '../policy-engine/files.js';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright-core';
const escape = (text) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
// Text-only, offline PDF. No template JS, remote fonts, URLs, cookies or user Chrome profile.
export async function renderCareerPdf(
  text,
  {
    executablePath = process.env.AGENT_PLATFORM_CHROME_PATH ||
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  } = {},
) {
  const browser = await chromium.launch({ executablePath, headless: true, timeout: 20000 });
  try {
    const context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: 'block' });
    await context.route('**/*', (route) => route.abort());
    const page = await context.newPage();
    await page.setContent(
      `<html lang="fr"><head><meta charset="utf-8"><style>body{font:11pt Arial,sans-serif;line-height:1.5;color:#17202a}main{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body><main>${escape(text)}</main></body></html>`,
      { timeout: 10000 },
    );
    return await page.pdf({
      format: 'A4',
      margin: { top: '18mm', bottom: '18mm', left: '18mm', right: '18mm' },
      printBackground: false,
      timeout: 15000,
    });
  } finally {
    await browser.close();
  }
}
export async function attachDocument(
  career,
  { path, format = 'md', name = 'document' },
  { render = renderCareerPdf } = {},
) {
  if (!/^output\/[a-zA-Z0-9_-]{1,120}\.md$/.test(path))
    throw new Error('Document Markdown du dossier output requis');
  if (!['md', 'pdf'].includes(format)) throw new Error('Format de document invalide');
  const root = career.path();
  const text = new TextDecoder('utf8', { fatal: true }).decode(readConfined(root, path, 200000));
  let bytes = Buffer.from(text),
    type = 'text/markdown';
  if (format === 'pdf') {
    bytes = await render(text);
    type = 'application/pdf';
    writeConfined(root, `output/${randomUUID()}.pdf`, bytes);
  }
  return career.upload(bytes, `${name}.${format}`, type, { updateCv: false });
}
