// prompts.js - Contains all prompt templates for the extension
// This exposes a global MyShowsPrompts object that can be accessed by content.js

// Create MyShowsPrompts namespace to avoid conflicts
window.MyShowsPrompts = {};

// Prompt types - used for dropdown selection
MyShowsPrompts.promptTypes = [
    {id: 'default', name: 'Summarize Comments'},
    {id: 'topComments', name: 'Top Comments'},
    {id: 'criticAnalysis', name: 'Critic Analysis'},
    {id: 'episodeRating', name: 'Episode Rating'}
];

// Single system prompt
MyShowsPrompts.systemPrompt = "You are an AI assistant that specializes in analyzing user comments from a TV show website.";

// Helper function to build common template structure
function buildPromptTemplate(specificInstructions, comments, language) {
    return `${specificInstructions}

Do not use markdown syntax.

Here are ${comments.length} comments about an episode from a TV show:

${comments}

Please provide the response in ${language || 'english'}.`;
}

// User prompts (templates)
MyShowsPrompts.userPrompts = {
    // Default user prompt template for comment summarization
    default: function(comments, language) {
        const specificInstructions = `Please analyze these comments and provide a summary that covers:
1. The overall sentiment (positive, negative, or mixed)
2. The main themes or topics discussed
3. Any consensus on the episode quality
4. Any interesting points or contradictions in the comments
5. The general comments trend`;

        return buildPromptTemplate(specificInstructions, comments, language);
    },

    // Top comments user prompt
    topComments: function(comments, language) {
        const specificInstructions = `Please analyze these comments and provide:
1. An exact quotation of the 10-20 top rated comments
2. Include the comment's rating
3. Focus on comments that provide unique perspectives or detailed analysis
4. Highlight any particularly funny or entertaining comments
5. Include a very brief overall sentiment summary at the end`;

        return buildPromptTemplate(specificInstructions, comments, language);
    },

    // Critic analysis user prompt
    criticAnalysis: function(comments, language) {
        const specificInstructions = `Please analyze these comments as a professional critic would and provide:
1. A thoughtful analysis of the episode based on viewer comments
2. Comparison to critical consensus (if apparent from comments)
3. Analysis of the episode's strengths and weaknesses mentioned
4. Context about how this episode fits into the show's narrative (if mentioned)
5. A final verdict summarizing the viewer reception`;

        return buildPromptTemplate(specificInstructions, comments, language);
    },

    // Episode rating user prompt
    episodeRating: function(comments, language) {
        const specificInstructions = `Please analyze these comments and provide:
1. The average rating based on numeric scores in comments
2. The distribution of ratings (how many high vs. low scores)
3. Key reasons for high ratings
4. Key reasons for low ratings
5. A final verdict on whether the episode was generally well-received`;

        return buildPromptTemplate(specificInstructions, comments, language);
    }
};