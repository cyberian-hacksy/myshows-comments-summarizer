// button-manager.js - Functions for checking if the button exists and handling duplicates

(function() {
    // Make button manager functions available globally
    window.MyShowsButtonManager = window.MyShowsButtonManager || {};
    
    // Check if our button still exists and handle duplicates
    MyShowsButtonManager.checkButtonExists = function() {
        const containers = document.querySelectorAll('#comment-summarizer-container');
        const commentsSection = document.getElementById('comments');

        if (containers.length === 0 && commentsSection && MyShowsConfig.buttonAdded) {
            // Button was removed, re-add it
            console.debug("Button container was removed, re-adding");
            MyShowsConfig.buttonAdded = false;
            MyShowsUI.tryAddButton();
        } else if (containers.length > 1) {
            // Multiple containers found, remove all but the first
            console.debug(`Found ${containers.length} containers, removing duplicates`);
            for (let i = 1; i < containers.length; i++) {
                containers[i].remove();
            }
        }
    };
    
    console.debug("MyShows Comment Summarizer button manager loaded");
})();