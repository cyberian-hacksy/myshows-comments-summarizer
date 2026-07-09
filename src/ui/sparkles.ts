// The extension's AI-brand mark: twin sparkles filled with the myshows
// magenta→cyan gradient. SVG gradient defs live in a page-global id
// namespace, so every gradient id must be unique per inline SVG.
export function sparklesIcon(size: number, gradId: string): string {
  return `
<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${gradId}" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
      <stop stop-color="#dd0cff"/>
      <stop offset="1" stop-color="#00c8ff"/>
    </linearGradient>
  </defs>
  <path d="M10 2.8l1.9 5 5 1.9-5 1.9-1.9 5-1.9-5-5-1.9 5-1.9 1.9-5z" fill="url(#${gradId})"/>
  <path d="M18.6 12.8l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1 1-2.6z" fill="url(#${gradId})"/>
</svg>`
}
