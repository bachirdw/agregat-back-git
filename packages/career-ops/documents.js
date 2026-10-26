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
// Minimal Markdown → HTML for CVs and letters. Everything is escaped first, so only the tags
// produced here exist (no raw HTML, links rendered as text, no images).
const inline = (text) =>
  escape(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*(?!\s)(.+?)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1 ($2)');
export function markdownToHtml(markdown) {
  const out = [];
  let list = null;
  let paragraph = [];
  const flush = () => {
    if (paragraph.length) out.push(`<p>${paragraph.map(inline).join('<br>')}</p>`);
    paragraph = [];
  };
  const close = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (const raw of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (!line.trim()) {
      flush();
      close();
    } else if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
      flush();
      close();
      out.push('<hr>');
    } else if (heading) {
      flush();
      close();
      const level = Math.min(heading[1].length, 4);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
    } else if (bullet || numbered) {
      flush();
      const kind = bullet ? 'ul' : 'ol';
      if (list !== kind) {
        close();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inline((bullet || numbered)[1])}</li>`);
    } else {
      close();
      paragraph.push(line);
    }
  }
  flush();
  close();
  return out.join('\n');
}
// Offline PDF. No template JS, remote fonts, URLs, cookies or user Chrome profile.
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
      `<html lang="en"><head><meta charset="utf-8"><style>body{font:10.5pt Arial,sans-serif;line-height:1.45;color:#17202a}main{overflow-wrap:anywhere}h1{font-size:18pt;margin:0 0 4pt}h2{font-size:12.5pt;margin:12pt 0 4pt;border-bottom:1px solid #ccd;padding-bottom:2pt}h3,h4{font-size:11pt;margin:9pt 0 3pt}p{margin:0 0 6pt}ul,ol{margin:0 0 6pt;padding-left:16pt}li{margin:0 0 2pt}hr{border:0;border-top:1px solid #ccd;margin:8pt 0}code{font-family:inherit}</style></head><body><main>${markdownToHtml(text)}</main></body></html>`,
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
