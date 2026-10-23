export function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter(Boolean));
  return node;
}

export const externalLink = (textContent, href, className = '') =>
  el('a', { textContent, href, className, target: '_blank', rel: 'noopener' });
