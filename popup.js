// Model descriptions
const modelDescriptions = {
    'gpt-4o': 'Fast, intelligent, flexible GPT model',
    'gpt-4.1': 'Smartest model for complex tasks',
    'gpt-4o-mini': 'Fast, affordable small model for focused tasks',
    'gpt-4.1-mini': 'Affordable model balancing speed and intelligence',
    'gpt-4.1-nano': 'Fastest, most cost-effective model for low-latency tasks',
    'o4-mini': 'Faster, more affordable reasoning model'
};

// Update model description when selection changes
function updateModelDescription() {
    const modelSelect = document.getElementById('model-selection');
    const modelDescription = document.getElementById('model-description');

    const selectedModel = modelSelect.value;
    modelDescription.textContent = modelDescriptions[selectedModel] || '';
}

// Update temperature display value
function updateTemperatureValue() {
    const temperatureSlider = document.getElementById('temperature-slider');
    const temperatureValue = document.getElementById('temperature-value');
    temperatureValue.textContent = temperatureSlider.value;
}

// Save options to chrome.storage
function saveOptions() {
    const apiKey = document.getElementById('openai-api-key').value;
    const model = document.getElementById('model-selection').value;
    const language = document.getElementById('language-selection').value;
    const temperature = parseFloat(document.getElementById('temperature-slider').value);
    const maxTokens = parseInt(document.getElementById('max-tokens').value);

    chrome.storage.sync.set(
        {
            openaiApiKey: apiKey,
            selectedModel: model,
            summaryLanguage: language,
            temperature: temperature,
            maxTokens: maxTokens
        },
        function() {
            // Update status to let user know options were saved
            const status = document.getElementById('status');
            status.textContent = 'Settings saved.';
            status.className = 'status success';
            setTimeout(function() {
                status.textContent = '';
                status.className = 'status';
            }, 2000);
        }
    );
}

// Restore options from chrome.storage
function restoreOptions() {
    chrome.storage.sync.get(
        {
            openaiApiKey: '',
            selectedModel: 'gpt-4o', // Default to GPT-4o
            summaryLanguage: 'english', // Default to English
            temperature: 0.7,
            maxTokens: 600
        },
        function(items) {
            document.getElementById('openai-api-key').value = items.openaiApiKey;
            document.getElementById('model-selection').value = items.selectedModel;
            document.getElementById('language-selection').value = items.summaryLanguage;
            document.getElementById('temperature-slider').value = items.temperature;
            document.getElementById('max-tokens').value = items.maxTokens;
            updateModelDescription(); // Update description for saved model
            updateTemperatureValue(); // Update temperature display
        }
    );
}

// Event listeners
document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save-button').addEventListener('click', saveOptions);
document.getElementById('model-selection').addEventListener('change', updateModelDescription);
document.getElementById('temperature-slider').addEventListener('input', updateTemperatureValue);