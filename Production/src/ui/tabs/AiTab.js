import { escapeHtml } from '../../utils/html.js';
import { saveData, loadData } from '../../infra/db.js';
// Removed marked import for simplicity - we'll implement simple markdown parsing or just use innerText

// Centralize the state for the AI Tab
export const state = {
    apiKey: '',
    provider: 'gemini', // 'gemini' or 'openai'
    model: 'gemini-2.5-flash', // default model
    chatHistory: [],
    isGenerating: false,
    systemPrompt: `You are an expert Android log parser and debugger, specializing in Digital Car Key (DCK), UWB, Bluetooth, and CCC (Car Connectivity Consortium) technologies.
Your task is to analyze the provided logs and answer the user's questions clearly & concisely.
Point out specific errors, warnings, or anomalies in the logs. Explain technical terms if necessary.`
};

let uiElements = {};

// Default models mapped by provider
const defaultModels = {
    gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229']
};

/**
 * Initialize the AI Tab UI and setup event listeners.
 */
export async function setupAiTab() {
    console.log('[AiTab] Setting up AI Tab...');

    // Check if the UI structure exists; if not, build it.
    const container = document.getElementById('aiTab');
    if (!container) {
        console.error('[AiTab] Container #aiTab not found in DOM.');
        return;
    }

    // Build the UI dynamically inside the container
    buildUI(container);

    // Cache DOM references
    uiElements = {
        settingsPanel: document.getElementById('aiSettingsPanel'),
        toggleSettingsBtn: document.getElementById('aiToggleSettingsBtn'),
        providerSelect: document.getElementById('aiProviderSelect'),
        modelSelect: document.getElementById('aiModelSelect'),
        apiKeyInput: document.getElementById('aiApiKeyInput'),
        saveSettingsBtn: document.getElementById('aiSaveSettingsBtn'),
        chatWindow: document.getElementById('aiChatWindow'),
        chatInput: document.getElementById('aiChatInput'),
        sendBtn: document.getElementById('aiSendBtn'),
        clearChatBtn: document.getElementById('aiClearChatBtn'),
        includeLogsCheckbox: document.getElementById('aiIncludeLogsCheckbox')
    };

    // Load persisted settings
    await loadSettings();

    // Attach Event Listeners
    attachEventListeners();

    // Render initial welcome message if history is empty
    if (state.chatHistory.length === 0) {
        addMessage('assistant', 'Hello! I am your AI log assistant. Please configure your API key in the settings above to start asking questions about the loaded logs.');
    } else {
        renderChatHistory();
    }
}

/**
 * Builds the structural HTML for the tab
 */
function buildUI(container) {
    container.innerHTML = `
        <div class="ai-layout" style="display: flex; flex-direction: column; height: 100%; max-height: calc(100vh - 120px); overflow: hidden;">
            <!-- Settings Header / Toolbar -->
            <div class="ai-header" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; border-bottom: 1px solid var(--border-color, #333); flex-shrink: 0;">
                <h3 style="margin: 0;">🤖 AI Log Assistant</h3>
                <div class="ai-header-controls" style="display: flex; align-items: center; gap: 10px;">
                    <label style="display: flex; align-items: center; gap: 5px; cursor: pointer; font-size: 0.9em; color: var(--text-muted, #aaa);">
                        <input type="checkbox" id="aiIncludeLogsCheckbox" checked>
                        <span>Include logs as context</span>
                    </label>
                    <button id="aiClearChatBtn" class="control-btn" title="Clear Chat History">🗑️ Clear Chat</button>
                    <button id="aiToggleSettingsBtn" class="control-btn" style="background: var(--accent-color, #36A2EB); color: white;" title="Toggle AI Settings">⚙️ Settings</button>
                </div>
            </div>

            <!-- Settings Panel (Collapsible) -->
            <div id="aiSettingsPanel" class="ai-settings-panel dashboard-card" style="display: none; margin: 15px; flex-shrink: 0; background-color: var(--secondary-bg, #2a2a2a);">
                <h4 style="margin-top:0;">API Configuration</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                    <div>
                        <label for="aiProviderSelect">AI Provider:</label>
                        <select id="aiProviderSelect" class="search-input" style="width: 100%; margin-top: 5px;">
                            <option value="gemini">Google Gemini</option>
                            <option value="openai">OpenAI</option>
                            <option value="anthropic">Anthropic (Claude)</option>
                        </select>
                    </div>
                    <div>
                        <label for="aiModelSelect">Model:</label>
                        <select id="aiModelSelect" class="search-input" style="width: 100%; margin-top: 5px;"></select>
                    </div>
                </div>
                <div style="margin-bottom: 15px;">
                    <label for="aiApiKeyInput">API Key:</label>
                    <input type="password" id="aiApiKeyInput" class="search-input" placeholder="Enter your API Key" style="width: 100%; margin-top: 5px;">
                    <small style="color: #888; display: block; margin-top: 5px;">Your key is stored locally in your browser and never sent anywhere other than the official API endpoint.</small>
                </div>
                <button id="aiSaveSettingsBtn" class="logcat-btn success">💾 Save Settings</button>
            </div>

            <!-- Chat Area -->
            <div class="ai-chat-container" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative;">
                <div id="aiChatWindow" class="ai-chat-window" style="flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 15px;">
                    <!-- Messages go here -->
                </div>
                
                <div class="ai-input-area" style="flex-shrink: 0; padding: 15px; border-top: 1px solid var(--border-color, #333); display: flex; flex-direction: column; gap: 10px; background: var(--main-bg, #1e1e1e);">
                    <div style="display: flex; gap: 10px; align-items: flex-end; width: 100%;">
                        <textarea id="aiChatInput" placeholder="Ask a question about the logs (e.g., 'Why did the digital key transaction fail?')" style="flex: 1; min-width: 0; resize: none; min-height: 44px; max-height: 150px; overflow-y: auto; font-family: inherit; line-height: 1.5; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color, #444); background: var(--secondary-bg, #2a2a2a); color: var(--text-color, #fff); box-sizing: border-box;"></textarea>
                        <button id="aiSendBtn" class="logcat-btn primary" style="width: auto; flex-shrink: 0; padding: 10px 20px; height: 44px; margin: 0; display: flex; align-items: center; justify-content: center; opacity: 0.7; pointer-events: none; transition: all 0.2s;" disabled>
                            ➤ Send
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Bind DOM events
 */
function attachEventListeners() {
    // Settings toggling
    uiElements.toggleSettingsBtn.addEventListener('click', () => {
        const panel = uiElements.settingsPanel;
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        if (panel.style.display === 'block') {
            uiElements.apiKeyInput.focus();
        }
    });

    // Provider change -> update model list
    uiElements.providerSelect.addEventListener('change', (e) => {
        state.provider = e.target.value;
        populateModelList();
    });

    // Save settings
    uiElements.saveSettingsBtn.addEventListener('click', async () => {
        state.apiKey = uiElements.apiKeyInput.value.trim();
        state.provider = uiElements.providerSelect.value;
        state.model = uiElements.modelSelect.value;

        await saveData('aiSettings', {
            apiKey: state.apiKey,
            provider: state.provider,
            model: state.model
        });

        // Flash green
        const originalText = uiElements.saveSettingsBtn.textContent;
        uiElements.saveSettingsBtn.textContent = '✅ Saved';
        uiElements.saveSettingsBtn.style.backgroundColor = '#1e7e34'; // darker green
        setTimeout(() => {
            uiElements.saveSettingsBtn.textContent = originalText;
            uiElements.saveSettingsBtn.style.backgroundColor = '';
            uiElements.settingsPanel.style.display = 'none'; // Auto close
        }, 1500);

        validateInputState();
    });

    // Chat input handling
    uiElements.chatInput.addEventListener('input', () => {
        // Auto-resize textarea
        uiElements.chatInput.style.height = 'auto';
        uiElements.chatInput.style.height = (uiElements.chatInput.scrollHeight) + 'px';
        validateInputState();
    });

    // Handle Enter key (without shift)
    uiElements.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!uiElements.sendBtn.disabled) {
                handleSend();
            }
        }
    });

    uiElements.sendBtn.addEventListener('click', handleSend);

    // Clear Chat
    uiElements.clearChatBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear the chat history?')) {
            state.chatHistory = [];
            uiElements.chatWindow.innerHTML = '';
            await saveData('aiChatHistory', []);
            addMessage('assistant', 'Chat history cleared. How can I help you?');
        }
    });
}

/**
 * Validates if the send button should be enabled
 */
function validateInputState() {
    const text = uiElements.chatInput.value.trim();
    const hasKey = !!state.apiKey;
    const canSend = text && hasKey && !state.isGenerating;

    uiElements.sendBtn.disabled = !canSend;
    if (canSend) {
        uiElements.sendBtn.style.opacity = '1';
        uiElements.sendBtn.style.pointerEvents = 'auto';
        uiElements.sendBtn.style.cursor = 'pointer';
    } else {
        uiElements.sendBtn.style.opacity = '0.5';
        uiElements.sendBtn.style.pointerEvents = 'none';
        uiElements.sendBtn.style.cursor = 'not-allowed';
    }
}

/**
 * Load settings from IndexedDB
 */
async function loadSettings() {
    try {
        const savedSettings = await loadData('aiSettings');
        if (savedSettings && savedSettings.value) {
            state.apiKey = savedSettings.value.apiKey || '';
            state.provider = savedSettings.value.provider || 'gemini';
            state.model = savedSettings.value.model || defaultModels[state.provider][0];
        }

        uiElements.apiKeyInput.value = state.apiKey;
        uiElements.providerSelect.value = state.provider;

        populateModelList();
        uiElements.modelSelect.value = state.model; // Set after population

        // Load chat history
        const savedHistory = await loadData('aiChatHistory');
        if (savedHistory && savedHistory.value && Array.isArray(savedHistory.value)) {
            state.chatHistory = savedHistory.value;
        }

        validateInputState();
    } catch (e) {
        console.error('[AiTab] Error loading settings:', e);
    }
}

/**
 * Update the model dropdown based on the selected provider
 */
function populateModelList() {
    const models = defaultModels[state.provider];
    uiElements.modelSelect.innerHTML = '';
    models.forEach(model => {
        const opt = document.createElement('option');
        opt.value = model;
        opt.textContent = model;
        uiElements.modelSelect.appendChild(opt);
    });
    // Reset state to first option just in case
    state.model = models[0];
}

/**
 * Super simple markdown parser for bold, italic, code blocks
 */
function simpleMarkdown(text) {
    if (!text) return '';

    // First escape HTML
    let html = escapeHtml(text);

    // Replace code blocks: ```lang ... ```
    html = html.replace(/```(.*?)\n([\s\S]*?)```/g, '<pre style="background: var(--code-bg, #1e1e1e); padding: 10px; border-radius: 5px; overflow-x: auto; margin: 10px 0;"><code class="language-$1">$2</code></pre>');

    // Replace inline code: `code`
    html = html.replace(/`([^`]+)`/g, '<code style="background: var(--code-bg, #1e1e1e); padding: 2px 4px; border-radius: 3px; font-family: monospace;">$1</code>');

    // Replace bold: **bold**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Replace italic: *italic*
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Replace newlines with <br> inside regular text (but not inside <pre>)
    // A bit hacky but works for simple chat
    const parts = html.split(/(<pre[\s\S]*?<\/pre>)/);
    for (let i = 0; i < parts.length; i++) {
        if (!parts[i].startsWith('<pre')) {
            parts[i] = parts[i].replace(/\n/g, '<br>');
        }
    }

    return parts.join('');
}

/**
 * Adds a message to the UI and state
 */
function addMessage(role, content, save = true) {
    if (save) {
        state.chatHistory.push({ role, content });
        // Save to DB (don't await to not block UI)
        saveData('aiChatHistory', state.chatHistory).catch(console.error);
    }

    const msgDiv = document.createElement('div');
    msgDiv.className = `ai-message ${role}`;
    msgDiv.style.display = 'flex';
    msgDiv.style.flexDirection = 'column';
    msgDiv.style.marginBottom = '10px';

    let htmlContent = '';

    if (role === 'assistant') {
        htmlContent = simpleMarkdown(content);
    } else {
        htmlContent = '<div style="white-space: pre-wrap;">' + escapeHtml(content) + '</div>';
    }

    msgDiv.innerHTML = `
        <div class="ai-message-content" style="${getBubbleStyle(role)}">
            ${role === 'assistant' ? '<div style="font-size: 0.8em; color: #888; margin-bottom: 5px; font-weight: bold;">🤖 AI Assistant</div>' : ''}
            ${htmlContent}
        </div>
    `;

    uiElements.chatWindow.appendChild(msgDiv);
    scrollToBottom();
}

/**
 * Inline styles for chat bubbles
 */
function getBubbleStyle(role) {
    const baseStyle = 'padding: 12px 16px; border-radius: 12px; max-width: 85%; line-height: 1.5; font-size: 0.95em; word-wrap: break-word;';
    if (role === 'user') {
        return baseStyle + 'background-color: var(--accent-color, #1976D2); color: #fff; align-self: flex-end; border-bottom-right-radius: 2px; margin-left: auto;';
    } else {
        return baseStyle + 'background-color: var(--secondary-bg, #2d2d2d); color: var(--text-color, #e0e0e0); align-self: flex-start; border-bottom-left-radius: 2px; margin-right: auto; border: 1px solid var(--border-color, #444);';
    }
}

/**
 * Renders the entire chat history
 */
function renderChatHistory() {
    uiElements.chatWindow.innerHTML = '';
    state.chatHistory.forEach(msg => {
        addMessage(msg.role, msg.content, false); // false = don't save, it's already there
    });
    scrollToBottom();
}

function scrollToBottom() {
    // requestAnimationFrame ensures DOM has updated
    requestAnimationFrame(() => {
        uiElements.chatWindow.scrollTop = uiElements.chatWindow.scrollHeight;
    });
}

/**
 * Send the message to the AI API
 */
async function handleSend() {
    const question = uiElements.chatInput.value.trim();
    if (!question || state.isGenerating) return;

    // 1. UI updates: Add user message, clear input, disable send
    addMessage('user', question);
    uiElements.chatInput.value = '';
    uiElements.chatInput.style.height = 'auto'; // Reset height
    state.isGenerating = true;
    validateInputState();

    // Add a loading indicator
    const loadingId = 'ai-loading-' + Date.now();
    const loadingDiv = document.createElement('div');
    loadingDiv.id = loadingId;
    loadingDiv.className = 'ai-message assistant';
    loadingDiv.style.display = 'flex';
    loadingDiv.style.flexDirection = 'column';
    loadingDiv.innerHTML = `< div class="ai-message-content" style = "${getBubbleStyle('assistant')}" > <span class="ai-pulse" style="animation: pulse 1.5s infinite;">Processing logs...</span></div > `;
    uiElements.chatWindow.appendChild(loadingDiv);
    scrollToBottom();

    try {
        // 2. Gather Context
        let contextText = "";
        if (uiElements.includeLogsCheckbox.checked) {
            contextText = gatherLogContext();
        }

        // 3. Make API Call
        const responseText = await callAiApi(question, contextText);

        // 4. Remove loading, add response
        document.getElementById(loadingId)?.remove();
        addMessage('assistant', responseText);

    } catch (error) {
        console.error('[AiTab] API Error:', error);
        document.getElementById(loadingId)?.remove();
        addMessage('assistant', `❌ ** Error:** ${error.message || 'Failed to get response from AI.'} `);
    } finally {
        state.isGenerating = false;
        validateInputState();
        uiElements.chatInput.focus();
    }
}

/**
 * Gathers active logs to use as context for the AI.
 * Need to be careful to not exceed token limits (e.g. max ~128k for gemini flash, ~8k-128k for gpt)
 */
function gatherLogContext() {
    console.log('[AiTab] Gathering log context...');

    // Access global variables exposed from main_v2.js
    const dckLogs = window.filteredDckLogLines || window.originalLogLines?.filter(l => l.isDck) || [];
    const cccMessages = window.cccMessages || [];

    // We can't send millions of lines. Cap it.
    const MAX_DCK_LINES = 500;
    const MAX_CCC_LINES = 200;

    let contextStr = "";

    if (dckLogs.length > 0) {
        contextStr += `\n-- - Target DCK Logs(Last ${Math.min(dckLogs.length, MAX_DCK_LINES)})-- -\n`;
        // Grab the most recent ones if there are too many
        const startIndex = Math.max(0, dckLogs.length - MAX_DCK_LINES);
        const slicedDck = dckLogs.slice(startIndex);

        slicedDck.forEach(line => {
            // Send original text, truncate line if insanely long
            if (line && line.originalText) {
                // Shorten timestamp to save tokens
                const tsStr = line.timestamp ? `[${line.timestamp.toTimeString().split(' ')[0]}]` : '';
                const tagStr = line.tag ? line.tag.substring(0, 15) : 'Sys';
                const text = line.originalText.length > 500 ? line.originalText.substring(0, 500) + '...' : line.originalText;
                contextStr += `${tsStr} ${line.level || 'I'}/${tagStr}: ${text}\n`;
            }
        });
    }

    if (cccMessages.length > 0) {
        contextStr += `\n--- CCC Decoded Messages (Last ${Math.min(cccMessages.length, MAX_CCC_LINES)}) ---\n`;
        const startCcc = Math.max(0, cccMessages.length - MAX_CCC_LINES);
        const slicedCcc = cccMessages.slice(startCcc);

        slicedCcc.forEach(msg => {
            contextStr += `[CCC] MsgType: ${msg.messageType}, Endpoint: ${msg.endpointName}\n`;
            if (msg.payloadHex) contextStr += `Payload: ${msg.payloadHex}\n`;
            if (msg.error) contextStr += `Error: ${msg.error}\n`;
        });
    }

    if (contextStr === "") {
        contextStr = "No DCK or CCC logs currently loaded or filtered.";
    } else {
        contextStr = "==== ACTIVE LOG CONTEXT ====\\n" + contextStr;
    }

    return contextStr;
}

/**
 * Unified API Caller
 */
async function callAiApi(question, logContext) {
    if (state.provider === 'openai') {
        return callOpenAiApi(question, logContext);
    } else if (state.provider === 'gemini') {
        return callGeminiApi(question, logContext);
    } else if (state.provider === 'anthropic') {
        return callAnthropicApi(question, logContext);
    } else {
        throw new Error('Unknown AI provider selected.');
    }
}

/**
 * OpenAI Chat Completions API
 */
async function callOpenAiApi(question, logContext) {
    const url = 'https://api.openai.com/v1/chat/completions';

    // Construct messages array
    const messages = [
        { role: 'system', content: state.systemPrompt }
    ];

    // Add previous history (limit to last 10 messages to save context)
    const recentHistory = state.chatHistory.slice(-10).map(m => ({
        role: m.role,
        content: m.content
    }));
    messages.push(...recentHistory);

    // Add current question + context
    let finalUserContent = question;
    if (logContext) {
        finalUserContent = `${logContext}\n\nUser Question: ${question}`;
    }
    messages.push({ role: 'user', content: finalUserContent });

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state.apiKey}`
        },
        body: JSON.stringify({
            model: state.model,
            messages: messages,
            temperature: 0.2 // Lower temp for factual log analysis
        })
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

/**
 * Google Gemini Generate Content API
 */
async function callGeminiApi(question, logContext) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${state.model}:generateContent?key=${state.apiKey}`;

    // Gemini format
    const contents = [];

    // Add history
    const recentHistory = state.chatHistory.slice(-10);
    recentHistory.forEach(msg => {
        contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        });
    });

    // Add current question + context
    let finalUserText = question;
    if (logContext) {
        finalUserText = `${logContext}\n\nUser Question: ${question}`;
    }

    contents.push({
        role: 'user',
        parts: [{ text: finalUserText }]
    });

    const requestBody = {
        contents: contents,
        systemInstruction: {
            role: 'system',
            parts: [{ text: state.systemPrompt }]
        },
        generationConfig: {
            temperature: 0.2
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts) {
        const parts = data.candidates[0].content.parts;
        let finalStr = '';
        parts.forEach(p => finalStr += p.text);
        return finalStr;
    }

    throw new Error('No content returned from Gemini.');
}

/**
 * Anthropic Messages API
 */
async function callAnthropicApi(question, logContext) {
    const url = 'https://api.anthropic.com/v1/messages';

    // Construct messages array
    const messages = [];

    // Add previous history
    const recentHistory = state.chatHistory.slice(-10).map(m => ({
        role: m.role,
        content: m.content
    }));
    messages.push(...recentHistory);

    // Add current question + context
    let finalUserContent = question;
    if (logContext) {
        finalUserContent = `${logContext}\n\nUser Question: ${question}`;
    }
    messages.push({ role: 'user', content: finalUserContent });

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': state.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
            model: state.model,
            system: state.systemPrompt,
            messages: messages,
            max_tokens: 4096,
            temperature: 0.2
        })
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text;
}
