// Main app initialization for index.html
document.addEventListener('DOMContentLoaded', async function() {
    console.log('App loaded, initializing...');
    
    // Initialize data
    try {
        await flashcardData.loadAllChapters();
        console.log('Chapters loaded:', flashcardData.chapters.length);
        // Recalculate progress statistics from current progress arrays to avoid stale totals
        flashcardData.updateStats();
        flashcardData.saveProgress();
        displayChapters();
        updateProgressSummary();
        
        // Set up export/import buttons
        document.getElementById('exportBtn').addEventListener('click', function() {
            flashcardData.exportProgress();
        });
        
        document.getElementById('importBtn').addEventListener('click', function() {
            document.getElementById('importFile').click();
        });
        
        document.getElementById('importFile').addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(event) {
                const success = flashcardData.importProgress(event.target.result);
                if (success) {
                    alert('Progress imported successfully!');
                    location.reload();
                } else {
                    alert('Failed to import progress. Please check the file format.');
                }
            };
            reader.readAsText(file);
            
            e.target.value = '';
        });
    } catch (error) {
        console.error('Error initializing app:', error);
        document.getElementById('chaptersContainer').innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error Loading App</h3>
                <p>${error.message}</p>
                <button onclick="location.reload()">Retry</button>
            </div>
        `;
    }
});

// Display all chapters in the grid
function displayChapters() {
    const container = document.getElementById('chaptersContainer');
    console.log('Displaying chapters:', flashcardData.chapters);
    
    if (!container) {
        console.error('Chapters container not found!');
        return;
    }
    
    if (flashcardData.chapters.length === 0) {
        container.innerHTML = '<p>No chapters loaded</p>';
        return;
    }
    
    container.innerHTML = '';

    // "Test All Chapters" card — always first
    const totalAll = flashcardData.progress.stats.totalWords || 0;
    const learnedAll = (flashcardData.progress.stats.learnedWords || 0) + (flashcardData.progress.stats.strongestWords || 0);
    const toLearnAll = Math.max(0, totalAll - learnedAll);

    const allCard = document.createElement('div');
    allCard.className = 'chapter-card';
    allCard.onclick = () => {
        localStorage.setItem('selectedChapter', 'all');
        window.location.href = 'level-select.html';
    };
    allCard.innerHTML = `
        <div class="chapter-image" style="background-image: url('data/images/cover.jpeg')">
            <div class="chapter-number">ALL</div>
        </div>
        <div class="chapter-info">
            <h3 class="chapter-title">All Chapters</h3>
            <div class="chapter-stats">
                <div class="stat">
                    <i class="fas fa-book"></i>
                    <span>To Learn: ${toLearnAll}</span>
                </div>
                <div class="stat">
                    <i class="fas fa-check-circle"></i>
                    <span>Learned: ${learnedAll}</span>
                </div>
            </div>
        </div>
    `;
    container.appendChild(allCard);

    flashcardData.chapters.forEach((chapter, index) => {
        const chapterNumber = index + 1;
        const progress = flashcardData.progress.chapters[chapterNumber] || {
            wordsToLearn: Array.from({length: chapter.words.length}, (_, i) => i),
            learnedWords: [],
            strongestWords: []
        };
        
        // Compute counts: total words in chapter, learned includes learned + strongest
        const totalCount = chapter.words.length;
        const learnedCount = (progress.learnedWords ? progress.learnedWords.length : 0) + (progress.strongestWords ? progress.strongestWords.length : 0);
        const toLearnCount = Math.max(0, totalCount - learnedCount);
        
        const chapterCard = document.createElement('div');
        chapterCard.className = 'chapter-card';
        chapterCard.onclick = () => selectChapter(chapterNumber);
        
        // Check if chapter has content
        const hasContent = chapter.words.length > 0;
        // Use background.png as a safe default placeholder image
        const imageUrl = (hasContent && chapter.image) ? chapter.image : 'data/images/background.png';
        
        // Build inner HTML, include Upload options when no words present
        chapterCard.innerHTML = `
            <div class="chapter-image" style="background-image: url('${imageUrl}')">
                <div class="chapter-number">${chapterNumber}</div>
                ${!hasContent ? '<div class="placeholder-overlay"><i class="fas fa-clock"></i> Coming Soon</div>' : ''}
            </div>
            <div class="chapter-info">
                <h3 class="chapter-title">${chapter.title || `Chapter ${chapterNumber}`}</h3>
                <div class="chapter-stats">
                    <div class="stat">
                        <i class="fas fa-book"></i>
                        <span>To Learn: ${toLearnCount}</span>
                    </div>
                    <div class="stat">
                        <i class="fas fa-check-circle"></i>
                        <span>Learned: ${learnedCount}</span>
                    </div>
                </div>
            </div>
        `;

        // If no words, append Upload controls inside the card
        if (!hasContent) {
            const uploadControls = document.createElement('div');
            uploadControls.style.padding = '12px';
            uploadControls.innerHTML = `
                <div style="display:flex;gap:8px;flex-direction:column;">
                    <button class="btn btn-play" data-chapter="${chapterNumber}" onclick="openUploadModal(${chapterNumber}, event)">Upload words</button>
                    <button class="btn-secondary" data-chapter="${chapterNumber}" onclick="triggerChapterFileUpload(${chapterNumber})">Upload file</button>
                </div>
            `;
            chapterCard.appendChild(uploadControls);
        }
        
        container.appendChild(chapterCard);
    });
}

// Open the upload modal for a chapter (only available when chapter has no words)
function openUploadModal(chapterNumber, e) {
    e && e.stopPropagation();
    const modal = document.getElementById('uploadModal');
    const title = document.getElementById('uploadModalTitle');
    const notice = document.getElementById('uploadNotice');
    const pasted = document.getElementById('pastedWords');
    const downloadBtn = document.getElementById('downloadGeneratedBtn');
    const proceedBtn = document.getElementById('proceedBtn');
    const feedback = document.getElementById('uploadFeedback');

    // reset fields
    pasted.value = '';
    feedback.style.display = 'none';
    downloadBtn.style.display = 'none';
    proceedBtn.style.display = 'none';

    const lang = flashcardData.getAppLang();
    title.textContent = `Upload words — Chapter ${chapterNumber} (${lang === 'es' ? 'Spanish' : 'German'})`;
    notice.textContent = 'Paste raw words and use AI to generate a chapter JSON, or upload a preformatted JSON file. This is saved locally on this device only.';

    modal.style.display = 'flex';

    // wire generate button
    document.getElementById('generateBtn').onclick = async function(ev) {
        ev && ev.preventDefault();
        feedback.style.display = 'none';
        const raw = pasted.value.trim();
        if (!raw) {
            feedback.style.display = 'block';
            feedback.textContent = 'Please paste words to generate.';
            return;
        }

        const lang = flashcardData.getAppLang();
        const langKey = (lang === 'es') ? 'spanish' : 'german';
        const chapterNum = chapterNumber;

        feedback.style.display = 'block';
        feedback.style.color = '#ffdede';
        feedback.textContent = 'Generating JSON via AI...';

        try {
            // call server proxy with structured payload so server can use OpenRouter key from .env
            const payload = {
                userWords: raw,
                chapterNumber: chapterNum,
                lang: langKey,
                model: 'stepfun/step-3.5-flash',
                max_tokens: 1600,
                temperature: 0.0
            };

            // callLlamaGenerate returns the full provider response object now
            const result = await callLlamaGenerate(payload);
            if (!result) throw new Error('No response from AI');

            // If server returned a checker result, use it to decide whether to show retry
            const aiText = result.text || (typeof result === 'string' ? result : null);
            const checker = result.checker || null;

            if (!aiText) {
                feedback.textContent = 'AI returned no text. Check server logs.';
                console.warn('AI raw response:', result.raw || result);
                return;
            }

            // Show preview (readonly) and allow Accept / Retry
            const previewContainer = document.getElementById('generatedPreviewContainer');
            const previewArea = document.getElementById('generatedPreview');
            const acceptBtn = document.getElementById('acceptGeneratedBtn');
            const retryBtn = document.getElementById('retryGenerationBtn');
            const downloadBtnEdited = document.getElementById('downloadEditedBtn');
            const downloadGeneratedBtnLocal = document.getElementById('downloadGeneratedBtn');

            // Populate preview
            previewArea.value = aiText;
            previewContainer.style.display = 'block';
            downloadGeneratedBtnLocal.style.display = 'inline-block';
            downloadBtnEdited.style.display = 'inline-block';

            // Show Accept/Retry depending on checker
            acceptBtn.style.display = 'inline-block';
            retryBtn.style.display = 'inline-block';

            // If checker exists and says invalid, highlight feedback
            if (checker && checker.valid === false) {
                feedback.style.color = '#ffdede';
                feedback.textContent = 'AI output failed validation. Review the preview or press Retry to try again.';
            } else {
                feedback.style.color = '#c8ffd1';
                feedback.textContent = 'AI generated JSON. Please review the preview and Accept to save.';
            }

            // wire accept button: parse and save locally under language-specific key
            acceptBtn.onclick = function() {
                try {
                    const parsed = JSON.parse(previewArea.value);
                    let chapterObj;
                    if (Array.isArray(parsed)) {
                        chapterObj = { chapter: chapterNum, title: `Chapter ${chapterNum}`, words: parsed };
                    } else if (parsed.words && Array.isArray(parsed.words)) {
                        chapterObj = parsed;
                    } else {
                        alert('Generated JSON is not in expected chapter structure. Please retry.');
                        return;
                    }
                    const key = `localChapter_${flashcardData.getAppLang()}_${chapterNum}`;
                    localStorage.setItem(key, JSON.stringify(chapterObj));
                    feedback.style.color = '#c8ffd1';
                    feedback.textContent = 'Generated chapter saved locally.';

                    // make proceed button visible in modal
                    downloadGeneratedBtnLocal.style.display = 'inline-block';
                    proceedBtn.style.display = 'inline-block';

                    // store preview in generatedPreview (non-editable) for user's final view
                    document.getElementById('generatedPreview').value = JSON.stringify(chapterObj, null, 2);

                    // refresh chapters in UI
                    flashcardData.loadAllChapters().then(() => { displayChapters(); updateProgressSummary(); });
                } catch (err) {
                    alert('Generated output is not valid JSON. Please Retry.');
                }
            };

            // wire retry button: call generation again with slightly higher temperature
            retryBtn.onclick = async function() {
                feedback.style.display = 'block';
                feedback.style.color = '#ffdede';
                feedback.textContent = 'Retrying generation (higher creativity)...';
                // request with a bit higher temperature
                const retryPayload = Object.assign({}, payload, { temperature: 0.25 });
                const retryResult = await callLlamaGenerate(retryPayload);
                if (!retryResult) {
                    feedback.textContent = 'Retry failed: no response.';
                    return;
                }
                const retryText = retryResult.text || (typeof retryResult === 'string' ? retryResult : null);
                if (retryText) {
                    previewArea.value = retryText;
                    feedback.style.color = '#c8ffd1';
                    feedback.textContent = 'New generation ready. Review and Accept.';
                } else {
                    feedback.style.color = '#ffdede';
                    feedback.textContent = 'Retry failed. Check server logs.';
                }
            };

            // wire download buttons
            downloadGeneratedBtnLocal.onclick = function() {
                const blob = new Blob([aiText], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `chapter${chapterNum}-${flashcardData.getAppLang()}.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            };

            downloadBtnEdited.onclick = function() {
                const text = document.getElementById('generatedPreview').value;
                const blob = new Blob([text], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `chapter${chapterNum}-${flashcardData.getAppLang()}-preview.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            };

            // wire proceed button (same as before)
            proceedBtn.onclick = function() {
                try {
                    const edited = JSON.parse(document.getElementById('generatedPreview').value);
                    const key = `localChapter_${flashcardData.getAppLang()}_${chapterNum}`;
                    localStorage.setItem(key, JSON.stringify(edited));
                    localStorage.setItem('chapterData', JSON.stringify(edited));
                    localStorage.setItem('selectedChapter', chapterNum);
                    modal.style.display = 'none';
                    window.location.href = 'level-select.html';
                } catch (err) {
                    alert('Preview content is not valid JSON. Cannot proceed.');
                }
            };

        } catch (err) {
            console.error('AI generation failed:', err);
            feedback.style.color = '#ffdede';
            feedback.textContent = 'AI generation failed. Please check server configuration.';
        }
    };

    // wire close button
    document.getElementById('closeUploadModal').onclick = function() {
        modal.style.display = 'none';
    };
}

let pendingUploadChapter = null;

// Trigger file input to upload a preformatted chapter JSON
function triggerChapterFileUpload(chapterNumber) {
    const input = document.getElementById('uploadChapterFile');
    input.dataset.chapter = String(chapterNumber);
    // store as fallback in case dataset is lost
    pendingUploadChapter = Number(chapterNumber);
    input.click();
}

// Handle uploaded chapter JSON file
document.getElementById('uploadChapterFile').addEventListener('change', function(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    // fallback to pendingUploadChapter if dataset.chapter missing
    const chapterNumber = Number(e.target.dataset.chapter || pendingUploadChapter || 0);
    reader.onload = function(ev) {
        try {
            const parsed = JSON.parse(ev.target.result);
            const valid = validateChapterJson(parsed, chapterNumber);
            if (!valid) {
                alert('Uploaded file is not in the expected chapter JSON format. Please provide a correctly structured file.');
                return;
            }
            // Save locally
            const key = `localChapter_${flashcardData.getAppLang()}_${chapterNumber}`;
            localStorage.setItem(key, JSON.stringify(parsed));
            alert('Chapter file uploaded and saved locally. Remember to download it for backup if you need it elsewhere.');
            // reload chapters so UI updates
            flashcardData.loadAllChapters().then(() => { displayChapters(); updateProgressSummary(); });
        } catch (err) {
            console.error('Upload parse error', err);
            alert('Error parsing uploaded file. Make sure it is valid JSON.');
        }
    };
    reader.readAsText(file);
    // clear input
    e.target.value = '';
});

// Basic validation for uploaded/generated chapter JSON
function validateChapterJson(obj, expectedChapterNumber) {
    if (!obj) return false;
    // Accept either a full chapter object with words array, or an array of word objects
    if (Array.isArray(obj)) {
        // ensure each entry has at least english and the language key
        return obj.every(entry => (typeof entry === 'object') && ('english' in entry) && (('german' in entry) || ('spanish' in entry)));
    }
    if (typeof obj === 'object') {
        if (!Array.isArray(obj.words)) return false;
        // optional chapter number check
        if (expectedChapterNumber && obj.chapter && Number(obj.chapter) !== Number(expectedChapterNumber)) {
            // still accept but warn
            console.warn('Uploaded chapter number differs from target chapter number');
        }
        return obj.words.every(entry => (typeof entry === 'object') && ('english' in entry) && (('german' in entry) || ('spanish' in entry)));
    }
    return false;
}

// Attempt to call a configured Llama API endpoint; expects window.LLAMA_API_URL and window.LLAMA_API_KEY to be set by deployer
async function callLlamaGenerate(payload) {
    // payload can be a string (systemPrompt) or an object { userWords, chapterNumber, lang }
    // Use server endpoint; allow override via window.AI_API_URL for flexibility
    const proxyUrl = window.AI_API_URL || '/api/generate';

    if (!proxyUrl) {
        console.warn('No LLAMA_API_URL configured. AI generation disabled.');
        return null;
    }

    try {
        let bodyToSend;
        if (typeof payload === 'string') {
            bodyToSend = { prompt: payload, model: window.LLAMA_MODEL || 'llama-3.1-instruct', max_tokens: 1200, temperature: 0.2 };
        } else if (typeof payload === 'object') {
            bodyToSend = { userWords: payload.userWords, chapterNumber: payload.chapterNumber, lang: payload.lang || 'de', model: window.LLAMA_MODEL || 'llama-3.1-instruct', max_tokens: 1200, temperature: payload.temperature || 0.2 };
        } else {
            throw new Error('Invalid payload for callLlamaGenerate');
        }

        // Do not send API keys from the frontend. The server will apply its own authorization.
        const headers = { 'Content-Type': 'application/json' };

        const resp = await fetch(proxyUrl, { method: 'POST', headers, body: JSON.stringify(bodyToSend) });
        if (!resp.ok) throw new Error(`AI API responded ${resp.status}`);
        const data = await resp.json();
        // expect { success: true, text: '...' } or provider-specific passthrough
        if (data.text) return data.text;
        if (data.output) return data.output;
        if (data.result) return data.result;
        // fallback to the whole response
        return JSON.stringify(data);
    } catch (err) {
        console.error('AI API call failed', err);
        return null;
    }
}

// Navigate to level selection for a chapter
function selectChapter(chapterNumber) {
    console.log('Selecting chapter:', chapterNumber);
    const chapter = flashcardData.chapters[chapterNumber - 1];
    if (!chapter) return;
    
    // Initialize progress for this chapter if needed
    flashcardData.initChapterProgress(chapterNumber, chapter.words.length);
    
    // Store selected chapter
    localStorage.setItem('selectedChapter', chapterNumber);
    window.location.href = 'level-select.html';
}

// Update the progress summary at the bottom
function updateProgressSummary() {
    document.getElementById('totalWords').textContent = flashcardData.progress.stats.totalWords;
    document.getElementById('learnedWords').textContent = flashcardData.progress.stats.learnedWords;
    document.getElementById('chaptersCount').textContent = 
        `${flashcardData.chapters.filter(c => c.words.length > 0).length}/17`;
}
