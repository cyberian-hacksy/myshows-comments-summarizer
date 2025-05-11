// prompts.js - Contains all prompt templates for the extension
// This exposes a global MyShowsPrompts object that can be accessed by content.js

// Create MyShowsPrompts namespace to avoid conflicts
window.MyShowsPrompts = {};

// System prompts
MyShowsPrompts.systemPrompts = {
    // Default system prompt for comment summarization
    default: `You are an AI assistant that specializes in summarizing user comments from a TV show website. 
Please analyze these comments and provide a summary that covers:
1. The overall sentiment (positive, negative, or mixed)
2. The main themes or topics discussed
3. Any consensus on the episode quality
4. Any interesting points or contradictions in the comments
5. The general rating trend

Do not use markdown syntax.`
};

// User prompts (templates)
MyShowsPrompts.userPrompts = {
    // Default user prompt template for comment summarization
    default: function(comments, language) {
        const languageInstruction = language && language !== 'english'
            ? `Please provide the summary in ${language}.`
            : '';

        return `Here are ${comments.length} comments about an episode from a TV show. Please summarize the overall sentiment and key points:

${comments}

${languageInstruction}`;
    }
};
