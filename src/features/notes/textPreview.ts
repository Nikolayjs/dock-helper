export function stripHtml(html: string): string {
  const container = document.createElement('div');
  container.innerHTML = html.replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>|<br\s*\/?>/gi, '$&\n');
  return (container.textContent ?? '').replace(/\s+/g, ' ').trim();
}
