// summarizer.js - Functions for extracting comments and generating summaries

(function() {
    // Make summarizer functions available globally
    window.MyShowsSummarizer = window.MyShowsSummarizer || {};

    // Handle summarize button click
    MyShowsSummarizer.handleSummarizeClick = function() {
        console.debug("Summarize button clicked with prompt type:", MyShowsConfig.selectedPromptType);

        // Get elements
        const button = document.getElementById('summarize-button');
        const buttonIcon = document.getElementById('button-icon');
        const buttonText = document.getElementById('button-text');
        const spinner = document.getElementById('loading-spinner');
        const summaryContainer = document.getElementById('summary-container');
        const summaryContent = document.getElementById('summary-content');
        const commentCount = document.getElementById('comment-count');

        if (!button || !spinner || !summaryContainer || !summaryContent || !buttonIcon || !buttonText) {
            console.error("Required elements not found");
            return;
        }

        // Show loading state
        spinner.style.display = 'inline-block';
        buttonText.textContent = 'Analyzing...';
        button.disabled = true;

        // Make sure icon stays visible
        buttonIcon.style.display = 'inline-flex';

        // Extract comments
        const comments = MyShowsSummarizer.extractComments();

        if (comments.length === 0) {
            // Handle no comments case
            spinner.style.display = 'none';
            buttonText.textContent = MyShowsDOMUtils.getPromptDisplayName(MyShowsConfig.selectedPromptType);
            button.disabled = false;
            alert('No comments found on this page.');
            return;
        }

        // Update comment count
        commentCount.textContent = `${comments.length} comments analyzed`;

        // Show summary container with loading message
        summaryContent.textContent = "Generating summary...";
        summaryContainer.style.display = 'block';

        // Generate summary with selected prompt type
        MyShowsSummarizer.generateSummary(comments, MyShowsConfig.selectedPromptType).then(summary => {
            // Update summary content
            summaryContent.textContent = summary;

            // Reset button
            spinner.style.display = 'none';
            buttonText.textContent = MyShowsDOMUtils.getPromptDisplayName(MyShowsConfig.selectedPromptType);
            button.disabled = false;
        }).catch(error => {
            console.error('Error generating summary:', error);

            let errorMessage = "Error generating summary. ";

            if (error.message.includes('API key')) {
                errorMessage += "Please set your OpenAI API key in the extension options.";
                // Add options page link
                const optionsUrl = chrome.runtime.getURL("options.html");
                summaryContent.innerHTML = `${errorMessage} <a href="${optionsUrl}" target="_blank" style="color: #3ec1ff;">Open options</a>`;
            } else if (error.message.includes('API request failed')) {
                errorMessage += "There was a problem with the OpenAI API: " + error.message;
                summaryContent.textContent = errorMessage;
            } else {
                summaryContent.textContent = errorMessage + (error.message || "Please try again.");
            }

            // Reset button
            spinner.style.display = 'none';
            buttonText.textContent = MyShowsDOMUtils.getPromptDisplayName(MyShowsConfig.selectedPromptType);
            button.disabled = false;
        });
    };

    // Function to extract comments
    MyShowsSummarizer.extractComments = function() {
        const comments = [];

        try {
            // Get all comment elements
            const commentElements = document.querySelectorAll('.Comment__text:not(.Comment__text--showable):not(.Comment__text--deleted)');

            Array.from(commentElements).forEach(element => {
                const commentText = element.textContent.trim();

                // Find parent comment container
                let commentContainer = element;
                while (commentContainer && !commentContainer.classList.contains('Comment')) {
                    commentContainer = commentContainer.parentElement;
                }

                // Extract rating if available
                let rating = "No rating";
                if (commentContainer) {
                    const ratingElement = commentContainer.querySelector('.CommentRating__value');
                    if (ratingElement) {
                        rating = ratingElement.textContent.trim();
                    }
                }

                if (commentText) {
                    comments.push({
                        text: commentText,
                        rating: rating
                    });
                }
            });

            console.debug(`Extracted ${comments.length} comments`);
        } catch (error) {
            console.error('Error extracting comments:', error);
        }

        return comments;
    };

    // Function to generate a summary using OpenAI API
    MyShowsSummarizer.generateSummary = function(comments, promptType = 'default') {
        return new Promise((resolve, reject) => {
            // Get API key and settings from storage
            chrome.storage.sync.get(
                {
                    openaiApiKey: '',
                    selectedModel: 'gpt-4o',
                    summaryLanguage: 'english',
                    temperature: 0.7,
                    maxTokens: 600
                },
                function (items) {
                    const apiKey = items.openaiApiKey;
                    const model = items.selectedModel;
                    const language = items.summaryLanguage;
                    const temperature = items.temperature;
                    const maxTokens = items.maxTokens;

                    if (!apiKey) {
                        reject(new Error('No API key found. Please set your OpenAI API key in the extension options.'));
                        return;
                    }

                    // Prepare the comments for summarization
                    const commentTexts = comments.map((c, index) => {
                        // Truncate long comments to avoid exceeding token limits
                        const truncatedText = c.text.substring(0, 300) + (c.text.length > 300 ? '...' : '');
                        return `Comment ${index + 1}: ${truncatedText}\nRating: ${c.rating}`;
                    }).join('\n\n');

                    // Get system prompt
                    const systemMessage = window.MyShowsPrompts.systemPrompt;

                    // Get user prompt based on selected prompt type
                    let userMessage;
                    const promptFunction = window.MyShowsPrompts.userPrompts[promptType];
                    if (promptFunction && typeof promptFunction === 'function') {
                        userMessage = promptFunction(commentTexts, language);
                    } else {
                        console.warn(`Prompt type '${promptType}' not found, using default`);
                        userMessage = window.MyShowsPrompts.userPrompts.default(commentTexts, language);
                    }

                    console.debug(`Using model: ${model}, prompt type: ${promptType}, language: ${language}, temperature: ${temperature}, maxTokens: ${maxTokens}`);

                    // Decide which API to use based on model
                    const useResponsesApi = model.startsWith('gpt-5') || model.startsWith('o4');

                    const endpoint = useResponsesApi
                        ? 'https://api.openai.com/v1/responses'
                        : 'https://api.openai.com/v1/chat/completions';

                    // Build request body for each API
                    let body;
                    if (useResponsesApi) {
                        // Responses API: prefer instructions + input to convey system and user prompts
                        // Note: Many gpt-5/o4 models do not support 'temperature' in the Responses API
                        // so we intentionally omit it to avoid "Unsupported parameter" errors.
                        body = {
                            model: model,
                            // Newer APIs use max_output_tokens. For thinking models via Responses API, double to reduce truncation.
                            max_output_tokens: maxTokens * 3,
                            instructions: systemMessage,
                            input: userMessage
                        };
                    } else {
                        // Chat Completions API
                        body = {
                            model: model,
                            messages: [
                                { role: 'system', content: systemMessage },
                                { role: 'user', content: userMessage }
                            ],
                            ...(model === 'o4-mini' || model.startsWith('gpt-5')
                                ? { max_completion_tokens: maxTokens }
                                : { temperature: temperature, max_tokens: maxTokens })
                        };
                    }

                    fetch(endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify(body)
                    })
                        .then(response => {
                            if (!response.ok) {
                                return response.json().then(errorData => {
                                    console.error('API error details:', errorData);
                                    throw new Error(`API request failed: ${errorData.error?.message || response.statusText}`);
                                });
                            }
                            return response.json();
                        })
                        .then(data => {
                            // Try to parse Chat Completions response first
                            let text = null;
                            if (data && Array.isArray(data.choices) && data.choices[0]) {
                                const msg = data.choices[0].message;
                                if (msg) {
                                    if (typeof msg.content === 'string') {
                                        text = msg.content;
                                    } else if (Array.isArray(msg.content)) {
                                        // Join text parts if content is an array (vision/structured outputs)
                                        text = msg.content.map(part => typeof part === 'string' ? part : (part?.text || '')).join('').trim();
                                    }
                                }
                            }

                            // Then try Responses API format
                            if (!text && data) {
                                if (typeof data.output_text === 'string' && data.output_text.trim()) {
                                    text = data.output_text;
                                } else if (Array.isArray(data.output) && data.output.length) {
                                    // Prefer the first 'message' item (skip 'reasoning' items)
                                    for (const item of data.output) {
                                        if (item && item.type === 'message' && Array.isArray(item.content)) {
                                            const parts = item.content
                                                .filter(p => p && (p.type === 'output_text' || p.type === 'text') && typeof p.text === 'string')
                                                .map(p => p.text);
                                            if (parts.length) {
                                                text = parts.join('').trim();
                                                break;
                                            }
                                        }
                                    }
                                    // Fallback: collect any text from any content entries
                                    if (!text) {
                                        const texts = [];
                                        for (const item of data.output) {
                                            if (item && Array.isArray(item.content)) {
                                                for (const c of item.content) {
                                                    if (c && typeof c.text === 'string') texts.push(c.text);
                                                }
                                            }
                                        }
                                        if (texts.length) text = texts.join('').trim();
                                    }
                                } else if (data.response && Array.isArray(data.response.output) && data.response.output.length) {
                                    // Handle nested wrapper with response.output
                                    const nested = data.response.output;
                                    for (const item of nested) {
                                        if (item && item.type === 'message' && Array.isArray(item.content)) {
                                            const parts = item.content
                                                .filter(p => p && typeof p.text === 'string')
                                                .map(p => p.text);
                                            if (parts.length) { text = parts.join('').trim(); break; }
                                        }
                                    }
                                    if (!text) {
                                        const texts = [];
                                        for (const item of nested) {
                                            if (item && Array.isArray(item.content)) {
                                                for (const c of item.content) {
                                                    if (c && typeof c.text === 'string') texts.push(c.text);
                                                }
                                            }
                                        }
                                        if (texts.length) text = texts.join('').trim();
                                    }
                                }
                            }

                            if (text && typeof text === 'string') {
                                resolve(text.trim());
                            } else {
                                // Handle Responses API status information to provide clearer errors
                                if (data && typeof data === 'object' && typeof data.status === 'string' && data.status !== 'completed') {
                                    const reason = data.incomplete_details && data.incomplete_details.reason;
                                    if (data.status === 'incomplete') {
                                        if (reason === 'max_output_tokens') {
                                            throw new Error('The model stopped early because it reached the max_output_tokens limit. Please increase "Max tokens" in the extension options and try again.');
                                        }
                                        throw new Error(`The Responses API returned status "incomplete"${reason ? ` (${reason})` : ''}. Please try again.`);
                                    }
                                    throw new Error(`The Responses API returned status "${data.status}"${reason ? ` (${reason})` : ''}.`);
                                }

                                console.error('Unexpected API response structure:', data);
                                throw new Error('Unexpected API response structure');
                            }
                        })
                        .catch(err => {
                            console.error('Error calling OpenAI API:', err);
                            reject(err);
                        });
                }
            );
        });
    };

    console.debug("MyShows Comment Summarizer summarizer loaded");
})();
