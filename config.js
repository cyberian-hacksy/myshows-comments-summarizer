// config.js - Configuration variables and state tracking for the extension

(function() {
    // Make config available globally
    window.MyShowsConfig = window.MyShowsConfig || {};
    
    // ---- Configuration ----
    // Wait time before even trying to add the button (let frameworks initialize)
    MyShowsConfig.INITIAL_DELAY = 2000;  // 2 seconds
    
    // Time to observe the page for stability before adding button
    MyShowsConfig.STABILITY_WAIT_TIME = 1000; // 1 second
    
    // What we consider a "stable" page (no DOM changes for this duration)
    MyShowsConfig.STABILITY_THRESHOLD = 500; // 0.5 seconds
    
    // ---- State tracking ----
    MyShowsConfig.buttonAdded = false;
    MyShowsConfig.isAddingButton = false;
    MyShowsConfig.buttonCheckInterval = null;
    MyShowsConfig.stabilityObserver = null;
    MyShowsConfig.lastDomChangeTime = 0;
    MyShowsConfig.stabilityTimer = null;
    MyShowsConfig.addButtonTimer = null;
    MyShowsConfig.selectedPromptType = 'default'; // Track the selected prompt type
    
    console.debug("MyShows Comment Summarizer config loaded");
})();