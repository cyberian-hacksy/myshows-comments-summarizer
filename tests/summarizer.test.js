const { JSDOM } = require('jsdom');

describe('MyShowsSummarizer.extractComments', () => {
  test('extracts all comments with appropriate ratings', () => {
    const html = `
      <div class="Comment">
        <div class="Comment__text">First comment</div>
        <div class="CommentRating__value">5</div>
      </div>
      <div class="Comment">
        <div class="Comment__text">Second comment</div>
        <div class="CommentRating__value">7</div>
      </div>
      <div class="Comment">
        <div class="Comment__text">Third comment</div>
      </div>
    `;

    const dom = new JSDOM(html);
    global.window = dom.window;
    global.document = dom.window.document;

    // Prepare global variable so the script can attach to it
    dom.window.eval('var MyShowsSummarizer = {}; window.MyShowsSummarizer = MyShowsSummarizer;');

    // Evaluate the summarizer script in the JSDOM context
    const fs = require('fs');
    const path = require('path');
    const scriptContent = fs.readFileSync(path.resolve(__dirname, '../summarizer.js'), 'utf-8');
    dom.window.eval(scriptContent);

    const comments = dom.window.MyShowsSummarizer.extractComments();

    expect(comments.map(c => c.text)).toEqual([
      'First comment',
      'Second comment',
      'Third comment'
    ]);

    expect(comments).toEqual([
      { text: 'First comment', rating: '5' },
      { text: 'Second comment', rating: '7' },
      { text: 'Third comment', rating: 'No rating' }
    ]);
  });
});

