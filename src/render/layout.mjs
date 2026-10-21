import { escapeHtml } from './html.mjs';

const GOOGLE_FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;900&display=swap">`;

const ogMeta = (property, content) => `<meta property="og:${property}" content="${escapeHtml(content)}">`;

export function page({ title, description, rel, main, scripts, ogUrl, ogImage }) {
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    ogMeta('title', title),
    ogMeta('description', description),
    ogUrl ? ogMeta('url', ogUrl) : '',
    ogImage ? ogMeta('image', ogImage) : '',
    GOOGLE_FONTS,
    `<link rel="stylesheet" href="${rel}css/site.css">`,
  ].filter(Boolean);
  const scriptTags = scripts.map((src) => `<script type="module" src="${rel}${escapeHtml(src)}"></script>`);
  return `<!doctype html>
<html lang="zh-Hant-TW">
<head>
${head.join('\n')}
</head>
<body>
<main>
${main}
</main>
${scriptTags.join('\n')}
</body>
</html>
`;
}
