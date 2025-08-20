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

                    // Make API call to OpenAI's Chat Completions endpoint
                    fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            model: model,
                            messages: [
                                {role: 'system', content: systemMessage},
                                {role: 'user', content: userMessage}
                            ],
                            ...(
                                model === 'o4-mini'
                                    ? { max_completion_tokens: maxTokens }
                                    : model.startsWith('gpt-5')
                                        ? { max_completion_tokens: maxTokens }
                                        : { temperature: temperature, max_tokens: maxTokens }
                            )
                        })
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
                            if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
                                resolve(data.choices[0].message.content.trim());
                            } else {
                                throw new Error('Invalid API response');
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
