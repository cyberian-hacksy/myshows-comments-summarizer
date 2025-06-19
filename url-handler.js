// url-handler.js - Functions for handling URL changes (e.g., SPA navigation)

(function() {
    // Make URL handler functions available globally
    window.MyShowsURLHandler = window.MyShowsURLHandler || {};
    
    // Initialize URL change detection
    MyShowsURLHandler.initURLChangeDetection = function() {
        // Handle page changes (e.g., SPA navigation)
        let lastUrl = location.href;
        let urlChangeTimeout;

        new MutationObserver(() => {
            // Check if URL has changed (SPA navigation)
            const currentUrl = location.href;
            if (currentUrl !== lastUrl) {
                console.debug(`URL changed from ${lastUrl} to ${currentUrl}`);
                lastUrl = currentUrl;

                // Clear any pending timeout
                if (urlChangeTimeout) {
                    clearTimeout(urlChangeTimeout);
                }

                // Reset state
                MyShowsConfig.buttonAdded = false;

                // Debounce the URL change handling
                urlChangeTimeout = setTimeout(() => {
                    console.debug("Processing URL change after debounce");
                    MyShowsUI.waitForStableDom();
                }, 500); // Wait 500ms for multiple rapid changes
            }
        }).observe(document, {subtree: true, childList: true});
    };
    
    console.debug("MyShows Comment Summarizer URL handler loaded");
})();