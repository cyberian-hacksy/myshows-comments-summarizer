// Model descriptions
const modelDescriptions = {
    'gpt-4o': 'Fast, intelligent, flexible GPT model',
    'gpt-4.1': 'Smartest model for complex tasks',
    'gpt-5': 'Most advanced model for complex tasks',
    'gpt-4o-mini': 'Fast, affordable small model for focused tasks',
    'gpt-4.1-mini': 'Affordable model balancing speed and intelligence',
    'gpt-4.1-nano': 'Fastest, most cost-effective model for low-latency tasks',
    'gpt-5-mini': 'Compact GPT-5 model for fast, affordable tasks',
    'gpt-5-nano': 'Smallest GPT-5 model for ultra-low latency tasks',
    'o4-mini': 'Faster, more affordable reasoning model'
};

// Load languages from languages.json
let languagesData = {};
let languagesList = [];

function loadLanguages() {
    fetch('languages.json')
        .then(response => response.json())
        .then(data => {
            languagesData = data;

            // Create a list of languages with their codes and names
            const langCodes = Object.keys(languagesData.lang);
            languagesList = langCodes.map(code => {
                return {
                    code: code,
                    name: languagesData.lang[code][0],
                    nativeName: languagesData.lang[code][1]
                };
            });

            // Sort languages by name
            languagesList.sort((a, b) => a.name.localeCompare(b.name));

            // Populate the language dropdown
            populateLanguageDropdown(languagesList);
        })
        .catch(error => {
            console.error('Error loading languages:', error);
        });
}

// Populate language dropdown with all languages
function populateLanguageDropdown(languages) {
    const optionsContainer = document.getElementById('language-options');
    optionsContainer.innerHTML = '';

    languages.forEach(lang => {
        const option = document.createElement('div');
        option.className = 'dropdown-option';
        option.dataset.value = lang.name.toLowerCase();
        option.textContent = `${lang.name} (${lang.nativeName})`;

        // Make option focusable and accessible
        option.setAttribute('tabindex', '0');
        option.setAttribute('role', 'option');

        // Mark as selected if it matches the current selection
        if (selectedLanguage && lang.name.toLowerCase() === selectedLanguage) {
            option.classList.add('selected');
            option.setAttribute('aria-selected', 'true');
            document.getElementById('selected-language').textContent = `${lang.name} (${lang.nativeName})`;
        } else {
            option.setAttribute('aria-selected', 'false');
        }

        // Add click handler
        option.addEventListener('click', function() {
            selectLanguage(this);
        });

        optionsContainer.appendChild(option);
    });

    // Set ARIA attributes on the options container
    optionsContainer.setAttribute('role', 'listbox');
    optionsContainer.setAttribute('aria-label', 'Languages');
}

// Function to handle language selection
function selectLanguage(optionElement) {
    // Update selected language
    selectedLanguage = optionElement.dataset.value;

    // Update display
    document.getElementById('selected-language').textContent = optionElement.textContent;

    // Update selected class and ARIA attributes
    const optionsContainer = document.getElementById('language-options');
    const options = optionsContainer.querySelectorAll('.dropdown-option');
    options.forEach(opt => {
        opt.classList.remove('selected');
        opt.setAttribute('aria-selected', 'false');
    });
    optionElement.classList.add('selected');
    optionElement.setAttribute('aria-selected', 'true');

    // Hide dropdown
    document.getElementById('dropdown-menu').style.display = 'none';
    document.getElementById('selected-language').setAttribute('aria-expanded', 'false');
}

// Filter languages based on search input
function filterLanguages(searchText) {
    if (!searchText) {
        return languagesList;
    }

    searchText = searchText.toLowerCase();
    return languagesList.filter(lang => 
        lang.name.toLowerCase().includes(searchText) || 
        lang.nativeName.toLowerCase().includes(searchText) ||
        lang.code.toLowerCase().includes(searchText)
    );
}

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
function saveOptions(successMessage = 'Settings saved.') {
    const apiKey = document.getElementById('openai-api-key').value;
    const model = document.getElementById('model-selection').value;

    // The selectedLanguage variable is already updated when an option is clicked
    const language = selectedLanguage;

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
            status.textContent = successMessage;
            status.className = 'status success';
            setTimeout(function() {
                status.textContent = '';
                status.className = 'status';
            }, 2000);
        }
    );
}

// Store for the selected language
let selectedLanguage = 'english';

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
            selectedLanguage = items.summaryLanguage;

            // The selected language will be displayed when the dropdown is populated
            // We don't need to do anything here as populateLanguageDropdown will handle it

            document.getElementById('temperature-slider').value = items.temperature;
            document.getElementById('max-tokens').value = items.maxTokens;
            updateModelDescription(); // Update description for saved model
            updateTemperatureValue(); // Update temperature display
        }
    );
}

// Set up dropdown toggle and search functionality
function setupDropdown() {
    const dropdownSelected = document.getElementById('selected-language');
    const dropdownMenu = document.getElementById('dropdown-menu');
    const searchInput = document.getElementById('language-search');
    const optionsContainer = document.getElementById('language-options');

    // Make dropdown accessible
    dropdownSelected.setAttribute('tabindex', '0');
    dropdownSelected.setAttribute('role', 'combobox');
    dropdownSelected.setAttribute('aria-expanded', 'false');
    dropdownSelected.setAttribute('aria-controls', 'dropdown-menu');

    // Toggle dropdown when clicking on the selected item
    dropdownSelected.addEventListener('click', function() {
        toggleDropdown();
    });

    // Toggle with keyboard
    dropdownSelected.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault();
            toggleDropdown(true);
        }
    });

    // Function to toggle dropdown
    function toggleDropdown(open) {
        const isOpen = open !== undefined ? open : dropdownMenu.style.display !== 'block';

        dropdownMenu.style.display = isOpen ? 'block' : 'none';
        dropdownSelected.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

        if (isOpen) {
            searchInput.focus(); // Focus the search input
        }
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!dropdownSelected.contains(e.target) && !dropdownMenu.contains(e.target)) {
            toggleDropdown(false);
        }
    });

    // Set up language search functionality
    searchInput.addEventListener('input', function() {
        const filteredLanguages = filterLanguages(this.value);
        populateLanguageDropdown(filteredLanguages);
    });

    // Prevent dropdown from closing when clicking on search input
    searchInput.addEventListener('click', function(e) {
        e.stopPropagation();
    });

    // Keyboard navigation within dropdown
    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            toggleDropdown(false);
            dropdownSelected.focus();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const firstOption = optionsContainer.querySelector('.dropdown-option');
            if (firstOption) {
                firstOption.focus();
            }
        }
    });

    // Add keyboard navigation to options
    optionsContainer.addEventListener('keydown', function(e) {
        const options = Array.from(optionsContainer.querySelectorAll('.dropdown-option'));
        const currentIndex = options.indexOf(document.activeElement);

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (currentIndex < options.length - 1) {
                options[currentIndex + 1].focus();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (currentIndex > 0) {
                options[currentIndex - 1].focus();
            } else {
                searchInput.focus();
            }
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (document.activeElement.classList.contains('dropdown-option')) {
                selectLanguage(document.activeElement);
            }
        } else if (e.key === 'Escape') {
            toggleDropdown(false);
            dropdownSelected.focus();
        }
    });
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // First restore options to set selectedLanguage
    restoreOptions();

    // Then load languages and populate dropdown
    loadLanguages();

    // Set up dropdown functionality
    setupDropdown();

    // Update other UI elements
    updateModelDescription();
    updateTemperatureValue();
});

document.getElementById('save-button').addEventListener('click', () => saveOptions('Settings saved.'));
document.getElementById('model-selection').addEventListener('change', updateModelDescription);
document.getElementById('temperature-slider').addEventListener('input', updateTemperatureValue);
