// --- DOM Elements ---
const chatForm = document.getElementById('ai-chat-form');
const messageInput = document.getElementById('ai-message-input');
const messagesContainer = document.getElementById('ai-chat-messages');
const sendButton = document.getElementById('send-button');
const modelSelector = document.getElementById('model-selector');
const fileInput = document.getElementById('file-input');
const attachFileLabel = document.getElementById('attach-file-label');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const removeImageBtn = document.getElementById('remove-image-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const historyBtn = document.getElementById('history-btn');
const historyPopup = document.getElementById('history-popup');
const historyList = document.getElementById('history-list');

// --- API Config ---
const openRouterApiKey = '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';
const googleApiKey = 'AIzaSyDXk7TafF8FB2DXUXtz2_5gTor6fh9BLDc';

const API_CONFIG = {
    openrouter: {
        url: 'https://openrouter.ai/api/v1/chat/completions',
        apiKey: openRouterApiKey
    },
    google: {
        apiKey: googleApiKey
    }
};

// --- State ---
let conversationHistory = [];
let selectedImageBase64 = null;
let chatSessions = [];
let currentSessionId = null;

// --- Functions ---

function addMessage(messageData, sender) {
    const { text, imageUrl } = messageData;
    const messageWrapper = document.createElement('div');
    const messageContent = document.createElement('div');
    
    messageWrapper.classList.add('flex', 'w-full', 'items-end', 'group');
    messageContent.classList.add('max-w-lg', 'px-4', 'py-3', 'rounded-2xl', 'shadow-sm');

    if (sender === 'user') {
        messageWrapper.classList.add('justify-end');
        messageContent.classList.add('bg-blue-500', 'text-white');
        
        if (imageUrl) {
            messageContent.innerHTML += `<img src="${imageUrl}" class="rounded-lg mb-2 max-w-xs">`;
        }
        if (text) {
            const textNode = document.createElement('p');
            textNode.textContent = text;
            messageContent.appendChild(textNode);
        }

    } else { // bot
        messageWrapper.classList.add('justify-start');
        messageContent.classList.add('bg-gray-200', 'text-gray-800', 'prose');
        
        if (text === 'typing_indicator') {
            messageContent.classList.remove('px-4', 'py-3');
            messageContent.innerHTML = `<div class="p-3"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;
        } else {
            messageContent.innerHTML = marked.parse(text);
        }
    }

    messageWrapper.appendChild(messageContent);
    messagesContainer.appendChild(messageWrapper);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showTypingIndicator() {
    addMessage({ text: 'typing_indicator' }, 'bot');
    const indicators = messagesContainer.querySelectorAll('.group');
    indicators[indicators.length-1].id = 'typing-indicator';
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
}

function clearImagePreview() {
    selectedImageBase64 = null;
    fileInput.value = '';
    imagePreviewContainer.classList.add('hidden');
}

function updateVisionCapability() {
    const selectedOption = modelSelector.options[modelSelector.selectedIndex];
    const hasVision = selectedOption.dataset.vision === 'true';
    attachFileLabel.style.display = hasVision ? 'flex' : 'none';
    if (!hasVision) {
        clearImagePreview();
    }
}

// --- Lịch sử Trò chuyện ---

function saveSessionsToStorage() {
    localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
}

function loadSessionsFromStorage() {
    const storedSessions = localStorage.getItem('chatSessions');
    chatSessions = storedSessions ? JSON.parse(storedSessions) : [];
}

function generateTitle(messages) {
    const firstUserMessage = messages.find(msg => msg.role === 'user');
    if (firstUserMessage) {
        // Lấy nội dung text từ mảng content
        const textContent = firstUserMessage.content.find(c => c.type === 'text');
        if (textContent) {
            return textContent.text.substring(0, 40) + (textContent.text.length > 40 ? '...' : '');
        }
    }
    return 'Trò chuyện mới';
}

function saveCurrentSession() {
    if (!currentSessionId || conversationHistory.length === 0) return;

    const sessionIndex = chatSessions.findIndex(s => s.id === currentSessionId);
    if (sessionIndex !== -1) {
        // Cập nhật session đã có
        chatSessions[sessionIndex].messages = conversationHistory;
    } else {
        // Tạo session mới
        const newSession = {
            id: currentSessionId,
            title: generateTitle(conversationHistory),
            messages: conversationHistory,
            model: modelSelector.value
        };
        chatSessions.unshift(newSession); // Thêm vào đầu mảng
    }
    saveSessionsToStorage();
    renderHistoryList();
}

function renderHistoryList() {
    historyList.innerHTML = '';
    if (chatSessions.length === 0) {
        historyList.innerHTML = '<li class="p-3 text-center text-sm text-gray-500">Không có lịch sử.</li>';
        return;
    }
    chatSessions.forEach(session => {
        const li = document.createElement('li');
        li.className = 'flex justify-between items-center p-3 hover:bg-gray-200 rounded-md cursor-pointer group';
        li.dataset.sessionId = session.id;

        const title = document.createElement('span');
        title.className = 'truncate text-sm';
        title.textContent = session.title;
        li.appendChild(title);

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
        deleteBtn.className = 'text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity';
        deleteBtn.title = 'Xóa cuộc trò chuyện';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteSession(session.id);
        };
        li.appendChild(deleteBtn);

        li.onclick = () => loadSession(session.id);
        historyList.appendChild(li);
    });
}

function loadSession(sessionId) {
    const session = chatSessions.find(s => s.id === sessionId);
    if (!session) return;
    
    saveCurrentSession(); // Lưu session hiện tại trước khi chuyển

    currentSessionId = session.id;
    conversationHistory = session.messages;
    modelSelector.value = session.model;

    messagesContainer.innerHTML = '';
    conversationHistory.forEach(msg => {
        // Xử lý định dạng cũ và mới của content
        let messageData = {};
        if (Array.isArray(msg.content)) {
            const textPart = msg.content.find(p => p.type === 'text');
            const imagePart = msg.content.find(p => p.type === 'image_url');
            messageData.text = textPart ? textPart.text : '';
            messageData.imageUrl = imagePart ? imagePart.image_url.url : null;
        } else {
            messageData.text = msg.content; // Định dạng cũ
        }
        addMessage(messageData, msg.role);
    });
    updateVisionCapability();
    historyPopup.classList.add('hidden');
}

function deleteSession(sessionId) {
    chatSessions = chatSessions.filter(s => s.id !== sessionId);
    saveSessionsToStorage();
    renderHistoryList();
    if (currentSessionId === sessionId) {
        startNewChat();
    }
}

function startNewChat() {
    saveCurrentSession(); // Lưu session cũ nếu có nội dung

    currentSessionId = crypto.randomUUID();
    conversationHistory = [];
    messagesContainer.innerHTML = '';
    
    clearImagePreview();
    updateVisionCapability();

    const selectedOption = modelSelector.options[modelSelector.selectedIndex];
    const modelDisplayName = selectedOption.text;
    const welcomeMessage = `Xin chào! Tôi là Minh AI được trang bị model ${modelDisplayName}. Bạn muốn hỏi tôi điều gì?`;
    addMessage({ text: welcomeMessage }, 'bot');
    // Không thêm welcome message vào history
}

// --- Event Listeners ---

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userText = messageInput.value.trim();
    if (!userText && !selectedImageBase64) return;

    const userMessageContent = [];
    if (userText) {
        userMessageContent.push({ type: 'text', text: userText });
    }
    if (selectedImageBase64) {
        userMessageContent.push({
            type: 'image_url',
            image_url: { url: selectedImageBase64 }
        });
    }
    
    addMessage({ text: userText, imageUrl: selectedImageBase64 }, 'user');
    conversationHistory.push({ role: 'user', content: userMessageContent });

    messageInput.value = '';
    clearImagePreview();
    sendButton.disabled = true;
    messageInput.disabled = true;

    showTypingIndicator();

    try {
        const selectedModel = modelSelector.value;
        let response;

        if (selectedModel.startsWith('google/gemini')) {
            const config = API_CONFIG.google;
            const modelName = selectedModel.split('/')[1];
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${config.apiKey}`;
            
            const contents = conversationHistory.map(msg => {
                const parts = [];
                if (Array.isArray(msg.content)) {
                    msg.content.forEach(item => {
                        if (item.type === 'text') {
                            parts.push({ text: item.text });
                        } else if (item.type === 'image_url' && item.image_url.url) {
                            parts.push({
                                inline_data: {
                                    mime_type: item.image_url.url.match(/^data:(image\/\w+);base64,/)[1],
                                    data: item.image_url.url.split(',')[1]
                                }
                            });
                        }
                    });
                } else {
                     parts.push({ text: msg.content });
                }
                return { role: msg.role === 'assistant' ? 'model' : 'user', parts };
            });

            response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents })
            });

            removeTypingIndicator();
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `Lỗi HTTP: ${response.status}`);
            }
            const data = await response.json();
            const botMessage = data.candidates[0]?.content?.parts[0]?.text;
            if (botMessage) {
                conversationHistory.push({ role: 'assistant', content: botMessage });
                addMessage({ text: botMessage }, 'bot');
                saveCurrentSession();
            } else {
                throw new Error('Không nhận được phản hồi hợp lệ từ bot.');
            }

        } else {
            const config = API_CONFIG.openrouter;
            response = await fetch(config.url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': window.location.href, 
                    'X-Title': 'Chatbot Vision',
                },
                body: JSON.stringify({
                    model: selectedModel,
                    messages: conversationHistory,
                }),
            });

            removeTypingIndicator();
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `Lỗi HTTP: ${response.status}`);
            }
            const data = await response.json();
            const botMessage = data.choices[0]?.message?.content;
            if (botMessage) {
                conversationHistory.push({ role: 'assistant', content: botMessage });
                addMessage({ text: botMessage }, 'bot');
                saveCurrentSession();
            } else {
                throw new Error('Không nhận được phản hồi hợp lệ từ bot.');
            }
        }

    } catch (error) {
        console.error('Lỗi khi gọi API:', error);
        removeTypingIndicator();
        
        let errorMessage = `**Lỗi:** ${error.message}.`;
        if (error.message.includes("Rate limit exceeded")) {
            errorMessage = `**Lỗi: Đã đạt giới hạn yêu cầu**

Bạn đã sử dụng hết lượt yêu cầu miễn phí trong ngày. Vui lòng [thêm tín dụng vào tài khoản OpenRouter của bạn](https://openrouter.ai/credits) để tiếp tục sử dụng.`;
        } else if (error.message.includes("No endpoints found") || error.message.includes("Provider returned error") || error.message.includes("is not a valid model ID")) {
            errorMessage += "\n\nModel này có thể đang gặp sự cố hoặc tạm thời quá tải. Vui lòng thử lại sau hoặc chọn một model khác.";
        } else {
            errorMessage += "\n\nVui lòng kiểm tra lại API key hoặc kết nối mạng và thử lại.";
        }
        addMessage({ text: errorMessage }, 'bot');

    } finally {
        sendButton.disabled = false;
        messageInput.disabled = false;
        messageInput.focus();
    }
});

modelSelector.addEventListener('change', startNewChat);

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
            selectedImageBase64 = event.target.result;
            imagePreview.src = selectedImageBase64;
            imagePreviewContainer.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
});

removeImageBtn.addEventListener('click', clearImagePreview);
newChatBtn.addEventListener('click', startNewChat);
historyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    historyPopup.classList.toggle('hidden');
});

// Đóng popup khi click ra ngoài
document.addEventListener('click', (e) => {
    if (!historyPopup.classList.contains('hidden') && !historyPopup.contains(e.target) && !historyBtn.contains(e.target)) {
        historyPopup.classList.add('hidden');
    }
});

// --- Initial Load ---
window.addEventListener('load', () => {
    loadSessionsFromStorage();
    renderHistoryList();
    startNewChat();
});
