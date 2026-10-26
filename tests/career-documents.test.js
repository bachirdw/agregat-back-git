import test from 'node:test';
import assert from 'node:assert/strict';
import { markdownToHtml } from '../packages/career-ops/documents.js';

test('CV Markdown → HTML : titres, gras, listes ; HTML et liens neutralisés', () => {
  const html = markdownToHtml(
    '# Nom FICTIF\n**Email:** fictif@example.test\n\n## Expérience\n- **Lead** <img src=x onerror=1>\n- [Profil](javascript:alert(1))\n\n1. un\n2. deux',
  );
  assert.match(html, /<h1>Nom FICTIF<\/h1>/);
  assert.match(html, /<strong>Email:<\/strong>/);
  assert.match(html, /<ul>\n<li><strong>Lead<\/strong> &lt;img/);
  assert.match(html, /<ol>\n<li>un<\/li>\n<li>deux<\/li>\n<\/ol>/);
  assert.doesNotMatch(html, /<img|<a |\*\*/);
  assert.match(html, /Profil \(javascript:alert\(1\)\)/, 'lien rendu en texte, jamais en lien');
});
