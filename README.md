# MyShows Comment Summarizer Extension

A Chrome extension that adds a button to myshows.me pages to summarize user comments using OpenAI's AI models.

## Features

- Extracts all comments from myshows.me episode pages
- Summarizes comments using OpenAI's advanced AI models
- Supports multiple languages for summaries
- Customizable AI parameters (model, temperature, output length)
- Preserves comment ratings in the analysis
- Seamless integration with the myshows.me interface

## Installation

### From Source (Development)

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" using the toggle in the top-right corner
4. Click "Load unpacked" and select the extension directory
5. The extension icon should appear in your browser toolbar

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
3. Click the button to generate an AI summary of all comments
4. The summary will appear above the comments section, showing:
    - Overall sentiment
    - Main themes discussed
    - Consensus on episode quality
    - Notable points or contradictions
    - General rating trends

## Settings

You can customize the extension by clicking its icon in the toolbar:

### AI Model
- **GPT-4o**: Fast, intelligent, flexible GPT model
- **GPT-4.1**: Flagship GPT model for complex tasks
- **GPT-4o mini**: Fast, affordable small model for focused tasks
- **GPT-4.1 mini**: Balanced for intelligence, speed, and cost
- **o4-mini**: Faster, more affordable reasoning model

### Summary Language
Choose from: English, Russian, Spanish, French, German, Japanese, or Chinese

### Temperature
Controls creativity vs. predictability (0.0-1.0):
- Lower values (closer to 0): More consistent, predictable outputs
- Higher values (closer to 1): More creative, diverse outputs

### Max Output Length
- **Short**: About 150 words
- **Medium**: About 250 words
- **Long**: About 400 words
- **Very Long**: About 600 words

## Technical Details

This extension uses:
- Chrome Extension Manifest V3
- OpenAI Chat Completions API
- jQuery for DOM manipulation
- Chrome Storage API for saving settings

## Privacy

- Your OpenAI API key is stored locally in Chrome's secure storage
- The extension only accesses myshows.me pages
- Comment data is sent to OpenAI for processing via your own API key
- No data is stored or shared beyond what is necessary for summarization

## Troubleshooting

If you encounter issues:

1. **Button not appearing**: Make sure you're on a myshows.me episode page with comments
2. **API errors**: Verify your API key is correct and has sufficient credits
3. **Extension not working**: Try refreshing the page or reloading the extension
4. **Summary cuts off**: Try increasing the "Max Output Length" in settings

## Credits

This extension was developed as an independent project and is not affiliated with myshows.me or OpenAI.

## License

MIT License - Feel free to modify and distribute this extension as needed.

---

**Note**: This extension requires an OpenAI API key to function, which may incur costs based on your OpenAI usage. Please review OpenAI's pricing before extensive use.