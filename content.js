console.debug("MyShows Comment Summarizer content script is starting...");

// ---- Configuration ----
// Wait time before even trying to add the button (let frameworks initialize)
const INITIAL_DELAY = 2000;  // 2 seconds 

// Time to observe the page for stability before adding button
const STABILITY_WAIT_TIME = 1000; // 1 second

// What we consider a "stable" page (no DOM changes for this duration)
const STABILITY_THRESHOLD = 500; // 0.5 seconds

// ---- State tracking ----
let buttonAdded = false;
let stabilityObserver = null;
let lastDomChangeTime = 0;
let stabilityTimer = null;
let addButtonTimer = null;
let selectedPromptType = 'default'; // Track the selected prompt type

// ---- Main Functions ----

// Wait for DOM to settle down before adding button
function waitForStableDom() {
    console.debug("Waiting for DOM to stabilize...");

    // Clear any existing timers
    if (stabilityTimer) clearTimeout(stabilityTimer);
    if (addButtonTimer) clearTimeout(addButtonTimer);

    // Record the current time as the last DOM change time
    lastDomChangeTime = Date.now();

    // Stop any existing observer
    if (stabilityObserver) {
        stabilityObserver.disconnect();
    }

    // Create a new MutationObserver to detect when DOM changes stop happening
    stabilityObserver = new MutationObserver(() => {
        // Update the last time the DOM changed
        lastDomChangeTime = Date.now();

        // Clear any pending timer
        if (stabilityTimer) {
            clearTimeout(stabilityTimer);
        }

        // Set a new timer to check for stability
        stabilityTimer = setTimeout(checkDomStability, STABILITY_WAIT_TIME);
    });

    // Start observing the entire document for any changes
    stabilityObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true
    });

    // Set initial timer to check for stability
    stabilityTimer = setTimeout(checkDomStability, STABILITY_WAIT_TIME);
}

// Check if the DOM has been stable long enough
function checkDomStability() {
    const currentTime = Date.now();
    const timeSinceLastChange = currentTime - lastDomChangeTime;

    if (timeSinceLastChange >= STABILITY_THRESHOLD) {
        console.debug(`DOM appears stable (no changes for ${timeSinceLastChange}ms)`);

        // Stop observing
        if (stabilityObserver) {
            stabilityObserver.disconnect();
            stabilityObserver = null;
        }

        // Add our button
        tryAddButton();
    } else {
        console.debug(`DOM still changing (${timeSinceLastChange}ms since last change)`);

        // Keep checking
        stabilityTimer = setTimeout(checkDomStability, STABILITY_WAIT_TIME);
    }
}

// Check if comments are loaded
function areCommentsLoaded() {
    // Check if there are any comments on the page
    const commentElements = document.querySelectorAll('.Comment__text');
    return commentElements.length > 0;
}

// Check if "Show Comments" button exists
function hasShowCommentsButton() {
    // Find the "Show Comments" button
    const showButton = document.querySelector('.Episode-commentsShow');
    return !!showButton;
}

// Get the display name for the selected prompt type
function getPromptDisplayName(promptType) {
    if (!window.MyShowsPrompts || !window.MyShowsPrompts.promptTypes) {
        return 'Summarize Comments';
    }

    const prompt = window.MyShowsPrompts.promptTypes.find(p => p.id === promptType);
    return prompt ? prompt.name : 'Summarize Comments';
}

// Function that actually adds our button
function tryAddButton() {
    if (buttonAdded) {
        console.debug("Button already added, skipping");
        return;
    }

    // Check if comments section exists
    const commentsSection = document.getElementById('comments');
    if (!commentsSection) {
        console.debug("Comments section not found, will try again later");
        // Schedule another attempt
        setTimeout(tryAddButton, 1000);
        return;
    }

    // Check if comments are already loaded
    const commentsLoaded = areCommentsLoaded();
    const hasShowButton = hasShowCommentsButton();

    // If comments aren't loaded and there's a "Show Comments" button,
    // we'll observe for when it's clicked instead of showing our button immediately
    if (!commentsLoaded && hasShowButton) {
        console.debug("Comments not loaded yet, waiting for 'Show Comments' button to be clicked");

        // Set up an observer to watch for when comments are loaded
        setupCommentsLoadObserver();
        return;
    }

    console.debug("Found comments section, adding button...");

    // Get API key and proceed
    chrome.storage.sync.get({openaiApiKey: ''}, function (items) {
        // Create the container for our elements
        const container = document.createElement('div');
        container.id = 'comment-summarizer-container';
        container.style.cssText = 'padding-left: 20px; margin-bottom: 15px;';

        if (!items.openaiApiKey) {
            // No API key - show setup prompt
            container.innerHTML = `
                <button class="summarize-button" id="open-api-settings" style="
                    align-items: center;
                    background: transparent;
                    border: 0;
                    box-shadow: none;
                    color: #3ec1ff;
                    cursor: pointer;
                    display: inline-flex;
                    font-size: 16px;
                    justify-content: center;
                    line-height: 24px;
                    padding: 0;
                    text-align: left;
                    -webkit-font-smoothing: auto;
                    margin: 10px 0;
                ">
                    <span style="margin-right: 6px; display: inline-flex;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-13a1 1 0 0 0-1 1v5a1 1 0 0 0 2 0V8a1 1 0 0 0-1-1zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" fill="currentColor"/>
                        </svg>
                    </span>
                    Set up OpenAI API key for Comment Summarizer
                </button>
            `;

            // Insert container right before comments section
            commentsSection.parentNode.insertBefore(container, commentsSection);

            // Add click event after insertion
            document.getElementById('open-api-settings').addEventListener('click', function (e) {
                e.preventDefault();
                alert('Please click on the extension icon in the toolbar to set up your OpenAI API key.');
            });
        } else {
            // API key exists - show summarize button with prompt selector
            const currentPromptName = getPromptDisplayName(selectedPromptType);

            container.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px; margin: 10px 0;">
                    <button class="summarize-button" id="summarize-button" style="
                        align-items: center;
                        background: transparent;
                        border: 0;
                        box-shadow: none;
                        color: #3ec1ff;
                        cursor: pointer;
                        display: inline-flex;
                        font-size: 16px;
                        justify-content: center;
                        line-height: 24px;
                        padding: 0;
                        text-align: left;
                        -webkit-font-smoothing: auto;
                    ">
                        <span id="button-icon" style="
                            margin-right: 6px;
                            display: inline-flex;
                        ">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M4 5h16v2H4V5zm0 6h16v2H4v-2zm0 6h16v2H4v-2z" fill="currentColor"/>
                            </svg>
                        </span>
                        <span id="loading-spinner" style="
                            display: none;
                            width: 16px;
                            height: 16px;
                            border: 2px solid rgba(62, 193, 255, 0.2);
                            border-radius: 50%;
                            border-top-color: #3ec1ff;
                            animation: spin 1s ease-in-out infinite;
                            margin-right: 8px;
                        "></span>
                        <span id="button-text">${currentPromptName}</span>
                    </button>
                    
                    <div style="position: relative;">
                        <button id="prompt-selector-button" style="
                            background: transparent;
                            border: none;
                            color: #3ec1ff;
                            cursor: pointer;
                            padding: 2px;
                            font-size: 12px;
                            display: inline-flex;
                            align-items: center;
                            justify-content: center;
                        ">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M7 10l5 5 5-5z" fill="currentColor"/>
                            </svg>
                        </button>
                        
                        <div id="prompt-dropdown" style="
                            display: none;
                            position: absolute;
                            top: 100%;
                            left: 0;
                            background: #2a2a2a;
                            border: 1px solid #444;
                            border-radius: 4px;
                            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                            z-index: 1000;
                            min-width: 180px;
                            margin-top: 2px;
                        ">
                            <div id="prompt-options"></div>
                        </div>
                    </div>
                </div>
                
                <div id="summary-container" style="
                    display: none;
                    background-color: #474747;
                    border-radius: 8px;
                    padding: 15px;
                    margin: 10px 20px 20px 0;
                    color: #e8e8e8;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h3 style="font-size: 16px; font-weight: bold; margin: 0;">AI Generated Content</h3>
                        <span id="comment-count" style="color: #ccc; font-size: 14px;"></span>
                    </div>
                    <div id="summary-content" style="line-height: 1.5; white-space: pre-line;"></div>
                </div>
            `;

            // Insert container right before comments section
            commentsSection.parentNode.insertBefore(container, commentsSection);

            // Add spin animation style
            const styleElement = document.createElement('style');
            styleElement.textContent = `
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(styleElement);

            // Set up prompt selector
            setupPromptSelector();

            // Add click event after insertion
            document.getElementById('summarize-button').addEventListener('click', handleSummarizeClick);
        }

        buttonAdded = true;
        console.debug("Button successfully added to page");

        // Set up a periodic check to make sure our button stays there
        setInterval(checkButtonExists, 2000);
    });
}

// Set up the prompt selector dropdown
function setupPromptSelector() {
    const selectorButton = document.getElementById('prompt-selector-button');
    const dropdown = document.getElementById('prompt-dropdown');
    const optionsContainer = document.getElementById('prompt-options');

    if (!selectorButton || !dropdown || !optionsContainer) {
        console.error("Prompt selector elements not found");
        return;
    }

    // Populate dropdown options
    function populateOptions() {
        if (!window.MyShowsPrompts || !window.MyShowsPrompts.promptTypes) {
            console.warn("MyShowsPrompts not available, using default options");
            optionsContainer.innerHTML = `
                <div class="prompt-option" data-prompt="default" style="
                    padding: 8px 12px;
                    cursor: pointer;
                    border-bottom: 1px solid #444;
                    color: #e8e8e8;
                    font-size: 14px;
                ">Summarize Comments</div>
            `;
            return;
        }

        optionsContainer.innerHTML = window.MyShowsPrompts.promptTypes.map(prompt => `
            <div class="prompt-option" data-prompt="${prompt.id}" style="
                padding: 8px 12px;
                cursor: pointer;
                border-bottom: 1px solid #444;
                color: #e8e8e8;
                font-size: 14px;
                ${prompt.id === selectedPromptType ? 'background-color: #3ec1ff; color: #000;' : ''}
            ">${prompt.name}</div>
        `).join('');

        // Remove border from last option
        const options = optionsContainer.querySelectorAll('.prompt-option');
        if (options.length > 0) {
            options[options.length - 1].style.borderBottom = 'none';
        }
    }

    // Add hover effects and click handlers
    function setupOptionHandlers() {
        const options = optionsContainer.querySelectorAll('.prompt-option');

        options.forEach(option => {
            // Hover effects
            option.addEventListener('mouseenter', function () {
                if (this.dataset.prompt !== selectedPromptType) {
                    this.style.backgroundColor = '#444';
                }
            });

            option.addEventListener('mouseleave', function () {
                if (this.dataset.prompt !== selectedPromptType) {
                    this.style.backgroundColor = 'transparent';
                }
            });

            // Click handler
            option.addEventListener('click', function () {
                const newPromptType = this.dataset.prompt;
                const promptChanged = newPromptType !== selectedPromptType;

                selectedPromptType = newPromptType;

                // Update button text
                const buttonText = document.getElementById('button-text');
                if (buttonText) {
                    buttonText.textContent = getPromptDisplayName(selectedPromptType);
                }

                // Update option styling
                options.forEach(opt => {
                    if (opt.dataset.prompt === selectedPromptType) {
                        opt.style.backgroundColor = '#3ec1ff';
                        opt.style.color = '#000';
                    } else {
                        opt.style.backgroundColor = 'transparent';
                        opt.style.color = '#e8e8e8';
                    }
                });

                // Hide dropdown
                dropdown.style.display = 'none';

                // Trigger summarization if prompt changed
                if (promptChanged) {
                    handleSummarizeClick();
                }
            });
        });
    }

    // Toggle dropdown
    selectorButton.addEventListener('click', function (e) {
        e.stopPropagation();

        if (dropdown.style.display === 'none' || dropdown.style.display === '') {
            populateOptions();
            setupOptionHandlers();
            dropdown.style.display = 'block';
        } else {
            dropdown.style.display = 'none';
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function (e) {
        if (!dropdown.contains(e.target) && !selectorButton.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

// Set up observer to wait for comments to be loaded
function setupCommentsLoadObserver() {
    console.debug("Setting up observer for comment loading");

    // Find the "Show Comments" button
    const showButton = document.querySelector('.Episode-commentsShow');

    if (showButton) {
        // Add click listener to detect when the button is clicked
        showButton.addEventListener('click', function () {
            console.debug("'Show Comments' button clicked, waiting for comments to load");

            // Set up an observer to watch for when comments appear
            const commentsObserver = new MutationObserver(function (mutations) {
                if (areCommentsLoaded()) {
                    console.debug("Comments have been loaded");
                    commentsObserver.disconnect();

                    // Wait a bit for the comments to fully render
                    setTimeout(function () {
                        buttonAdded = false;
                        tryAddButton();
                    }, 1000);
                }
            });

            commentsObserver.observe(document.documentElement, {
                childList: true,
                subtree: true
            });

            // Set a timeout to stop watching if comments never load
            setTimeout(function () {
                commentsObserver.disconnect();
            }, 10000);
        });

        console.debug("Added listener to 'Show Comments' button");
    } else {
        console.debug("Could not find 'Show Comments' button");

        // If we can't find the show button but still have a comments section,
        // let's periodically check if comments get loaded
        const checkInterval = setInterval(function () {
            if (areCommentsLoaded()) {
                console.debug("Comments have been loaded");
                clearInterval(checkInterval);
                buttonAdded = false;
                tryAddButton();
            }
        }, 1000);

        // Stop checking after 30 seconds
        setTimeout(function () {
            clearInterval(checkInterval);
        }, 30000);
    }
}

// Check if our button still exists and re-add if needed
function checkButtonExists() {
    if (!buttonAdded) return;

    const container = document.getElementById('comment-summarizer-container');
    const commentsSection = document.getElementById('comments');

    if (!container && commentsSection) {
        console.debug("Button container was removed, re-adding");
        buttonAdded = false;
        tryAddButton();
    }
}

// Handle summarize button click
function handleSummarizeClick() {
    console.debug("Summarize button clicked with prompt type:", selectedPromptType);

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
    const comments = extractComments();

    if (comments.length === 0) {
        // Handle no comments case
        spinner.style.display = 'none';
        buttonText.textContent = getPromptDisplayName(selectedPromptType);
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
    generateSummary(comments, selectedPromptType).then(summary => {
        // Update summary content
        summaryContent.textContent = summary;

        // Reset button
        spinner.style.display = 'none';
        buttonText.textContent = getPromptDisplayName(selectedPromptType);
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
        buttonText.textContent = getPromptDisplayName(selectedPromptType);
        button.disabled = false;
    });
}

// Function to extract comments
function extractComments() {
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
}

// Function to generate a summary using OpenAI API
function generateSummary(comments, promptType = 'default') {
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
                    return `Comment ${index + 1}: ${c.text.substring(0, 300)} ${c.text.length > 300 ? '...' : ''}
Rating: ${c.rating}`;
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

// ---- Initialization ----

// Wait for the specified initial delay before even attempting to add the button
console.debug(`Waiting ${INITIAL_DELAY}ms for page to initialize...`);
setTimeout(waitForStableDom, INITIAL_DELAY);

// Handle page changes (e.g., SPA navigation)
let lastUrl = location.href;
new MutationObserver(() => {
    // Check if URL has changed (SPA navigation)
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
        console.debug(`URL changed from ${lastUrl} to ${currentUrl}`);
        lastUrl = currentUrl;

        // Reset state
        buttonAdded = false;

        // Wait again for the DOM to stabilize
        setTimeout(waitForStableDom, INITIAL_DELAY);
    }
}).observe(document, {subtree: true, childList: true});

console.debug("MyShows Comment Summarizer content script finished executing");