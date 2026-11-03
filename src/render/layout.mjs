import { escapeHtml } from './html.mjs';
import { LEAVE_LINE_SCRIPT, LINE_NOTICE } from './leave-line.mjs';
import { renderSigninPanel, SIGNIN_HEAD_SCRIPT, signinConfigScript } from './signin.mjs';

const GOOGLE_FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;900&display=swap">`;

const ogMeta = (property, content) => `<meta property="og:${property}" content="${escapeHtml(content)}">`;

export function page({ title, description, rel, main, scripts, ogUrl, ogImage, leaveLine = false, signIn }) {
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    leaveLine ? `<script>${LEAVE_LINE_SCRIPT}</script>` : '',
    signIn ? `<script>${SIGNIN_HEAD_SCRIPT}</script>` : '',
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    ogMeta('title', title),
    ogMeta('description', description),
    ogUrl ? ogMeta('url', ogUrl) : '',
    ogImage ? ogMeta('image', ogImage) : '',
    GOOGLE_FONTS,
    `<link rel="stylesheet" href="${rel}css/site.css">`,
  ].filter(Boolean);
  const allScripts = signIn ? ['js/signin.js', ...scripts] : scripts;
  const scriptTags = allScripts.map((src) => `<script type="module" src="${rel}${escapeHtml(src)}"></script>`);
  const signinBlock = signIn ? `${renderSigninPanel()}\n${signinConfigScript(signIn)}\n` : '';
  return `<!doctype html>
<html lang="zh-Hant-TW">
<head>
${head.join('\n')}
</head>
<body>
${leaveLine ? `${LINE_NOTICE}\n` : ''}${signinBlock}<main>
${main}
</main>
${scriptTags.join('\n')}
</body>
</html>
`;
}
