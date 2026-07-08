# MyShows Comment Summarizer Extension

A Chrome extension that adds a button to myshows.me pages to summarize user comments using OpenAI's AI models.

## Features

- Extracts all comments from myshows.me episode pages
- Summarizes comments using OpenAI's models via the Responses API
- Model list fetched live from your OpenAI account (with offline fallback)
- Customizable prompts: edit the built-in prompts or create your own
- Supports multiple languages for summaries
- Customizable AI parameters (model, temperature, output length)
- Preserves comment ratings in the analysis
- Seamless integration with the myshows.me interface

## Installation

### From Source (Development)

1. Clone this repository or download the source code
2. Install dependencies and build the extension:
   ```bash
   npm install
   npm run build
   ```
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" using the toggle in the top-right corner
5. Click "Load unpacked" and select the `dist` directory
6. The extension icon should appear in your browser toolbar

### Development

- `npm run dev` — Vite dev server with hot reload (CRXJS)
- `npm test` — run the Vitest test suite
- `npm run build` — type-check and produce a production build in `dist/`

## Setup

Before using the extension, you need to configure it with your OpenAI API key:

1. Click on the extension icon in the toolbar to open the settings popup
2. Enter your OpenAI API key (starts with "sk-")
3. Select your preferred model, language, and other parameters
4. Click "Save"

If you don't have an OpenAI API key, you can get one from the [OpenAI Platform](https://platform.openai.com/account/api-keys).

## Usage

1. Navigate to any episode page on myshows.me
2. Look for the "Summarize Comments" button above the comments section
3. Click the button to generate an AI summary of all comments, or use the
   arrow next to it to pick a different prompt (built-in or your own)
4. The summary will appear above the comments section

## Settings

### AI Model
The model dropdown is populated from your OpenAI account via the
[`/v1/models`](https://platform.openai.com/docs/api-reference/models) endpoint,
filtered to text-generation models, and cached for 24 hours (use the ↻ button
to refresh). Without a key, a built-in default list is shown.

### Prompts
Click "Manage prompts…" in the popup to open the prompt library:

- **Built-in prompts** (Summarize Comments, Top Comments, Critic Analysis,
  Episode Rating) can be edited and reset back to their defaults, but not deleted.
- **Custom prompts** can be created, edited, and deleted freely.
- Templates support three placeholders: `{count}` (number of comments),
  `{comments}` (the comments with their ratings), and `{language}` (the summary language).
- The **system prompt** that frames every request is also editable and resettable.

### Summary Language
Supports dozens of languages including English, Russian, Spanish, French, German, Japanese, and Chinese. For the complete list, see [languages.json](https://github.com/cyberian-hacksy/myshows-comments-summarizer/blob/main/languages.json).

### Temperature
Controls creativity vs. predictability (0.0-1.0):
- Lower values (closer to 0): More consistent, predictable outputs
- Higher values (closer to 1): More creative, diverse outputs

Reasoning models (gpt-5 family, o-series) ignore this setting.

### Max Output Length
- **Short**: About 150 words
- **Medium**: About 250 words
- **Long**: About 400 words
- **Very Long**: About 600 words

For reasoning models the raw token budget is tripled internally, since these
models also spend output tokens on thinking.

## Technical Details

This extension uses:
- Chrome Extension Manifest V3
- TypeScript, built with Vite and [CRXJS](https://crxjs.dev/vite-plugin)
- OpenAI Responses API (single code path for all models)
- Chrome Storage API for saving settings
- Vitest for unit tests

## Privacy

- Your OpenAI API key is stored in `chrome.storage.local` — it stays on the
  device and is never synced through your Google account
- The extension only accesses myshows.me pages
- Comment data is sent to OpenAI for processing via your own API key
- No data is stored or shared beyond what is necessary for summarization

## Troubleshooting

If you encounter issues:

1. **Button not appearing**: Make sure you're on a myshows.me episode page with comments
2. **API errors**: Verify your API key is correct and has sufficient credits
3. **Extension not working**: Try refreshing the page or reloading the extension
4. **Summary cuts off**: Try increasing the "Max Output Length" in settings
5. **Model missing from the list**: Click the ↻ refresh button next to the model dropdown

## Credits

This extension was developed as an independent project and is not affiliated with myshows.me or OpenAI.

## License

MIT License - Feel free to modify and distribute this extension as needed.

---

**Note**: This extension requires an OpenAI API key to function, which may incur costs based on your OpenAI usage. Please review OpenAI's pricing before extensive use.
