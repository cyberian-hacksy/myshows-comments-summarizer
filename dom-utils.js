// dom-utils.js - Utility functions for DOM manipulation and checking

(function() {
    // Make utilities available globally
    window.MyShowsDOMUtils = window.MyShowsDOMUtils || {};
    
    // Cleanup function to remove any existing instances
    MyShowsDOMUtils.cleanupExistingElements = function() {
        const existingContainers = document.querySelectorAll('#comment-summarizer-container');
        existingContainers.forEach(container => {
            console.debug("Removing existing container");
            container.remove();
        });

        // Also remove any orphaned styles
        const existingStyles = document.querySelectorAll('style[data-comment-summarizer]');
        existingStyles.forEach(style => style.remove());
    };

    // Check if comments are loaded
    MyShowsDOMUtils.areCommentsLoaded = function() {
        // Check if there are any comments on the page
        const commentElements = document.querySelectorAll('.Comment__text');
        return commentElements.length > 0;
    };

    // Check if "Show Comments" button exists
    MyShowsDOMUtils.hasShowCommentsButton = function() {
        // Find the "Show Comments" button
        const showButton = document.querySelector('.Episode-commentsShow');
        return !!showButton;
    };

    // Get the display name for the selected prompt type
    MyShowsDOMUtils.getPromptDisplayName = function(promptType) {
        if (!window.MyShowsPrompts || !window.MyShowsPrompts.promptTypes) {
            return 'Summarize Comments';
        }

        const prompt = window.MyShowsPrompts.promptTypes.find(p => p.id === promptType);
        return prompt ? prompt.name : 'Summarize Comments';
    };
    
    console.debug("MyShows Comment Summarizer DOM utilities loaded");
})();