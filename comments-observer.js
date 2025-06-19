// comments-observer.js - Functions for observing when comments are loaded on the page

(function() {
    // Make observer functions available globally
    window.MyShowsObserver = window.MyShowsObserver || {};
    
    // Set up observer to wait for comments to be loaded
    MyShowsObserver.setupCommentsLoadObserver = function() {
        console.debug("Setting up observer for comment loading");

        // Find the "Show Comments" button
        const showButton = document.querySelector('.Episode-commentsShow');

        if (showButton) {
            // Add click listener to detect when the button is clicked
            showButton.addEventListener('click', function () {
                console.debug("'Show Comments' button clicked, waiting for comments to load");

                // Set up an observer to watch for when comments appear
                const commentsObserver = new MutationObserver(function (mutations) {
                    if (MyShowsDOMUtils.areCommentsLoaded()) {
                        console.debug("Comments have been loaded");
                        commentsObserver.disconnect();

                        // Wait a bit for the comments to fully render
                        setTimeout(function () {
                            MyShowsConfig.buttonAdded = false;
                            MyShowsUI.tryAddButton();
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
                if (MyShowsDOMUtils.areCommentsLoaded()) {
                    console.debug("Comments have been loaded");
                    clearInterval(checkInterval);
                    MyShowsConfig.buttonAdded = false;
                    MyShowsUI.tryAddButton();
                }
            }, 1000);

            // Stop checking after 30 seconds
            setTimeout(function () {
                clearInterval(checkInterval);
            }, 30000);
        }
    };
    
    console.debug("MyShows Comment Summarizer comments observer loaded");
})();