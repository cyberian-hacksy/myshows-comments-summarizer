const { JSDOM } = require('jsdom');

describe('MyShowsSummarizer.generateSummary', () => {
  test('uses max_completion_tokens for gpt-5 models', async () => {
    const dom = new JSDOM('<!DOCTYPE html><p>test</p>');
    global.window = dom.window;
    global.document = dom.window.document;

    // Prepare globals required by summarizer.js
    dom.window.eval('var MyShowsSummarizer = {}; window.MyShowsSummarizer = MyShowsSummarizer;');
    dom.window.eval(`var MyShowsPrompts = { systemPrompt: '', userPrompts: { default: () => 'prompt' } }; window.MyShowsPrompts = MyShowsPrompts;`);

    // Mock chrome.storage.sync.get
    global.chrome = {
      storage: {
        sync: {
          get: (_defaults, callback) => {
            callback({
              openaiApiKey: 'test-key',
              selectedModel: 'gpt-5',
              summaryLanguage: 'english',
              temperature: 0.5,
              maxTokens: 100
            });
          }
        }
      }
    };

    // Mock fetch
    const fetchMock = jest.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'ok' } }] })
    }));
    global.fetch = fetchMock;

    // Load summarizer script
    const fs = require('fs');
    const path = require('path');
    const scriptContent = fs.readFileSync(path.resolve(__dirname, '../summarizer.js'), 'utf-8');
    dom.window.eval(scriptContent);

    const comments = [{ text: 'hi', rating: '5' }];
    await dom.window.MyShowsSummarizer.generateSummary(comments, 'default');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.max_completion_tokens).toBe(100);
    expect(body).not.toHaveProperty('max_tokens');
  });
});
