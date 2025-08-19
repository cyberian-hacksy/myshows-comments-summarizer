// prompt-selector.js - Functions for setting up and managing the prompt selector dropdown

(function() {
    // Make prompt selector functions available globally
    window.MyShowsPromptSelector = window.MyShowsPromptSelector || {};

    // Keep track of the document click handler so we don't attach duplicates
    let documentClickHandler = null;

    // Set up the prompt selector dropdown
    MyShowsPromptSelector.setupPromptSelector = function() {
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
                ${prompt.id === MyShowsConfig.selectedPromptType ? 'background-color: #3ec1ff; color: #000;' : ''}
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
                    if (this.dataset.prompt !== MyShowsConfig.selectedPromptType) {
                        this.style.backgroundColor = '#444';
                    }
                });

                option.addEventListener('mouseleave', function () {
                    if (this.dataset.prompt !== MyShowsConfig.selectedPromptType) {
                        this.style.backgroundColor = 'transparent';
                    }
                });

                // Click handler
                option.addEventListener('click', function () {
                    const newPromptType = this.dataset.prompt;
                    const promptChanged = newPromptType !== MyShowsConfig.selectedPromptType;

                    MyShowsConfig.selectedPromptType = newPromptType;

                    // Update button text
                    const buttonText = document.getElementById('button-text');
                    if (buttonText) {
                        buttonText.textContent = MyShowsDOMUtils.getPromptDisplayName(MyShowsConfig.selectedPromptType);
                    }

                    // Update option styling
                    options.forEach(opt => {
                        if (opt.dataset.prompt === MyShowsConfig.selectedPromptType) {
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
                        MyShowsSummarizer.handleSummarizeClick();
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

        // Close dropdown when clicking outside. Remove previous handler if any to
        // avoid stacking multiple listeners when the UI is re-rendered.
        if (documentClickHandler) {
            document.removeEventListener('click', documentClickHandler);
        }

        documentClickHandler = function (e) {
            if (!dropdown.contains(e.target) && !selectorButton.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        };

        document.addEventListener('click', documentClickHandler);
    };
    
    console.debug("MyShows Comment Summarizer prompt selector loaded");
})();