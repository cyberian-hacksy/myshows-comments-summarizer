// Function to add our button
function addSummarizeButton() {
    // Find the comments section using jQuery
    const $commentsSection = $('#comments');

    if ($commentsSection.length > 0) {
        // First check if API key exists
        chrome.storage.sync.get({ openaiApiKey: '' }, function(items) {
            // Create our container for the button and summary
            const $container = $('<div id="comment-summarizer-container"></div>');

            if (!items.openaiApiKey) {
                // No API key found, show a button that opens extension settings
                $container.html(`
                    <button class="summarize-button" id="open-api-settings">
                        <span class="SvgSpriteIcon" style="margin-right: 6px;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-13a1 1 0 0 0-1 1v5a1 1 0 0 0 2 0V8a1 1 0 0 0-1-1zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" fill="currentColor"/>
                            </svg>
                        </span>
                        Set up OpenAI API key for Comment Summarizer
                    </button>
                `);

                // Add click event to open extension settings
                $('#open-api-settings').on('click', function(e) {
                    e.preventDefault();
                    // Tell user to click on the extension icon
                    alert('Please click on the extension icon in the toolbar to set up your OpenAI API key.');
                });
            } else {
                // API key exists, show normal summarize button

                // Create the summary container (hidden initially)
                const $summaryContainer = $('<div class="comment-summary-container hidden"></div>')
                    .html(`
                    <div class="comment-summary-header">
                      <h3 class="comment-summary-title">AI Comment Summary</h3>
                      <span class="comment-summary-count"></span>
                    </div>
                    <div class="comment-summary-content"></div>
                  `);

                // Create the button with an icon
                const $button = $(`
                  <button class="summarize-button">
                    <span class="SvgSpriteIcon" style="margin-right: 6px;">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 5h16v2H4V5zm0 6h16v2H4v-2zm0 6h16v2H4v-2z" fill="currentColor"/>
                      </svg>
                    </span>
                    Summarize Comments
                  </button>
                `);

                // Add loading spinner (hidden initially)
                const $loadingSpinner = $('<span class="loading-spinner hidden"></span>');
                $button.prepend($loadingSpinner);

                // Add click event listener to the button
                $button.on('click', function() {
                    handleSummarizeClick($summaryContainer, $loadingSpinner, $button);
                });

                // Add elements to our container
                $container.append($button);
                $container.append($summaryContainer);
            }

            // Insert the container before the comments section
            $container.insertBefore($commentsSection);
        });
    } else {
        console.log("Comments section not found");
    }
}

// Function to handle button click
function handleSummarizeClick($summaryContainer, $loadingSpinner, $button) {
    // Show loading spinner, update button text
    $loadingSpinner.removeClass('hidden');
    const buttonText = $button.text();
    $button.text(' Summarizing...');
    $button.prepend($loadingSpinner);
    $button.prop('disabled', true);

    // Extract comments
    const comments = extractComments();

    if (comments.length === 0) {
        // Handle no comments case
        finishLoading($loadingSpinner, $button, buttonText);
        alert('No comments found on this page.');
        return;
    }

    // Update the comment count
    $('.comment-summary-count').text(`${comments.length} comments analyzed`);

    // Get the summary content element
    const $summaryContentElement = $('.comment-summary-content');
    $summaryContentElement.text("Generating summary...");

    // Show the summary container
    $summaryContainer.removeClass('hidden');

    // Generate summary using OpenAI API
    generateSummary(comments).then(summary => {
        // Update the summary content
        $summaryContentElement.text(summary);

        // Finish loading
        finishLoading($loadingSpinner, $button, buttonText);
    }).catch(error => {
        console.error('Error generating summary:', error);

        let errorMessage = "Error generating summary. ";

        if (error.message.includes('API key')) {
            errorMessage += "Please set your OpenAI API key in the extension options.";
            // Add options page link
            const optionsUrl = chrome.runtime.getURL("options.html");
            $summaryContentElement.html(`${errorMessage} <a href="${optionsUrl}" target="_blank">Open options</a>`);
        } else if (error.message.includes('API request failed')) {
            errorMessage += "There was a problem with the OpenAI API: " + error.message;
            $summaryContentElement.text(errorMessage);
        } else {
            $summaryContentElement.text(errorMessage + (error.message || "Please try again."));
        }

        finishLoading($loadingSpinner, $button, buttonText);
    });
}

// Helper function to reset button state after loading
function finishLoading($loadingSpinner, $button, originalText) {
    $loadingSpinner.addClass('hidden');
    $button.text(originalText || 'Summarize Comments');
    $button.prepend($loadingSpinner);
    $button.prop('disabled', false);
}

// Function to extract comments using jQuery
function extractComments() {
    const comments = [];

    try {
        $('.Comment__text').each(function() {
            const commentText = $(this).text().trim();
            const commentContainer = $(this).closest('.Comment');
            let rating = "No rating";

            if (commentContainer.length > 0) {
                const ratingElement = commentContainer.find('.CommentRating__value');
                if (ratingElement.length > 0) {
                    rating = ratingElement.text().trim();
                }
            }

            if (commentText) {
                comments.push({
                    text: commentText,
                    rating: rating
                });
            }
        });
    } catch (error) {
        console.error('Error extracting comments:', error);
    }

    return comments;
}

// Function to generate a summary using OpenAI API
function generateSummary(comments) {
    return new Promise((resolve, reject) => {
        // Check if MyShowsPrompts is available
        if (!window.MyShowsPrompts) {
            reject(new Error('Prompts not loaded. Please refresh the page.'));
            return;
        }

        // Get API key and settings from storage
        chrome.storage.sync.get(
            {
                openaiApiKey: '',
                selectedModel: 'gpt-4o',
                summaryLanguage: 'english',
                temperature: 0.7,
                maxTokens: 600
            },
            function(items) {
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
                    return `Comment ${index + 1}: ${c.text.substring(0, 300)} ${c.text.length > 300 ? '...' : ''}
Rating: ${c.rating}`;
                }).join('\n\n');

                // Get system prompt
                const systemMessage = window.MyShowsPrompts.systemPrompts.default;

                // Get base user prompt
                let userMessage = window.MyShowsPrompts.userPrompts.default(commentTexts, language);

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
                            { role: 'system', content: systemMessage },
                            { role: 'user', content: userMessage }
                        ],
                        temperature: temperature,
                        max_tokens: maxTokens
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
}

// Use jQuery's document.ready
$(document).ready(function() {
    // Check if MyShowsPrompts is loaded
    if (window.MyShowsPrompts) {
        addSummarizeButton();
    } else {
        console.warn("MyShowsPrompts not found. Will wait for it to load.");
        // Wait a bit for prompts.js to load (in case it's loading asynchronously)
        setTimeout(function() {
            if (window.MyShowsPrompts) {
                addSummarizeButton();
            } else {
                console.error("Prompts still not loaded. Using fallback.");
                // Create a minimal fallback implementation
                window.MyShowsPrompts = {
                    systemPrompts: {
                        default: `Summarize these TV show comments concisely.`
                    },
                    userPrompts: {
                        default: function(comments, language) {
                            const languageInstruction = language && language !== 'english'
                                ? `Respond in ${language}.`
                                : '';
                            return `Summarize these comments: ${comments}\n${languageInstruction}`;
                        }
                    }
                };
                addSummarizeButton();
            }
        }, 500);
    }
});
