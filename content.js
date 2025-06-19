// content.js - Main entry point for the extension

(function () {
    console.debug("MyShows Comment Summarizer content script is starting...");

    // Prevent multiple script executions
    if (window.myShowsCommentSummarizerLoaded) {
        console.debug("Script already loaded, preventing duplicate execution");
        return;
    }
    window.myShowsCommentSummarizerLoaded = true;

    // Add cleanup on page unload
    window.addEventListener('beforeunload', () => {
        console.debug("Page unloading, cleaning up");
        window.myShowsCommentSummarizerLoaded = false;
    });

    // Initialize the extension
    function initializeExtension() {
        // Wait for the specified initial delay before even attempting to add the button
        console.debug(`Waiting ${MyShowsConfig.INITIAL_DELAY}ms for page to initialize...`);
        setTimeout(MyShowsUI.waitForStableDom, MyShowsConfig.INITIAL_DELAY);
        
        // Initialize URL change detection
        MyShowsURLHandler.initURLChangeDetection();
    }

    // Wait for all modules to be loaded before initializing
    function checkModulesLoaded() {
        if (
            window.MyShowsConfig && 
            window.MyShowsDOMUtils && 
            window.MyShowsUI && 
            window.MyShowsPromptSelector && 
            window.MyShowsObserver && 
            window.MyShowsButtonManager && 
            window.MyShowsSummarizer && 
            window.MyShowsURLHandler
        ) {
            console.debug("All modules loaded, initializing extension");
            initializeExtension();
        } else {
            console.debug("Waiting for modules to load...");
            setTimeout(checkModulesLoaded, 50);
        }
    }

    // Start checking for modules
    checkModulesLoaded();

    console.debug("MyShows Comment Summarizer content script finished executing");
})();