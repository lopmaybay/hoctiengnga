// --- Application Logic ---
function mainApp() {
    console.log("mainApp() bắt đầu");

    // Biến theo dõi thời gian gọi API
    let lastApiCallTime = 0; 

    // Biến Firebase
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

    let auth;
    let db;
    let userId = null;
    let isAuthReady = false;

    // Khởi tạo Firebase
    if (Object.keys(firebaseConfig).length > 0 && typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();

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
    
    // DOM Cài đặt API
    const geminiApiKeyInput = document.getElementById('gemini-api-key');
    const geminiModelInput = document.getElementById('gemini-model-name');
    const apiDelaySelect = document.getElementById('api-delay-select');

    // DOM Dịch Toàn Bộ
    const fullTranslationButton = document.getElementById('translate-full-text-button');
    const fullTranslationSection = document.getElementById('full-translation-section');
    const fullTranslationContentDiv = document.getElementById('full-translation-content');
    const fullTranslationLoadingSpinner = document.getElementById('full-translation-loading-spinner');
    const copyTranslationButton = document.getElementById('copy-translation-button');

    // DOM Nút Sao chép
    const copyStressedButton = document.getElementById('copy-stressed-button');
    const copyExplanationButton = document.getElementById('copy-explanation-button');
    const modalCopyButton = document.getElementById('modal-copy-button');

    // DOM TTS
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
    const modalPronounceButton = document.getElementById('modal-pronounce-button');

    // DOM Modal Lỗi API
    const apiErrorModal = document.getElementById('api-error-modal');
    const apiErrorMessage = document.getElementById('api-error-message');
    const apiErrorCancel = document.getElementById('api-error-cancel');
    const apiErrorRetry = document.getElementById('api-error-retry');

    // DOM Điều khiển Tác vụ
    const batchControls = document.getElementById('batch-controls');
    const batchStatusText = document.getElementById('batch-status-text');
    const batchTimer = document.getElementById('batch-timer');
    const batchProgressBar = document.getElementById('batch-progress-bar');
    const batchProgressText = document.getElementById('batch-progress-text');
    const batchPauseResumeButton = document.getElementById('batch-pause-resume-button');
    const batchStopButton = document.getElementById('batch-stop-button');


    // Biến trạng thái
    let currentRawText = '';
    let justEndedDrag = false;
    let voices = [];
    let speechStartIndex = 0;
    
    // Biến trạng thái cho Tác vụ
    let taskState = 'stopped'; // 'running', 'paused', 'stopped'
    let taskTimerInterval;
    let taskStartTime;
    let timePaused = 0;
    let pauseStartTime;

    // Biến trạng thái cho các tác vụ lặp (chunking)
    let translationParagraphs = [];
    let currentTranslationIndex = 0;
    let stressMarkParagraphs = [];
    let currentStressMarkIndex = 0;
    let explainParagraphs = [];
    let currentExplainIndex = 0;

    /**
     * SỬA LỖI: Hàm fetch với cơ chế throttle (hãm)
     * Thêm tham số 'isBatchTask' để logic Tạm dừng/Dừng
     */
    async function throttledFetch(url, options, isBatchTask = false) {
        const selectedDelay = parseInt(apiDelaySelect.value, 10) * 1000;
        
        if (selectedDelay > 0) {
            const now = Date.now();
            const timeSinceLastCall = now - lastApiCallTime;
            const waitTime = (timeSinceLastCall < selectedDelay) ? (selectedDelay - timeSinceLastCall) : 0;
            
            lastApiCallTime = now + waitTime;

            if (waitTime > 0) {
                console.log(`[throttledFetch] Đang chờ ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                console.log("[throttledFetch] Chờ xong.");
            }
        }
        
        // SỬA LỖI: Chỉ kiểm tra Tạm dừng/Dừng nếu đây LÀ một tác vụ hàng loạt
        if (isBatchTask) {
            while (taskState === 'paused') {
                console.log("[throttledFetch] Tác vụ đang tạm dừng, chờ...");
                await new Promise(resolve => setTimeout(resolve, 500)); // Chờ 0.5s rồi kiểm tra lại
            }
            
            if (taskState === 'stopped') {
                throw new Error("Tác vụ đã bị dừng bởi người dùng.");
            }
        }

        return fetch(url, options);
    }

    /**
     * Làm cho một phần tử có thể kéo thả được
     */
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

    /**
     * Chỉ thêm class 'word-clickable', KHÔNG thêm sự kiện 'click'
     */
    function addClickableSpansTo(element) {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
        let node;
        const nodesToProcess = [];
        while (node = walker.nextNode()) {
            nodesToProcess.push(node);
        }

        nodesToProcess.forEach(textNode => {
            if (textNode.parentNode.classList.contains('word-clickable')) return;
            
            if (/[\u0400-\u04FF]/.test(textNode.nodeValue)) {
                const parent = textNode.parentNode;
                const parts = textNode.nodeValue.split(/([\u0400-\u04FF]+[\u0301]?)/g);
                
                const fragment = document.createDocumentFragment();
                parts.forEach(part => {
                    if (part.match(/[\u0400-\u04FF]/)) {
                        const span = document.createElement('span');
                        span.textContent = part;
                        span.className = 'word-clickable'; // Chỉ gán class
                        fragment.appendChild(span);
                    } else {
                        fragment.appendChild(document.createTextNode(part));
                    }
                });
                parent.replaceChild(fragment, textNode);
            }
        });
    }

    /**
     * Chỉ thêm class 'word-clickable' trong processNewContent
     */
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
                    span.className = 'word-clickable'; // Chỉ gán class
                    textDisplay.appendChild(span);
                } else {
                    textDisplay.appendChild(document.createTextNode(part));
                }
            });
        }

        [aiResultsSection, explanationSection, stressedTextSection, lookupModalOverlay, selectionPopup, fullTranslationSection].forEach(el => el.classList.add('hidden'));
    }

    /**
     * Gọi API Gemini để dịch một từ hoặc cụm từ
     */
    async function getTranslation(word) {
        console.log(`[getTranslation] Bắt đầu dịch từ: "${word}"`);
        translateLoadingSpinner.style.display = 'block';
        selectionTranslateSpinner.style.display = 'block';
        
        const apiKey = geminiApiKeyInput.value.trim();
        const modelName = (geminiModelInput.value.trim() || 'gemini-2.5-flash-lite').replace(':generateContent', '');

        if (!apiKey) {
            console.warn("[getTranslation] Lỗi: Chưa nhập API Key.");
            translateLoadingSpinner.style.display = 'none';
            selectionTranslateSpinner.style.display = 'none';
            alert("Vui lòng nhập Gemini API Key của bạn trong phần Cài đặt.");
            return `Lỗi: Chưa nhập API Key.`;
        }

        try {
            const prompt = `Dịch từ tiếng Nga "${word}" sang tiếng Việt. Chỉ trả về nghĩa tiếng Việt, không thêm bất kỳ văn bản giải thích nào khác.`;
            const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "text/plain" } };
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            
            // SỬA LỖI: Dịch pop-up không phải là tác vụ hàng loạt
            const response = await throttledFetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, false);

            if (!response.ok) throw new Error(`API error: ${response.status}`);
            const result = await response.json();
            if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
                console.log(`[getTranslation] Dịch thành công: "${result.candidates[0].content.parts[0].text.trim()}"`);
                return result.candidates[0].content.parts[0].text.trim();
            }
            throw new Error("Unexpected AI response structure");
        } catch (error) {
            console.error("[getTranslation] Lỗi:", error);
            return `Lỗi dịch.`;
        } finally {
            translateLoadingSpinner.style.display = 'none';
            selectionTranslateSpinner.style.display = 'none';
        }
    }

    /**
     * SỬA LỖI: Định vị một modal (pop-up) dựa trên một hình chữ nhật tham chiếu (referenceRect)
     */
    function positionModal(modalElement, referenceRect) {
        console.log(`[positionModal] Định vị modal:`, modalElement.id);
        
        // 1. Lưu lại visibility
        const originalVisibility = modalElement.style.visibility;
        
        // 2. Đặt nó ra ngoài màn hình và VÔ HÌNH, nhưng đảm bảo nó là 'block' hoặc 'flex'
        // để trình duyệt tính toán kích thước
        modalElement.style.visibility = 'hidden';
        modalElement.style.left = '-10000px';
        modalElement.style.top = '-10000px';
        
        // 3. Hiển thị nó (nếu nó là popup ẩn)
        const wasHidden = modalElement.classList.contains('hidden');
        if (wasHidden) {
            modalElement.classList.remove('hidden'); // Gỡ 'hidden' (display: none)
        }
        // Nếu nó là modal-content-inner, đảm bảo nó là 'block'
        if (modalElement.id === 'modal-content-inner') {
             modalElement.style.display = 'block';
        }

        // 4. Lấy kích thước
        const modalWidth = modalElement.offsetWidth;
        const modalHeight = modalElement.offsetHeight;

        // 5. Ẩn nó lại (nếu nó bị ẩn)
        if (wasHidden) {
            modalElement.classList.add('hidden');
        }
        
        // 6. Khôi phục visibility
        modalElement.style.visibility = originalVisibility;

        console.log(`[positionModal] Kích thước Modal: ${modalWidth}w x ${modalHeight}h`);
        
        if (modalWidth === 0 && modalHeight === 0) {
             console.error("[positionModal] LỖI: Kích thước modal là 0x0. Kiểm tra CSS.");
        }

        const margin = 10;
        
        // SỬA LỖI LỚN: XÓA window.scrollY và window.scrollX
        let top = referenceRect.bottom + 5; 
        let left = referenceRect.left + (referenceRect.width / 2) - (modalWidth / 2);
        
        // Kiểm tra lề DƯỚI (sử dụng window.innerHeight)
        if (top + modalHeight > window.innerHeight - margin && modalHeight > 0) {
            top = referenceRect.top - modalHeight - 5; // Đặt lên trên
        }
        // Kiểm tra lề PHẢI
        if (left + modalWidth > window.innerWidth - margin) {
            left = window.innerWidth - modalWidth - margin;
        }
        // Kiểm tra lề TRÁI
        if (left < margin) {
            left = margin;
        }
        // Kiểm tra lề TRÊN
        if (top < margin) {
            top = margin;
        }

        modalElement.style.left = `${left}px`;
        modalElement.style.top = `${top}px`;
        console.log(`[positionModal] Đặt vị trí: top: ${top}px, left: ${left}px`);
    }


    /**
     * SỬA LỖI: Mở modal tra cứu từ đầy đủ
     */
    async function openLookupModal(word, referenceRect) {
        console.log(`[openLookupModal] Mở modal đầy đủ cho từ: "${word}"`);
        selectedWordModalSpan.textContent = word;
        
        // MỚI: Gán sự kiện cho nút sao chép
        modalCopyButton.onclick = () => {
             copyToClipboard(word, modalCopyButton);
        };

        modalPronounceButton.onclick = () => {
            pronounceWord(word);
        };

        const encodedWord = encodeURIComponent(word);
        vtudienLink.href = `https://vtudien.com/nga-viet/dictionary/nghia-cua-tu-${encodedWord}`;
        youglishLink.href = `https://youglish.com/pronounce/${encodedWord}/russian`;
        wiktionaryLink.href = `https://ru.wiktionary.org/wiki/${encodedWord}`;
        googleTranslateResultDiv.innerHTML = '';
        
        // 1. Hiển thị LỚP PHỦ
        console.log("[openLookupModal] Hiển thị lookupModalOverlay");
        lookupModalOverlay.style.display = 'block'; 
        
        // 2. Đặt nội dung thành 'visibility: hidden' VÀ 'display: block'
        modalContentInner.style.visibility = 'hidden';
        modalContentInner.style.display = 'block';
        
        // 3. Định vị
        positionModal(modalContentInner, referenceRect);
        
        // 4. Hiển thị nội dung
        modalContentInner.style.visibility = 'visible';
        console.log("[openLookupModal] Đã hiển thị modal.");

        if (autoPronounceCheckbox.checked) {
            console.log("[openLookupModal] Tự động phát âm");
            pronounceWord(word);
        }
        
        const translation = await getTranslation(word);
        googleTranslateResultDiv.innerHTML = `<strong>Dịch:</strong> ${translation}`;
    }

    /**
     * SỬA LỖI: Mở modal đơn giản (Copy/Translate)
     */
    function openSelectionPopup(selectedText, referenceRect) {
        console.log(`[openSelectionPopup] Mở modal đơn giản cho: "${selectedText.substring(0, 20)}..."`);
        
        // 1. Định vị (hàm này sẽ xử lý đo lường)
        positionModal(selectionPopup, referenceRect); 

        // 2. Hiển thị (gỡ bỏ class 'hidden' VÀ set 'visibility')
        selectionPopup.classList.remove('hidden');
        selectionPopup.style.visibility = 'visible';
        console.log("[openSelectionPopup] Đã hiển thị popup.");

        copySelectionButton.onclick = () => {
            console.log("[openSelectionPopup] Sao chép");
            copyToClipboard(selectedText, copySelectionButton); // Dùng hàm helper
            setTimeout(() => {
                selectionPopup.classList.add('hidden');
            }, 1000); // Ẩn sau 1 giây
        };

        translateSelectionButton.onclick = async () => {
            console.log("[openSelectionPopup] Dịch");
            selectionTranslateResultDiv.classList.add('hidden');
            selectionTranslateSpinner.style.display = 'block';
            const translation = await getTranslation(selectedText); 
            selectionTranslateResultDiv.innerHTML = `<strong>Dịch:</strong> ${translation}`;
            selectionTranslateResultDiv.classList.remove('hidden');
        };
        selectionTranslateResultDiv.classList.add('hidden');
        selectionTranslateSpinner.style.display = 'none';
    }


    // Kích hoạt kéo thả
    makeDraggable(modalContentInner);
    makeDraggable(selectionPopup);

    // Sự kiện đóng modal (chỉ nút X)
    closeLookupModalBtn.addEventListener('click', () => {
        console.log("[closeLookupModalBtn] Nút X được nhấp, đóng modal.");
        lookupModalOverlay.style.display = 'none';
    });

    closeSelectionPopupBtn.addEventListener('click', () => {
        console.log("[closeSelectionPopupBtn] Nút X được nhấp, đóng pop-up.");
        selectionPopup.classList.add('hidden');
    });

    /**
     * SỬA LỖI: Hàm gọi API Gemini chính (cho các tác vụ lớn)
     */
    async function callAI(prompt, responseMimeType, responseSchema, isBatchTask = false) {
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
        
        console.log(`[callAI] Gửi request. isBatchTask = ${isBatchTask}`);
        // SỬA LỖI: Truyền `isBatchTask` vào throttledFetch
        const response = await throttledFetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, isBatchTask);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error("[callAI] Lỗi API:", errorText);
            throw new Error(`API error: ${response.status} - ${errorText}`);
        }
        const result = await response.json();
        
        if (result.candidates?.[0]?.finishReason === 'SAFETY' || result.candidates?.[0]?.finishReason === 'RECITATION') {
            throw new Error("Nội dung bị chặn do chính sách an toàn hoặc trích dẫn.");
        }
        if (result.promptFeedback?.blockReason) {
             throw new Error(`Prompt bị chặn: ${result.promptFeedback.blockReason}`);
        }

        if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
            return result.candidates[0].content.parts[0].text;
        }

        if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
             console.warn("API response received but no text part found:", result);
             throw new Error("Phản hồi API không mong đợi (không có phần text).");
        }

        throw new Error("Phản hồi AI có cấu trúc không mong đợi.");
    }

    /**
     * Hiển thị Modal Lỗi API và chờ phản hồi 'retry' hoặc 'cancel'
     */
    function showRetryModal(errorMessage) {
        console.log("[showRetryModal] Hiển thị modal lỗi:", errorMessage);
        return new Promise((resolve) => {
            apiErrorMessage.textContent = `Lỗi: ${errorMessage}\n\nVui lòng đợi một lát (có thể do giới hạn API) và thử lại.`;
            apiErrorModal.style.display = 'flex';
            
            // Tạm dừng timer khi modal lỗi xuất hiện
            if (taskState === 'running') pauseTimer();

            apiErrorCancel.onclick = () => {
                console.log("[showRetryModal] Người dùng chọn 'Kết thúc'");
                apiErrorModal.style.display = 'none';
                stopTimer(); // Dừng hẳn timer
                resolve('cancel'); 
            };
            
            apiErrorRetry.onclick = () => {
                console.log("[showRetryModal] Người dùng chọn 'Thử lại'");
                apiErrorModal.style.display = 'none';
                resumeTimer(); // Tiếp tục timer
                resolve('retry');
            };
        });
    }

    /**
     * MỚI: Hàm helper để sao chép
     */
    function copyToClipboard(text, buttonElement) {
        console.log("[copyToClipboard] Bắt đầu sao chép...");
        if (!text || text.trim() === '') {
            alert("Không có gì để sao chép.");
            console.warn("[copyToClipboard] Không có văn bản để sao chép.");
            return;
        }

        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.top = "-9999px";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            
            if (buttonElement) {
                const originalText = buttonElement.textContent;
                buttonElement.textContent = 'Đã sao chép!';
                console.log("[copyToClipboard] Sao chép thành công!");
                setTimeout(() => {
                    // Chỉ đặt lại text nếu nó vẫn là 'Đã sao chép!'
                    if(buttonElement.textContent === 'Đã sao chép!') {
                        buttonElement.textContent = originalText;
                    }
                }, 2000);
            }
        } catch (err) {
            console.error('[copyToClipboard] Không thể sao chép', err);
            alert("Không thể sao chép. Lỗi: " + err.message);
        }
        document.body.removeChild(textArea);
    }

    // --- MỚI: Khối điều khiển Tác vụ (Timer, Pause, Stop) ---

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    }

    function startTimer() {
        console.log("[Timer] Bắt đầu.");
        taskStartTime = Date.now();
        timePaused = 0;
        
        batchTimer.textContent = '00:00';
        // Xóa interval cũ nếu có
        if (taskTimerInterval) clearInterval(taskTimerInterval);
        
        taskTimerInterval = setInterval(() => {
            if (taskState === 'running') {
                const elapsed = Math.floor((Date.now() - taskStartTime - timePaused) / 1000);
                batchTimer.textContent = formatTime(elapsed);
            }
        }, 1000);
    }

    function pauseTimer() {
        console.log("[Timer] Tạm dừng.");
        pauseStartTime = Date.now();
    }

    function resumeTimer() {
        console.log("[Timer] Tiếp tục.");
        timePaused += (Date.now() - pauseStartTime);
    }

    function stopTimer() {
        console.log("[Timer] Dừng.");
        clearInterval(taskTimerInterval);
        taskTimerInterval = null;
        taskStartTime = null;
        timePaused = 0;
        batchTimer.textContent = '00:00';
    }

    function showBatchControls(taskName) {
        console.log(`[BatchControls] Hiển thị cho tác vụ: ${taskName}`);
        batchStatusText.textContent = `Đang ${taskName}...`;
        batchProgressBar.style.width = '0%';
        batchProgressText.textContent = '';
        batchPauseResumeButton.textContent = 'Tạm dừng';
        batchControls.classList.remove('hidden');
        
        [stressMarkButton, explainTextButton, fullTranslationButton].forEach(btn => btn.disabled = true);
        
        taskState = 'running';
        startTimer();
    }

    function hideBatchControls() {
        console.log("[BatchControls] Ẩn.");
        batchControls.classList.add('hidden');
        
        [stressMarkButton, explainTextButton, fullTranslationButton].forEach(btn => btn.disabled = false);
        
        taskState = 'stopped';
        stopTimer();
    }

    batchPauseResumeButton.addEventListener('click', () => {
        if (taskState === 'running') {
            taskState = 'paused';
            batchStatusText.textContent = 'Đã tạm dừng';
            batchPauseResumeButton.textContent = 'Tiếp tục';
            pauseTimer();
            console.log("[BatchControls] Đã tạm dừng.");
        } else if (taskState === 'paused') {
            taskState = 'running';
            batchStatusText.textContent = 'Đang xử lý...';
            batchPauseResumeButton.textContent = 'Tạm dừng';
            resumeTimer();
            console.log("[BatchControls] Đã tiếp tục.");
        }
    });

    batchStopButton.addEventListener('click', () => {
        console.log("[BatchControls] Đã dừng.");
        taskState = 'stopped'; // Hàm throttledFetch sẽ bắt lỗi này
        hideBatchControls();
    });

    function updateBatchProgress(current, total) {
        if (total === 0) return;
        const percent = Math.round((current / total) * 100);
        batchProgressBar.style.width = `${percent}%`;
        batchProgressText.textContent = `Đang xử lý ${current} / ${total}`;
    }

    // --- HẾT Khối điều khiển Tác vụ ---


    /**
     * THAY ĐỔI: Sự kiện: Nút "Tạo câu & từ liên quan"
     */
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
            // THAY ĐỔI: Prompt mới
            const prompt = `Cho từ tiếng Nga "${word}", hãy tạo ra:
1.  10 câu ví dụ (tiếng Nga) VÀ nghĩa tiếng Việt tương ứng của từng câu.
2.  10 từ vựng tiếng Nga liên quan (có dấu trọng âm) VÀ nghĩa tiếng Việt của chúng.

Trả về kết quả dưới dạng JSON theo cấu trúc sau:
{"sentences": [{"russian": "câu tiếng Nga 1", "vietnamese": "nghĩa tiếng Việt 1"}, ...], "related_words": [{"word": "từ 1 có trọng âm", "meaning": "nghĩa tiếng Việt 1"}, ...]}`;
      
            // THAY ĐỔI: Schema mới
            const schema = {
                type: "OBJECT",
                properties: {
                    "sentences": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "russian": { "type": "STRING" },
                                "vietnamese": { "type": "STRING" }
                            },
                            "required": ["russian", "vietnamese"]
                        }
                    },
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
            
            // SỬA LỖI: Đặt isBatchTask = false
            const jsonString = await callAI(prompt, "application/json", schema, false);
            const parsedJson = JSON.parse(jsonString);
            
            const sentences = Array.isArray(parsedJson.sentences) ? parsedJson.sentences : [];
            const relatedWords = Array.isArray(parsedJson.related_words) ? parsedJson.related_words : [];

            // THAY ĐỔI: Logic render HTML mới
            let htmlContent = '<h4 class="text-lg font-semibold mb-2">Câu ví dụ:</h4><ul class="list-disc list-inside space-y-2">';
            if (sentences.length > 0) {
                sentences.forEach(s => { 
                    htmlContent += `<li class="mb-1">
                                      <span>${s.russian.replace(/\*/g, '')}</span>
                                      <br>
                                      <span class="text-sm text-gray-600 italic">${s.vietnamese}</span>
                                    </li>`; 
                });
            } else {
                htmlContent += '<li>Không có câu ví dụ nào được tạo.</li>';
            }
            
            htmlContent += '</ul><h4 class="text-lg font-semibold mt-4 mb-2">Từ liên quan:</h4><ul class="list-disc list-inside space-y-1">';
            if (relatedWords.length > 0) {
                relatedWords.forEach(relWord => { 
                    htmlContent += `<li><strong>${relWord.word}</strong>: ${relWord.meaning}</li>`; 
                });
            } else {
                htmlContent += '<li>Không có từ liên quan nào được tạo.</li>';
            }
            
            htmlContent += '</ul>';
            aiTextContentDiv.innerHTML = htmlContent;

            addClickableSpansTo(aiTextContentDiv);

        } catch (error) {
            aiTextContentDiv.innerHTML = `<p class="text-red-600">Lỗi khi gọi AI: ${error.message}. Vui lòng thử lại.</p>`;
            console.error("Error calling AI:", error);
        } finally {
            loadingSpinner.style.display = 'none';
            aiGenerateCustomButton.disabled = false;
        }
    });

    /**
     * Hàm chạy tác vụ "Đánh trọng âm" (theo từng đoạn)
     */
    async function runStressMarkTask() {
        showBatchControls("đánh trọng âm");
        stressedTextSection.classList.remove('hidden');
        
        while (currentStressMarkIndex < stressMarkParagraphs.length) {
            updateBatchProgress(currentStressMarkIndex, stressMarkParagraphs.length);
            
            const para = stressMarkParagraphs[currentStressMarkIndex];
            if (para.trim() === '') {
                stressedContentDiv.appendChild(document.createElement('br'));
                currentStressMarkIndex++;
                continue;
            }

            try {
                console.log(`[runStressMarkTask] Xử lý đoạn ${currentStressMarkIndex + 1}/${stressMarkParagraphs.length}`);
                
                // THAY ĐỔI: Prompt đã được cập nhật
                const prompt = `Chỉ thêm dấu trọng âm vào văn bản tiếng Nga sau. Sử dụng ký tự Unicode acute accent (́) sau nguyên âm được nhấn.
Ví dụ: 'вода' -> 'вода́'.
Giữ nguyên định dạng và dấu câu.
Chỉ trả về văn bản đã được đánh trọng âm, KHÔNG thêm bất kỳ lời giải thích hay câu chào nào.
Văn bản:
${para}`;

                // SỬA LỖI: Đặt isBatchTask = true
                const stressedText = await callAI(prompt, "text/plain", null, true);

                const paraElement = document.createElement('div');
                paraElement.innerText = stressedText;
                stressedContentDiv.appendChild(paraElement);
                addClickableSpansTo(paraElement);

                currentStressMarkIndex++; 
            } catch (error) {
                console.error("[runStressMarkTask] Lỗi:", error.message);
                if (error.message.includes("Tác vụ đã bị dừng")) {
                    break; // Thoát vòng lặp nếu người dùng dừng
                }
                
                const action = await showRetryModal(error.message);
                if (action === 'cancel') {
                    break; // Thoát vòng lặp
                }
                // Nếu 'retry', vòng lặp sẽ tự động thử lại
            }
        }
        
        console.log("[runStressMarkTask] Hoàn thành hoặc bị dừng.");
        hideBatchControls();
    }

    stressMarkButton.addEventListener('click', () => {
        console.log("[stressMarkButton] Nút được nhấp");
        if (taskState !== 'stopped') return; // Không chạy nếu tác vụ khác đang diễn ra
        if (!currentRawText) { alert("Không có văn bản để xử lý."); return; }
        
        stressedContentDiv.innerHTML = ''; 
        currentStressMarkIndex = 0;
        stressMarkParagraphs = currentRawText.split('\n');
        
        if (stressMarkParagraphs.length === 1 && stressMarkParagraphs[0] === "") {
             stressMarkParagraphs = [currentRawText];
        }

        runStressMarkTask();
    });

    /**
     * Hàm chạy tác vụ "Giải thích ngữ pháp" (theo từng đoạn)
     */
    async function runExplainTask() {
        showBatchControls("giải thích ngữ pháp");
        explanationSection.classList.remove('hidden');
        
        while (currentExplainIndex < explainParagraphs.length) {
            updateBatchProgress(currentExplainIndex, explainParagraphs.length);
            
            const para = explainParagraphs[currentExplainIndex];
            try {
                console.log(`[runExplainTask] Xử lý đoạn ${currentExplainIndex + 1}/${explainParagraphs.length}`);
                const prompt = `Giải thích nội dung ngữ pháp tiếng Nga sau đây một cách chi tiết và dễ hiểu bằng tiếng Việt, dành cho người học tiếng Nga. Tập trung vào nghĩa các cụm từ, các cấu trúc ngữ pháp được sử dụng trong đoạn văn bản:\n\n${para}`;
                
                // SỬA LỖI: Đặt isBatchTask = true
                const explanation = await callAI(prompt, "text/plain", null, true);

                const resultBlock = document.createElement('div');
                resultBlock.className = 'p-3 bg-gray-50 border border-gray-200 rounded-md';
                resultBlock.innerHTML = `<p>${explanation.replace(/\n/g, '<br>')}</p>
                                         <blockquote class="mt-2 text-sm text-gray-500 italic border-l-4 pl-2">${para}</blockquote>`;
                explanationContentDiv.appendChild(resultBlock);
                addClickableSpansTo(resultBlock); 

                currentExplainIndex++; 
            } catch (error) {
                console.error("[runExplainTask] Lỗi:", error.message);
                if (error.message.includes("Tác vụ đã bị dừng")) {
                    break; 
                }
                
                const action = await showRetryModal(error.message);
                if (action === 'cancel') {
                    break;
                }
            }
        }
        
        console.log("[runExplainTask] Hoàn thành hoặc bị dừng.");
        hideBatchControls();
    }

    explainTextButton.addEventListener('click', () => {
        console.log("[explainTextButton] Nút được nhấp");
        if (taskState !== 'stopped') return;
        if (!currentRawText) { alert("Không có văn bản để xử lý."); return; }
        
        explanationContentDiv.innerHTML = '';
        currentExplainIndex = 0;
        explainParagraphs = currentRawText.split('\n').filter(p => p.trim().length > 0);
        
        if (explainParagraphs.length === 0 && currentRawText.trim().length > 0) {
             explainParagraphs = [currentRawText];
        }

        if (explainParagraphs.length === 0) {
            alert("Không có nội dung văn bản hợp lệ để xử lý.");
            return;
        }

        runExplainTask();
    });

    /**
     * Hàm chạy tác vụ "Dịch toàn bộ" (theo từng đoạn)
     */
    async function runFullTranslationTask() {
        showBatchControls("dịch văn bản");
        fullTranslationSection.classList.remove('hidden');

        while (currentTranslationIndex < translationParagraphs.length) {
            updateBatchProgress(currentTranslationIndex, translationParagraphs.length);
            
            const para = translationParagraphs[currentTranslationIndex];
            try {
                console.log(`[runFullTranslationTask] Xử lý đoạn ${currentTranslationIndex + 1}/${translationParagraphs.length}`);
                const prompt = `Dịch đoạn văn tiếng Nga sau đây sang tiếng Việt. Chỉ trả về bản dịch tiếng Việt, không thêm bất kỳ lời giải thích nào:\n---\n${para}\n---`;
                
                // SỬA LỖI: Đặt isBatchTask = true
                const translation = await callAI(prompt, "text/plain", null, true);
                
                const resultBlock = document.createElement('div');
                resultBlock.className = 'p-3 bg-gray-50 border border-gray-200 rounded-md';
                resultBlock.innerHTML = `<p class="font-medium text-gray-800">${translation}</p>
                                         <blockquote class="mt-2 text-sm text-gray-500 italic border-l-4 pl-2">${para}</blockquote>`;
                
                addClickableSpansTo(resultBlock);

                fullTranslationContentDiv.appendChild(resultBlock);
                fullTranslationContentDiv.scrollTop = fullTranslationContentDiv.scrollHeight;
                
                currentTranslationIndex++; 

            } catch (error) {
                console.error("[runFullTranslationTask] Lỗi:", error.message);
                if (error.message.includes("Tác vụ đã bị dừng")) {
                    break;
                }
                
                const action = await showRetryModal(error.message);
                if (action === 'cancel') {
                    break;
                }
            }
        }
        
        console.log("[runFullTranslationTask] Hoàn thành hoặc bị dừng.");
        hideBatchControls();
    }

    fullTranslationButton.addEventListener('click', () => {
        console.log("[fullTranslationButton] Nút được nhấp");
        if (taskState !== 'stopped') return;
        if (!currentRawText) { alert("Không có văn bản để dịch."); return; }
        
        fullTranslationContentDiv.innerHTML = ''; 
        currentTranslationIndex = 0;
        translationParagraphs = currentRawText.split('\n').filter(p => p.trim().length > 0);
        
        if (translationParagraphs.length === 0 && currentRawText.trim().length > 0) {
             translationParagraphs = [currentRawText];
        }

        if (translationParagraphs.length === 0) {
            alert("Không có nội dung văn bản hợp lệ để dịch.");
            return;
        }

        runFullTranslationTask();
    });

    /**
     * MỚI: Thêm các hàm sao chép
     */
    copyTranslationButton.addEventListener('click', () => {
        const translationBlocks = fullTranslationContentDiv.querySelectorAll('.p-3 > p.font-medium');
        if (translationBlocks.length === 0) {
            alert("Không có gì để sao chép.");
            return;
        }
        const fullText = Array.from(translationBlocks)
                            .map(p => p.innerText)
                            .join('\n\n');
        copyToClipboard(fullText, copyTranslationButton);
    });

    copyStressedButton.addEventListener('click', () => {
        const textToCopy = stressedContentDiv.innerText;
        copyToClipboard(textToCopy, copyStressedButton);
    });

    copyExplanationButton.addEventListener('click', () => {
        const explanationBlocks = explanationContentDiv.querySelectorAll('.p-3 > p');
         if (explanationBlocks.length === 0) {
            alert("Không có gì để sao chép.");
            return;
        }
        const fullText = Array.from(explanationBlocks)
                            .map(p => p.innerText)
                            .join('\n\n---\n\n');
        copyToClipboard(fullText, copyExplanationButton);
    });


    // Sự kiện: Tải tệp lên
    fileUploadInput.addEventListener('change', (event) => {
        // ... (logic hàm này không đổi) ...
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

    // Sự kiện: Lấy nội dung từ URL
    fetchUrlButton.addEventListener('click', async () => {
        // ... (logic hàm này không đổi) ...
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

    // Sự kiện: Xử lý văn bản từ Textarea
    processTextButton.addEventListener('click', () => {
        // ... (logic hàm này không đổi) ...
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

    /**
     * Phát âm một từ
     */
    function pronounceWord(word) {
        if (voices.length === 0) {
            console.warn("No Russian voices available for pronunciation.");
            return;
        }
        console.log(`[pronounceWord] Phát âm: "${word}"`);
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'ru-RU';
        
        const ruVoice = voices.find(voice => voice.lang.startsWith('ru'));
        if (ruVoice) {
            utterance.voice = ruVoice;
        }
        utterance.rate = ttsRateSlider.value; 
        
        speechSynthesis.speak(utterance);
    }

    /**
     * Phát âm toàn bộ văn bản
     */
    function speak(text, startIndex = 0) {
        // ... (logic hàm này không đổi) ...
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

    // Tải danh sách giọng đọc
    populateVoiceList();
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = populateVoiceList;
    }

    // Sự kiện cho các nút TTS
    ttsPlayPauseBtn.addEventListener('click', () => {
        // ... (logic hàm này không đổi) ...
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
        // ... (logic hàm này không đổi) ...
        speechSynthesis.cancel();
        ttsProgressBar.style.width = '0%';
        speechStartIndex = 0;
        updatePlayPauseUI();
    });

    ttsRateSlider.addEventListener('input', (e) => {
        // ... (logic hàm này không đổi) ...
        const rate = parseFloat(e.target.value);
        ttsRateLabel.textContent = `${rate.toFixed(1)}x`;
        if (speechSynthesis.speaking && !speechSynthesis.paused) {
            const currentProgress = parseFloat(ttsProgressBar.style.width) || 0;
            const seekIndex = Math.floor((currentProgress / 100) * currentRawText.length);
            speak(currentRawText, seekIndex);
        }
    });

    ttsProgressContainer.addEventListener('click', (e) => {
        // ... (logic hàm này không đổi) ...
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

    // Sự kiện cho nút Thu gọn/Hiển thị
    document.querySelectorAll('.toggle-button').forEach(button => {
        button.addEventListener('click', () => {
            const content = button.closest('.section-header').nextElementSibling;
            content.classList.toggle('hidden');
            button.textContent = content.classList.contains('hidden') ? 'Hiển thị' : 'Thu gọn';
        });
    });

    /**
     * Logic `mouseup` (chỉ để mở)
     */
    document.addEventListener('mouseup', (e) => {
        console.log("[mouseup] Sự kiện mouseup kích hoạt.");
        
        // Dùng setTimeout 0 để đảm bảo trạng thái selection đã ổn định
        setTimeout(() => {
            console.log("[mouseup] setTimeout chạy.");
            
            if (justEndedDrag) {
                console.log("[mouseup] Bỏ qua: Vừa kéo thả.");
                return;
            }

            if (e.target.closest('#modal-content-inner, #selection-popup, #api-error-modal .modal-content')) {
                 console.log("[mouseup] Bỏ qua: Nhấp vào BÊN TRONG modal.");
                return;
            }

            if (e.target.closest('button, input, textarea, a, [type="range"]')) {
                 console.log("[mouseup] Bỏ qua: Nhấp vào phần tử UI.");
                return;
            }
            
            const selection = window.getSelection();
            if (!selection) {
                console.log("[mouseup] Bỏ qua: Không có selection.");
                return;
            }

            // Case 1: Text is SELECTED (bôi đen)
            if (!selection.isCollapsed && selection.toString().trim().length > 0) {
                console.log("[mouseup] Case 1: Đã bôi đen văn bản.");
                
                const selectedText = selection.toString().trim();
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                
                const cleanedText = selectedText.replace(/^[.,!?;:()"«»]+|[.,!?;:()"«»]+$/g, '');
                
                // MỚI: Kiểm tra xem có phải là văn bản tiếng Nga không
                const isRussianText = /[\u0400-\u04FF]/.test(cleanedText);
                console.log(`[mouseup] Văn bản đã chọn: "${selectedText}", đã làm sạch: "${cleanedText}", là tiếng Nga: ${isRussianText}`);
                
                // Tự động điền vào ô input
                aiCustomInput.value = cleanedText;

                if (isRussianText) {
                    // Hiển thị modal tra cứu ĐẦY ĐỦ cho BẤT KỲ văn bản tiếng Nga nào
                    console.log("[mouseup] -> Mở modal ĐẦY ĐỦ.");
                    selectionPopup.classList.add('hidden');
                    openLookupModal(cleanedText, rect);
                } else {
                    // Hiển thị modal ĐƠN GIẢN cho văn bản không phải tiếng Nga
                    console.log("[mouseup] -> Mở modal ĐƠN GIẢN.");
                    lookupModalOverlay.style.display = 'none';
                    openSelectionPopup(selectedText, rect);
                }
            } 
            // Case 2: It's a CLICK (no selection)
            else if (selection.isCollapsed) {
                console.log("[mouseup] Case 2: Đây là một cú nhấp chuột (không bôi đen).");
                const clickedWordElement = e.target.closest('.word-clickable');
                
                if (clickedWordElement) {
                    // Nhấp vào một từ có thể nhấp
                    const word = clickedWordElement.textContent.trim().replace(/^[.,!?;:()"«»]+|[.,!?;:()"«»]+$/g, '');
                    console.log(`[mouseup] -> Nhấp vào .word-clickable: "${word}"`);
                    if (word) {
                        aiCustomInput.value = word; // Tự động điền
                        const rect = clickedWordElement.getBoundingClientRect();
                        selectionPopup.classList.add('hidden');
                        openLookupModal(word, rect);
                    }
                } else {
                    // Nhấp vào không gian trống
                    console.log("[mouseup] -> Nhấp vào không gian trống. Đóng tất cả pop-up.");
                    lookupModalOverlay.style.display = 'none';
                    selectionPopup.classList.add('hidden');
                }
            }
        }, 0); 
    });
}

// Chạy ứng dụng khi trang đã tải xong
window.addEventListener('load', () => {
    console.log("Sự kiện 'load' của cửa sổ đã kích hoạt.");
    mainApp();
});
