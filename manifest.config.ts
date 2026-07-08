import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'MyShows Comment Summarizer',
  version: '1.4.0',
  description: "Adds a comment summarizer button to myshows.me pages using OpenAI's models",
  permissions: ['storage'],
  icons: { '128': 'icons/128.png', '192': 'icons/192.png' },
  action: {
    default_title: 'MyShows Comment Summarizer',
    default_popup: 'src/popup/popup.html',
    default_icon: { '128': 'icons/128.png', '192': 'icons/192.png' },
  },
  options_ui: { page: 'src/options/options.html', open_in_tab: true },
  content_scripts: [
    {
      matches: ['*://*.myshows.me/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_end',
    },
  ],
})
