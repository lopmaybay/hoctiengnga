// --- Application Logic ---
function mainApp() {
    // Biến mới để theo dõi thời gian gọi API
    let lastApiCallTime = 0; 

    // Global variables for Firebase (MANDATORY)
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

    let auth;
    let db;
    let userId = null;
    let isAuthReady = false;

    // Initialize Firebase
    if (Object.keys(firebaseConfig).length > 0 && typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();

        // Listen for auth state changes
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                userId = user.uid;
            } else {
                try {
                    if (initialAuthToken) {
                        await auth.signInWithCustomToken(initialAuthToken);
                    } else {
                        await auth.signInAnonymously();
                    }
                    userId = auth.currentUser?.uid || crypto.randomUUID();
                } catch (error) {
                    console.error("Firebase authentication error:", error);
                }
            }
            isAuthReady = true;
        });
    } else {
        console.warn("Firebase config not found or Firebase library not loaded. Firebase services will not be available.");
        isAuthReady = true;
        userId = crypto.randomUUID();
    }

    // Lấy các phần tử DOM
    const textDisplay = document.getElementById('text-display');
    const stressMarkButton = document.getElementById('stress-mark-button');
    const explainTextButton = document.getElementById('explain-text-button');
    const lookupModalOverlay = document.getElementById('lookup-modal');
    const modalContentInner = document.getElementById('modal-content-inner');
    const selectedWordModalSpan = document.getElementById('selected-word-modal');
    const vtudienLink = document.getElementById('vtudien-link');
    const youglishLink = document.getElementById('youglish-link');
    const wiktionaryLink = document.getElementById('wiktionary-link');
    const googleTranslateResultDiv = document.getElementById('google-translate-result');
    const translateLoadingSpinner = document.getElementById('translate-loading-spinner');
    const aiCustomInput = document.getElementById('ai-custom-input');
    const aiGenerateCustomButton = document.getElementById('ai-generate-custom-button');
    const loadingSpinner = document.getElementById('loading-spinner');
    const aiResultsSection = document.getElementById('ai-results-section');
    const aiTextContentDiv = document.getElementById('ai-text-content');
    const explanationSection = document.getElementById('explanation-section');
    const explanationContentDiv = document.getElementById('explanation-content');
    const explanationLoadingSpinner = document.getElementById('explanation-loading-spinner');
    const stressedTextSection = document.getElementById('stressed-text-section');
    const stressedContentDiv = document.getElementById('stressed-content');
    const stressedLoadingSpinner = document.getElementById('stressed-loading-spinner');
    const fileUploadInput = document.getElementById('file-upload');
    const fileNameSpan = document.getElementById('file-name');
    const selectionPopup = document.getElementById('selection-popup');
    const copySelectionButton = document.getElementById('copy-selection-button');
    const translateSelectionButton = document.getElementById('translate-selection-button');
    const selectionTranslateResultDiv = document.getElementById('selection-translate-result');
    const selectionTranslateSpinner = document.getElementById('selection-translate-spinner');
    const webUrlInput = document.getElementById('web-url-input');
    const fetchUrlButton = document.getElementById('fetch-url-button');
    const closeLookupModalBtn = document.getElementById('close-lookup-modal');
    const closeSelectionPopupBtn = document.getElementById('close-selection-popup');
    const textInputArea = document.getElementById('text-input-area');
    const processTextButton = document.getElementById('process-text-button');
    
    // Lấy các phần tử cài đặt API
    const geminiApiKeyInput = document.getElementById('gemini-api-key');
    const geminiModelInput = document.getElementById('gemini-model-name');
    const apiDelaySelect = document.getElementById('api-delay-select');

    // Lấy các phần tử Dịch Toàn Bộ
    const fullTranslationButton = document.getElementById('translate-full-text-button');
    const fullTranslationSection = document.getElementById('full-translation-section');
    const fullTranslationContentDiv = document.getElementById('full-translation-content');
    const fullTranslationLoadingSpinner = document.getElementById('full-translation-loading-spinner');

    // TTS Controls
    const ttsPlayPauseBtn = document.getElementById('tts-play-pause');
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');
    const playPauseText = document.getElementById('play-pause-text');
    const ttsStopBtn = document.getElementById('tts-stop');
    const ttsVoiceSelect = document.getElementById('tts-voice');
    const ttsRateSlider = document.getElementById('tts-rate');
    const ttsRateLabel = document.getElementById('tts-rate-label');
    const ttsProgressContainer = document.getElementById('tts-progress-container');
    const ttsProgressBar = document.getElementById('tts-progress-bar');
    const autoPronounceCheckbox = document.getElementById('auto-pronounce-checkbox');
    // MỚI: Nút phát âm trong Modal
    const modalPronounceButton = document.getElementById('modal-pronounce-button');

    // Biến trạng thái
    let currentRawText = '';
    let justEndedDrag = false;
    let voices = [];
    let speechStartIndex = 0;

    // Hàm fetch với cơ chế throttle (hãm)
    async function throttledFetch(url, options) {
        const selectedDelay = parseInt(apiDelaySelect.value, 10) * 1000;
        
        if (selectedDelay === 0) {
            return fetch(url, options);
        }

        const now = Date.now();
        const timeSinceLastCall = now - lastApiCallTime;
        const waitTime = (timeSinceLastCall < selectedDelay) ? (selectedDelay - timeSinceLastCall) : 0;
        
        lastApiCallTime = now + waitTime;

        if (waitTime > 0) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        return fetch(url, options);
    }

    function makeDraggable(element) {
        let isDragging = false;
        let initialMouseX, initialMouseY, initialElementLeft, initialElementTop;

        element.addEventListener("mousedown", dragStart);

        function dragStart(e) {
            if (e.target.closest('a, button, .close-button')) return;
            isDragging = true;
            element.style.cursor = 'grabbing';
            element.style.zIndex = 1001;
            const rect = element.getBoundingClientRect();
            initialElementLeft = rect.left;
            initialElementTop = rect.top;
            initialMouseX = e.clientX;
            initialMouseY = e.clientY;
            e.preventDefault();
            e.stopPropagation();
            justEndedDrag = false;
        }

        document.addEventListener("mousemove", (e) => {
            if (isDragging) {
                e.preventDefault();
                const dx = e.clientX - initialMouseX;
                const dy = e.clientY - initialMouseY;
                element.style.left = `${initialElementLeft + dx}px`;
                element.style.top = `${initialElementTop + dy}px`;
            }
        });

        document.addEventListener("mouseup", () => {
            if (isDragging) {
                isDragging = false;
                element.style.cursor = 'grab';
                element.style.zIndex = 1000;
                justEndedDrag = true;
                setTimeout(() => { justEndedDrag = false; }, 100);
            }
        });
    }

    function addClickableSpansTo(element) {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
        let node;
        const nodesToProcess = [];
        while (node = walker.nextNode()) {
            nodesToProcess.push(node);
        }

        nodesToProcess.forEach(textNode => {
            if (/[\u0400-\u04FF]/.test(textNode.nodeValue)) {
                const parent = textNode.parentNode;
                const parts = textNode.nodeValue.split(/([\u0400-\u04FF]+[\u0301]?)/g);
                
                const fragment = document.createDocumentFragment();
                parts.forEach(part => {
                    if (part.match(/[\u0400-\u04FF]/)) {
                        const span = document.createElement('span');
                        span.textContent = part;
                        span.className = 'word-clickable';
                        span.addEventListener('click', (event) => {
                            event.stopPropagation();
                            selectionPopup.classList.add('hidden');
                            const wordForLookup = part.replace(/[\u0301]/g, '');
                            openLookupModal(wordForLookup, event);
                            aiCustomInput.value = wordForLookup; // Populate the input field
                        });
                        fragment.appendChild(span);
                    } else {
                        fragment.appendChild(document.createTextNode(part));
                    }
                });
                parent.replaceChild(fragment, textNode);
            }
        });
    }

    function processNewContent(htmlContent, isHtml = false) {
        speechSynthesis.cancel();
        if (isHtml) {
            textDisplay.innerHTML = htmlContent;
            addClickableSpansTo(textDisplay);
            currentRawText = textDisplay.innerText;
        } else {
            currentRawText = htmlContent;
            textDisplay.innerHTML = '';
            const parts = currentRawText.split(/([\u0400-\u04FF]+[\u0301]?|[.,!?;:()"\s\n])/g);
            parts.forEach(part => {
                if (part.match(/[\u0400-\u04FF]/)) {
                    const span = document.createElement('span');
                    span.textContent = part;
                    span.className = 'word-clickable';
                    span.addEventListener('click', (event) => {
                        event.stopPropagation();
                        selectionPopup.classList.add('hidden');
                        const wordForLookup = part.replace(/[\u0301]/g, '');
                        openLookupModal(wordForLookup, event);
                        aiCustomInput.value = wordForLookup;
                    });
                    textDisplay.appendChild(span);
                } else {
                    textDisplay.appendChild(document.createTextNode(part));
                }
            });
        }

        [aiResultsSection, explanationSection, stressedTextSection, lookupModalOverlay, selectionPopup, fullTranslationSection].forEach(el => el.classList.add('hidden'));
    }

    async function getTranslation(word) {
        translateLoadingSpinner.style.display = 'block';
        selectionTranslateSpinner.style.display = 'block';
        
        const apiKey = geminiApiKeyInput.value.trim();
        const modelName = (geminiModelInput.value.trim() || 'gemini-2.5-flash-lite').replace(':generateContent', '');

        if (!apiKey) {
            translateLoadingSpinner.style.display = 'none';
            selectionTranslateSpinner.style.display = 'none';
            alert("Vui lòng nhập Gemini API Key của bạn trong phần Cài đặt.");
            return `Lỗi: Chưa nhập API Key.`;
        }

        try {
            const prompt = `Dịch từ tiếng Nga "${word}" sang tiếng Việt.
Chỉ trả về nghĩa tiếng Việt, không thêm bất kỳ văn bản giải thích nào khác.`;
            const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "text/plain" } };
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            
            const response = await throttledFetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

            if (!response.ok) throw new Error(`API error: ${response.status}`);
            const result = await response.json();
            if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
                return result.candidates[0].content.parts[0].text.trim();
            }
            throw new Error("Unexpected AI response structure");
        } catch (error) {
            console.error("Error calling AI for translation:", error);
            return `Lỗi dịch.`;
        } finally {
            translateLoadingSpinner.style.display = 'none';
            selectionTranslateSpinner.style.display = 'none';
        }
    }
    
    async function openLookupModal(word, event) {
        selectedWordModalSpan.textContent = word;
        
        // MỚI: Gán sự kiện click cho nút phát âm
        // Dùng .onclick để nó tự động ghi đè listener cũ mỗi khi mở modal
        modalPronounceButton.onclick = () => {
            pronounceWord(word);
        };

        const encodedWord = encodeURIComponent(word);
        vtudienLink.href = `https://vtudien.com/nga-viet/dictionary/nghia-cua-tu-${encodedWord}`;
        youglishLink.href = `https://youglish.com/pronounce/${encodedWord}/russian`;
        wiktionaryLink.href = `https://ru.wiktionary.org/wiki/${encodedWord}`;
        googleTranslateResultDiv.innerHTML = '';
        lookupModalOverlay.style.display = 'block';
        modalContentInner.style.visibility = 'hidden';
        
        const rect = event.target.getBoundingClientRect();
        const modalWidth = modalContentInner.offsetWidth;
        const modalHeight = modalContentInner.offsetHeight;
        const margin = 10;
        let top = rect.bottom + 5;
        let left = rect.left;
        if (left + modalWidth > window.innerWidth - margin) left = window.innerWidth - modalWidth - margin;
        if (left < margin) left = margin;
        if (top + modalHeight > window.innerHeight - margin) top = rect.top - modalHeight - 5;
        if (top < margin) top = margin;
        
        modalContentInner.style.left = `${left}px`;
        modalContentInner.style.top = `${top}px`;
        modalContentInner.style.visibility = 'visible';

        // SỬA ĐỔI: Tự động phát âm (gọi hàm mới)
        if (autoPronounceCheckbox.checked) {
            pronounceWord(word);
        }
        
        // Lấy bản dịch
        const translation = await getTranslation(word);
        googleTranslateResultDiv.innerHTML = `<strong>Dịch:</strong> ${translation}`;
    }

    makeDraggable(modalContentInner);
    makeDraggable(selectionPopup);

    document.addEventListener('mousedown', (event) => {
        if (justEndedDrag) return;

        const clickedInsideLookup = modalContentInner.contains(event.target);
        const clickedInsideSelection = selectionPopup.contains(event.target);
        const clickedOnWord = event.target.closest('.word-clickable');

        if (lookupModalOverlay.style.display === 'block' && !clickedInsideLookup && !clickedOnWord) {
            lookupModalOverlay.style.display = 'none';
        }
        
        if (!selectionPopup.classList.contains('hidden') && !clickedInsideSelection) {
            const selection = window.getSelection();
            if (selection.toString().length === 0) {
                selectionPopup.classList.add('hidden');
            }
        }
    });

    closeLookupModalBtn.addEventListener('click', () => {
        lookupModalOverlay.style.display = 'none';
    });

    closeSelectionPopupBtn.addEventListener('click', () => {
        selectionPopup.classList.add('hidden');
    });

    async function callAI(prompt, responseMimeType, responseSchema) {
        const apiKey = geminiApiKeyInput.value.trim();
        const modelName = (geminiModelInput.value.trim() || 'gemini-2.5-flash-lite').replace(':generateContent', '');

        if (!apiKey) {
            throw new Error("Vui lòng nhập Gemini API Key của bạn trong phần Cài đặt.");
        }
        
        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType }
        };
        if (responseSchema) {
            payload.generationConfig.responseSchema = responseSchema;
        }
        
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        
        const response = await throttledFetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        
        if (!response.ok) throw new Error(`API error: ${response.status} - ${await response.text()}`);
        const result = await response.json();
        if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
            return result.candidates[0].content.parts[0].text;
        }
        throw new Error("Unexpected AI response structure");
    }

    aiGenerateCustomButton.addEventListener('click', async () => {
        const word = aiCustomInput.value.trim();
        if (!word) {
            alert("Vui lòng nhập một từ hoặc cụm từ.");
            return;
        }
        loadingSpinner.style.display = 'block';
        aiResultsSection.classList.remove('hidden');
        aiTextContentDiv.innerHTML = '';
        aiGenerateCustomButton.disabled = true;
      
        try {
            const prompt = `Cho từ tiếng Nga "${word}", hãy tạo ra: 1. 10 câu ví dụ sử dụng từ này. 2. 20 từ liên quan, mỗi từ phải có dấu trọng âm và giải nghĩa ngắn gọn bằng tiếng Việt. Trả về kết quả dưới dạng JSON theo cấu trúc sau: {"sentences": ["câu 1", ...], "related_words": [{"word": "từ 1 có trọng âm", "meaning": "nghĩa tiếng Việt 1"}, ...]}`;
      
            const schema = {
                type: "OBJECT",
                properties: {
                    "sentences": { "type": "ARRAY", "items": { "type": "STRING" } },
                    "related_words": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "word": { "type": "STRING" },
                                "meaning": { "type": "STRING" }
                            },
                            "required": ["word", "meaning"]
                        }
                    }
                }
            };
            
            const jsonString = await callAI(prompt, "application/json", schema);
            const parsedJson = JSON.parse(jsonString);
            
            const sentences = Array.isArray(parsedJson.sentences) ? parsedJson.sentences : [];
            const relatedWords = Array.isArray(parsedJson.related_words) ? parsedJson.related_words : [];

            let htmlContent = '<h4 class="text-lg font-semibold mb-2">Câu ví dụ:</h4><ul class="list-disc list-inside space-y-1">';
            if (sentences.length > 0) {
                sentences.forEach(s => { htmlContent += `<li>${s.replace(/\*/g, '')}</li>`; });
            } else {
                htmlContent += '<li>Không có câu ví dụ nào được tạo.</li>';
            }
            
            htmlContent += '</ul><h4 class="text-lg font-semibold mt-4 mb-2">Từ liên quan:</h4><ul class="list-disc list-inside space-y-1">';
            if (relatedWords.length > 0) {
                relatedWords.forEach(relWord => { htmlContent += `<li><strong>${relWord.word}</strong>: ${relWord.meaning}</li>`; });
            } else {
                htmlContent += '<li>Không có từ liên quan nào được tạo.</li>';
            }
            
            htmlContent += '</ul>';
            aiTextContentDiv.innerHTML = htmlContent;

        } catch (error) {
            aiTextContentDiv.innerHTML = `<p class="text-red-600">Lỗi khi gọi AI: ${error.message}. Vui lòng thử lại.</p>`;
            console.error("Error calling AI:", error);
        } finally {
            loadingSpinner.style.display = 'none';
            aiGenerateCustomButton.disabled = false;
        }
    });

    stressMarkButton.addEventListener('click', async () => {
        if (!currentRawText) return;
        stressMarkButton.disabled = true;
        stressedLoadingSpinner.style.display = 'block';
        stressedTextSection.classList.remove('hidden');
        stressedContentDiv.innerHTML = '';
        
        try {
            const prompt = `Thêm dấu trọng âm vào văn bản tiếng Nga sau đây. Sử dụng ký tự Unicode acute accent (́) sau nguyên âm được nhấn trọng âm. Ví dụ: 'вода' -> 'вода́'. Giữ nguyên định dạng và dấu câu của văn bản gốc:\n\n${currentRawText}`;
            const stressedText = await callAI(prompt, "text/plain");
            stressedContentDiv.innerText = stressedText;
            addClickableSpansTo(stressedContentDiv);
        } catch (error) {
            stressedContentDiv.innerHTML = `<p class="text-red-600">Lỗi khi đánh trọng âm: ${error.message}.</p>`;
        } finally {
            stressMarkButton.disabled = false;
            stressedLoadingSpinner.style.display = 'none';
        }
    });

    explainTextButton.addEventListener('click', async () => {
        if (!currentRawText) return;
        explainTextButton.disabled = true;
        explanationLoadingSpinner.style.display = 'block';
        explanationSection.classList.remove('hidden');
        explanationContentDiv.innerHTML = '';
        
        try {
            const prompt = `Giải thích nội dung ngữ pháp tiếng Nga sau đây một cách chi tiết và dễ hiểu bằng tiếng Việt, dành cho người học tiếng Nga. Tập trung vào nghĩa các cụm từ, các cấu trúc ngữ pháp được sử dụng trong văn bản:\n\n${currentRawText}`;
            const explanation = await callAI(prompt, "text/plain");
            explanationContentDiv.innerHTML = explanation.replace(/\n/g, '<br>');
        } catch (error) {
            explanationContentDiv.innerHTML = `<p class="text-red-600">Lỗi khi gọi AI để giải thích: ${error.message}.</p>`;
        } finally {
            explainTextButton.disabled = false;
            explanationLoadingSpinner.style.display = 'none';
        }
    });

    fullTranslationButton.addEventListener('click', async () => {
        if (!currentRawText) {
            alert("Không có văn bản để dịch.");
            return;
        }
        
        fullTranslationButton.disabled = true;
        fullTranslationLoadingSpinner.style.display = 'block';
        fullTranslationSection.classList.remove('hidden');
        fullTranslationContentDiv.innerHTML = ''; // Xóa nội dung cũ
        
        const paragraphs = currentRawText.split('\n').filter(p => p.trim().length > 0);
        
        if (paragraphs.length === 0) {
            fullTranslationContentDiv.innerHTML = '<p>Không có nội dung văn bản hợp lệ để dịch.</p>';
            fullTranslationLoadingSpinner.style.display = 'none';
            fullTranslationButton.disabled = false;
            return;
        }

        try {
            for (const para of paragraphs) {
                const prompt = `Dịch đoạn văn tiếng Nga sau đây sang tiếng Việt. Chỉ trả về bản dịch tiếng Việt, không thêm bất kỳ lời giải thích nào:
---
${para}
---`;
                const translation = await callAI(prompt, "text/plain");
                
                const resultBlock = document.createElement('div');
                resultBlock.className = 'p-3 bg-gray-50 border border-gray-200 rounded-md';
                resultBlock.innerHTML = `<p class="font-medium text-gray-800">${translation}</p>
                                         <blockquote class="mt-2 text-sm text-gray-500 italic border-l-4 pl-2">${para}</blockquote>`;
                fullTranslationContentDiv.appendChild(resultBlock);
                fullTranslationContentDiv.scrollTop = fullTranslationContentDiv.scrollHeight;
            }
        } catch (error) {
            fullTranslationContentDiv.innerHTML += `<p class="text-red-600">Lỗi khi dịch văn bản: ${error.message}.</p>`;
        } finally {
            fullTranslationButton.disabled = false;
            fullTranslationLoadingSpinner.style.display = 'none';
        }
    });

    fileUploadInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        fileNameSpan.textContent = file.name;
        textInputArea.value = '';
        webUrlInput.value = '';
        textDisplay.textContent = 'Đang xử lý tệp tin...';
        const reader = new FileReader();

        if (file.name.endsWith('.docx')) {
            reader.onload = (e) => {
                window.mammoth.convertToHtml({ arrayBuffer: e.target.result })
                    .then(result => processNewContent(result.value, true))
                    .catch(error => {
                        console.error("Error processing DOCX:", error);
                        textDisplay.textContent = `Lỗi khi xử lý tệp DOCX: ${error.message}`;
                    });
            };
            reader.readAsArrayBuffer(file);
        } else { // Handle .txt files
            reader.onload = (e) => processNewContent(e.target.result, false);
            reader.readAsText(file);
        }
    });

    fetchUrlButton.addEventListener('click', async () => {
        const url = webUrlInput.value.trim();
        if (!url) {
            alert("Vui lòng nhập một URL.");
            return;
        }
        textInputArea.value = '';
        fileUploadInput.value = '';
        fileNameSpan.textContent = '';
        textDisplay.textContent = `Đang tải nội dung từ ${url}...`;
        try {
            const response = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
            if (!response.ok) {
                throw new Error(`Lỗi mạng: ${response.status} ${response.statusText}`);
            }
            const html = await response.text();
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            doc.querySelectorAll('script, style').forEach(el => el.remove());
            let text = doc.body.innerText || "Không thể trích xuất nội dung chính.";

            processNewContent(text, false);
            fileNameSpan.textContent = `Nội dung từ: ${url}`;
        } catch (error) {
            console.error("Error fetching URL:", error);
            textDisplay.textContent = `Không thể tải nội dung từ URL. Lỗi: ${error.message}`;
        }
    });

    processTextButton.addEventListener('click', () => {
        const text = textInputArea.value.trim();
        if (!text) {
            alert("Vui lòng nhập văn bản vào ô.");
            return;
        }
        fileUploadInput.value = '';
        webUrlInput.value = '';
        fileNameSpan.textContent = 'Văn bản đã nhập';
        processNewContent(text, false);
    });

    // --- TTS Implementation ---
    function updatePlayPauseUI() {
        if (speechSynthesis.speaking && !speechSynthesis.paused) {
            playIcon.classList.add('hidden');
            pauseIcon.classList.remove('hidden');
            playPauseText.textContent = 'Tạm dừng';
        } else {
            playIcon.classList.remove('hidden');
            pauseIcon.classList.add('hidden');
            playPauseText.textContent = 'Phát';
            if (!speechSynthesis.speaking) {
                ttsProgressBar.style.width = '0%';
            }
        }
    }

    function populateVoiceList() {
        voices = speechSynthesis.getVoices().filter(voice => voice.lang.startsWith('ru'));
        ttsVoiceSelect.innerHTML = '';
        if (voices.length === 0) {
            const option = document.createElement('option');
            option.textContent = 'Không có giọng đọc tiếng Nga';
            ttsVoiceSelect.appendChild(option);
            return;
        }
        voices.forEach(voice => {
            const option = document.createElement('option');
            option.textContent = `${voice.name} (${voice.lang})`;
            option.setAttribute('data-lang', voice.lang);
            option.setAttribute('data-name', voice.name);
            ttsVoiceSelect.appendChild(option);
        });
    }

    // MỚI: Hàm phát âm một từ (dùng cho cả auto-pronounce và nút bấm)
    function pronounceWord(word) {
        if (voices.length === 0) {
            console.warn("No Russian voices available for pronunciation.");
            return; // Không làm gì nếu không có giọng đọc
        }
        speechSynthesis.cancel(); // Dừng bất kỳ âm thanh nào đang phát
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'ru-RU';
        
        // Cố gắng tìm một giọng đọc tiếng Nga từ danh sách đã tải
        const ruVoice = voices.find(voice => voice.lang.startsWith('ru'));
        if (ruVoice) {
            utterance.voice = ruVoice;
        }
        // Đặt tốc độ dựa trên thanh trượt
        utterance.rate = ttsRateSlider.value; 
        
        speechSynthesis.speak(utterance);
    }

    function speak(text, startIndex = 0) {
        // ... (nội dung hàm speak) ...
    }

    function speak(text, startIndex = 0) {
        speechSynthesis.cancel();
        speechStartIndex = startIndex;
        const textToSpeak = text.substring(startIndex);
        if (!textToSpeak) return;

        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        const selectedVoiceName = ttsVoiceSelect.selectedOptions[0]?.getAttribute('data-name');
        utterance.voice = voices.find(voice => voice.name === selectedVoiceName);
        utterance.rate = ttsRateSlider.value;
        utterance.lang = 'ru-RU';
        utterance.onboundary = (event) => {
            const totalChars = currentRawText.length;
            const spokenChars = speechStartIndex + event.charIndex;
            const progress = totalChars > 0 ? (spokenChars / totalChars) * 100 : 0;
            ttsProgressBar.style.width = `${progress}%`;
        };

        utterance.onend = () => {
            ttsProgressBar.style.width = '0%';
            speechStartIndex = 0;
            updatePlayPauseUI();
        };

        utterance.onerror = (event) => {
            console.error('SpeechSynthesisUtterance.onerror', event);
            updatePlayPauseUI();
        };
        
        speechSynthesis.speak(utterance);
        setTimeout(updatePlayPauseUI, 50);
    }

    populateVoiceList();
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = populateVoiceList;
    }

    ttsPlayPauseBtn.addEventListener('click', () => {
        if (!currentRawText) return;
        if (speechSynthesis.speaking) {
            if (speechSynthesis.paused) {
                speechSynthesis.resume();
            } else {
                speechSynthesis.pause();
            }
        } else {
            speak(currentRawText, 0);
        }
        setTimeout(updatePlayPauseUI, 50);
    });

    ttsStopBtn.addEventListener('click', () => {
        speechSynthesis.cancel();
        ttsProgressBar.style.width = '0%';
        speechStartIndex = 0;
        updatePlayPauseUI();
    });

    ttsRateSlider.addEventListener('input', (e) => {
        const rate = parseFloat(e.target.value);
        ttsRateLabel.textContent = `${rate.toFixed(1)}x`;
        if (speechSynthesis.speaking && !speechSynthesis.paused) {
            const currentProgress = parseFloat(ttsProgressBar.style.width) || 0;
            const seekIndex = Math.floor((currentProgress / 100) * currentRawText.length);
            speak(currentRawText, seekIndex);
        }
    });

    ttsProgressContainer.addEventListener('click', (e) => {
        if (!currentRawText) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = e.currentTarget.offsetWidth;
        const percentage = clickX / width;
        
        let seekIndex = Math.floor(percentage * currentRawText.length);
        
        const lastSpace = currentRawText.lastIndexOf(' ', seekIndex);
        if (lastSpace !== -1) {
            seekIndex = lastSpace + 1;
        }

        speak(currentRawText, seekIndex);
    });

    document.querySelectorAll('.toggle-button').forEach(button => {
        button.addEventListener('click', () => {
            const content = button.closest('.section-header').nextElementSibling;
            content.classList.toggle('hidden');
            button.textContent = content.classList.contains('hidden') ? 'Hiển thị' : 'Thu gọn';
        });
    });

    document.addEventListener('mouseup', (e) => {
        setTimeout(() => {
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed) {
                return;
            }

            const selectedText = selection.toString().trim();
            const targetIsPopup = selectionPopup.contains(e.target) || modalContentInner.contains(e.target);
            const targetIsWord = e.target.closest('.word-clickable');

            if (!selectedText || targetIsPopup || targetIsWord) {
                return;
            }

            lookupModalOverlay.style.display = 'none';
            selectionPopup.style.visibility = 'hidden';
            selectionPopup.classList.remove('hidden');
            
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const popupWidth = selectionPopup.offsetWidth;
            const popupHeight = selectionPopup.offsetHeight;
            const margin = 10;
            let top = rect.bottom + window.scrollY + 5;
            let left = rect.left + window.scrollX + (rect.width / 2) - (popupWidth / 2);
            if (left + popupWidth > window.innerWidth - margin) left = window.innerWidth - popupWidth - margin;
            if (left < margin) left = margin;
            if (top + popupHeight > window.innerHeight + window.scrollY - margin) {
                top = rect.top + window.scrollY - popupHeight - 5;
            }
            if (top < window.scrollY + margin) top = window.scrollY + margin;
            
            selectionPopup.style.top = `${top}px`;
            selectionPopup.style.left = `${left}px`;
            selectionPopup.style.visibility = 'visible';
            
            copySelectionButton.onclick = () => {
                const textArea = document.createElement("textarea");
                textArea.value = selectedText;
                textArea.style.position = "fixed";
                textArea.style.top = "-9999px";
                textArea.style.left = "-9999px";
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    document.execCommand('copy');
                } catch (err) {
                    console.error('Fallback: Oops, unable to copy', err);
                }
                document.body.removeChild(textArea);
                selectionPopup.classList.add('hidden');
            };

            translateSelectionButton.onclick = async () => {
                selectionTranslateResultDiv.classList.add('hidden');
                selectionTranslateSpinner.style.display = 'block';
                const translation = await getTranslation(selectedText);
                selectionTranslateResultDiv.innerHTML = `<strong>Dịch:</strong> ${translation}`;
                selectionTranslateResultDiv.classList.remove('hidden');
            };
            selectionTranslateResultDiv.classList.add('hidden');
            selectionTranslateSpinner.style.display = 'none';
        }, 0);
    });
}

// Chạy ứng dụng khi trang đã tải xong
window.addEventListener('load', mainApp);