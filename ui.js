// ui.js - Functions for creating and managing UI elements

(function() {
    // Make UI functions available globally
    window.MyShowsUI = window.MyShowsUI || {};
    
    // Function that actually adds our button
    MyShowsUI.tryAddButton = function() {
        if (MyShowsConfig.buttonAdded || MyShowsConfig.isAddingButton) {
            console.debug("Button already added or in progress, skipping");
            return;
        }

        // Clean up any existing elements first
        MyShowsDOMUtils.cleanupExistingElements();

        // Check if comments section exists
        const commentsSection = document.getElementById('comments');
        if (!commentsSection) {
            console.debug("Comments section not found, will try again later");
            // Schedule another attempt
            setTimeout(MyShowsUI.tryAddButton, 1000);
            return;
        }

        // Check if comments are already loaded
        const commentsLoaded = MyShowsDOMUtils.areCommentsLoaded();
        const hasShowButton = MyShowsDOMUtils.hasShowCommentsButton();

        // If comments aren't loaded and there's a "Show Comments" button,
        // we'll observe for when it's clicked instead of showing our button immediately
        if (!commentsLoaded && hasShowButton) {
            console.debug("Comments not loaded yet, waiting for 'Show Comments' button to be clicked");

            // Set up an observer to watch for when comments are loaded
            MyShowsObserver.setupCommentsLoadObserver();
            return;
        }

        console.debug("Found comments section, adding button...");

        MyShowsConfig.isAddingButton = true;

        // Get API key and proceed
        chrome.storage.sync.get({openaiApiKey: ''}, function (items) {
            // Create the container for our elements
            const container = document.createElement('div');
            container.id = 'comment-summarizer-container';
            container.style.cssText = 'padding-left: 20px; margin-bottom: 15px;';

            // Add a data attribute to mark it as ours
            container.setAttribute('data-comment-summarizer', 'true');

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
                const currentPromptName = MyShowsDOMUtils.getPromptDisplayName(MyShowsConfig.selectedPromptType);

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
                styleElement.setAttribute('data-comment-summarizer', 'true');
                styleElement.textContent = `
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `;
                document.head.appendChild(styleElement);

                // Set up prompt selector
                MyShowsPromptSelector.setupPromptSelector();

                // Add click event after insertion
                document.getElementById('summarize-button').addEventListener('click', MyShowsSummarizer.handleSummarizeClick);
            }

            MyShowsConfig.buttonAdded = true;
            MyShowsConfig.isAddingButton = false;
            console.debug("Button successfully added to page");

            // Set up a periodic check to make sure our button stays there
            if (MyShowsConfig.buttonCheckInterval) {
                clearInterval(MyShowsConfig.buttonCheckInterval);
            }
            MyShowsConfig.buttonCheckInterval = setInterval(MyShowsButtonManager.checkButtonExists, 2000);
        });
    };

    // Wait for DOM to settle down before adding button
    MyShowsUI.waitForStableDom = function() {
        console.debug("Waiting for DOM to stabilize...");

        // Clear any existing timers
        if (MyShowsConfig.stabilityTimer) clearTimeout(MyShowsConfig.stabilityTimer);
        if (MyShowsConfig.addButtonTimer) clearTimeout(MyShowsConfig.addButtonTimer);

        // Record the current time as the last DOM change time
        MyShowsConfig.lastDomChangeTime = Date.now();

        // Stop any existing observer
        if (MyShowsConfig.stabilityObserver) {
            MyShowsConfig.stabilityObserver.disconnect();
        }

        // Create a new MutationObserver to detect when DOM changes stop happening
        MyShowsConfig.stabilityObserver = new MutationObserver(() => {
            // Update the last time the DOM changed
            MyShowsConfig.lastDomChangeTime = Date.now();

            // Clear any pending timer
            if (MyShowsConfig.stabilityTimer) {
                clearTimeout(MyShowsConfig.stabilityTimer);
            }

            // Set a new timer to check for stability
            MyShowsConfig.stabilityTimer = setTimeout(MyShowsUI.checkDomStability, MyShowsConfig.STABILITY_WAIT_TIME);
        });

        // Start observing the entire document for any changes
        MyShowsConfig.stabilityObserver.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true
        });

        // Set initial timer to check for stability
        MyShowsConfig.stabilityTimer = setTimeout(MyShowsUI.checkDomStability, MyShowsConfig.STABILITY_WAIT_TIME);
    };

    // Check if the DOM has been stable long enough
    MyShowsUI.checkDomStability = function() {
        const currentTime = Date.now();
        const timeSinceLastChange = currentTime - MyShowsConfig.lastDomChangeTime;

        if (timeSinceLastChange >= MyShowsConfig.STABILITY_THRESHOLD) {
            console.debug(`DOM appears stable (no changes for ${timeSinceLastChange}ms)`);

            // Stop observing
            if (MyShowsConfig.stabilityObserver) {
                MyShowsConfig.stabilityObserver.disconnect();
                MyShowsConfig.stabilityObserver = null;
            }

            // Add our button
            MyShowsUI.tryAddButton();
        } else {
            console.debug(`DOM still changing (${timeSinceLastChange}ms since last change)`);

            // Keep checking
            MyShowsConfig.stabilityTimer = setTimeout(MyShowsUI.checkDomStability, MyShowsConfig.STABILITY_WAIT_TIME);
        }
    };
    
    console.debug("MyShows Comment Summarizer UI functions loaded");
})();