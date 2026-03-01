// Level selection page logic
document.addEventListener('DOMContentLoaded', async function() {
    const sel = localStorage.getItem('selectedChapter') || '1';
    const chapterNumber = (sel === 'all') ? 'all' : (parseInt(sel) || 1);
    await loadChapterData(chapterNumber);
    setupEventListeners();
});

async function loadChapterData(chapterNumber) {
    // Load chapter data (support aggregated 'all' chapters)
    let chapter = null;
    if (chapterNumber === 'all') {
        // build aggregated chapter object with original mapping
        const combined = [];
        // ensure chapters are loaded
        if (!Array.isArray(flashcardData.chapters) || flashcardData.chapters.length === 0) {
            await flashcardData.loadAllChapters();
        }
        flashcardData.chapters.forEach((ch, index) => {
            const chNum = (ch && ch.chapter) ? Number(ch.chapter) : (index + 1);
            // ensure per-chapter progress exists
            flashcardData.initChapterProgress(chNum, Array.isArray(ch.words) ? ch.words.length : 0);
            if (Array.isArray(ch.words)) {
                ch.words.forEach((w, idx) => {
                    // preserve original fields and attach metadata
                    combined.push(Object.assign({}, w, { originalChapter: chNum, originalIndex: idx }));
                });
            }
        });
        chapter = { chapter: 'all', title: 'All Chapters', words: combined, image: 'data/images/background.png' };
    } else {
        // single chapter
        chapter = flashcardData.chapters[chapterNumber - 1] || await flashcardData.loadChapter(chapterNumber);
        if (!chapter) return;
    }
    
    // Update UI with chapter info
    document.getElementById('chapterTitle').textContent = chapter.title || `Chapter ${chapterNumber}`;
    document.getElementById('chapterSubtitle').textContent = `Choose your learning mode`;
    
    // Set chapter image
    const imageContainer = document.getElementById('chapterImage');
    const imageUrl = chapter.words.length > 0 && chapter.image ? 
                    chapter.image : 'data/images/placeholder.jpg';
    imageContainer.style.backgroundImage = `url('${imageUrl}')`;
    
    // Initialize progress and compute statistics
    let totalCount = chapter.words.length;
    let learnedCount = 0;
    let masteredCount = 0;
    let toLearnCount = 0;

    if (chapterNumber === 'all') {
        // Sum per-chapter stats
        flashcardData.chapters.forEach((ch, idx) => {
            const chNum = (ch && ch.chapter) ? Number(ch.chapter) : (idx + 1);
            flashcardData.initChapterProgress(chNum, Array.isArray(ch.words) ? ch.words.length : 0);
            const p = flashcardData.progress.chapters[chNum] || { learnedWords: [], strongestWords: [] };
            learnedCount += (p.learnedWords ? p.learnedWords.length : 0);
            masteredCount += (p.strongestWords ? p.strongestWords.length : 0);
        });
        toLearnCount = Math.max(0, totalCount - learnedCount);
    } else {
        // single chapter progress
        flashcardData.initChapterProgress(chapterNumber, chapter.words.length);
        const progress = flashcardData.progress.chapters[chapterNumber];
        learnedCount = (progress.learnedWords ? progress.learnedWords.length : 0) + (progress.strongestWords ? progress.strongestWords.length : 0);
        masteredCount = (progress.strongestWords ? progress.strongestWords.length : 0);
        toLearnCount = Math.max(0, totalCount - learnedCount);
    }
    
    // Update statistics (per-chapter)
    document.getElementById('wordsToLearn').textContent = toLearnCount;
    document.getElementById('learnedWords').textContent = learnedCount;
    document.getElementById('masteredWords').textContent = masteredCount;
    document.getElementById('totalWords').textContent = totalCount;
    
    // Update level counts: Level 1 should always show total words; Level 2 shows learned (including mastered); Level 3 shows mastered
    document.getElementById('level1Count').textContent = totalCount;
    document.getElementById('level2Count').textContent = learnedCount;
    document.getElementById('level3Count').textContent = masteredCount;

    // Update Familiarise count (remaining in pool)
    const famCountElem = document.getElementById('famCount');
    if (famCountElem) {
        if (chapterNumber === 'all') {
            // sum familiarise pool sizes across chapters
            let sum = 0;
            flashcardData.chapters.forEach((ch, idx) => {
                const chNum = (ch && ch.chapter) ? Number(ch.chapter) : (idx + 1);
                const pool = flashcardData.getFamiliarisePool(chNum) || [];
                sum += pool.length;
            });
            famCountElem.textContent = sum;
        } else {
            const famPool = flashcardData.getFamiliarisePool(chapterNumber) || [];
            famCountElem.textContent = famPool.length;
        }
    }

    // Store chapter data for game session
    localStorage.setItem('currentChapter', chapterNumber);
    localStorage.setItem('chapterData', JSON.stringify(chapter));

    // Adjust UI text for Spanish language: replace instances of 'German' with 'Spanish' in descriptions/title
    (function() {
        const appLang = (flashcardData && flashcardData.getAppLang) ? flashcardData.getAppLang() : (window.APP_LANG || localStorage.getItem('appLanguage'));
        if (appLang === 'es') {
            // Update document title if it mentions German
            try {
                if (document && document.title) document.title = document.title.replace(/German/gi, 'Spanish');
            } catch (e) { /* ignore */ }

            // Familiarise card: English → Spanish
            const famDesc = document.querySelector('.familiarise-card .level-description');
            if (famDesc) famDesc.innerHTML = 'English → Spanish<br>Learn new words with multiple choice';

            // Level 1: Spanish → English
            const l1Desc = document.querySelector('.level-card[data-level="1"] .level-description');
            if (l1Desc) l1Desc.innerHTML = 'Spanish → English<br>Learn new words with clues';

            // Level 2: English → Spanish
            const l2Desc = document.querySelector('.level-card[data-level="2"] .level-description');
            if (l2Desc) l2Desc.innerHTML = 'English → Spanish<br>Test your memory';

            // Optionally adjust other UI labels that may include 'German'
            const headerTitle = document.getElementById('chapterSubtitle');
            if (headerTitle && /German/i.test(headerTitle.textContent)) {
                headerTitle.textContent = headerTitle.textContent.replace(/German/gi, 'Spanish');
            }
        }
    })();
}

function setupEventListeners() {
    // Card count input
    const cardCountInput = document.getElementById('cardCount');
    cardCountInput.addEventListener('change', function() {
        const max = parseInt(document.getElementById('totalWords').textContent);
        if (this.value > max) this.value = max;
        if (this.value < 1) this.value = 1;
    });
    
    // Back button
    document.querySelector('.back-btn').addEventListener('click', function(e) {
        e.preventDefault();
        window.location.href = 'index.html';
    });
}

function changeCardCount(amount) {
    const input = document.getElementById('cardCount');
    const max = parseInt(document.getElementById('totalWords').textContent);
    let newValue = parseInt(input.value) + amount;
    
    if (newValue < 1) newValue = 1;
    if (newValue > max) newValue = max;
    
    input.value = newValue;
}

function startLevel(level) {
    const chapterNumber = parseInt(localStorage.getItem('currentChapter'));
    const cardCount = parseInt(document.getElementById('cardCount').value);
    
    // For level 1, get the session mode
    let sessionMode = 'mix';
    if (level === 1) {
        sessionMode = document.getElementById('sessionMode').value;
    }
    
    // Store session settings
    localStorage.setItem('gameLevel', level);
    localStorage.setItem('cardCount', cardCount);
    localStorage.setItem('sessionMode', sessionMode);
    
    // Navigate to game
    window.location.href = 'game.html';
}

// Start the Familiarise multiple-choice game
function startFamiliarise() {
    const chapterNumber = parseInt(localStorage.getItem('currentChapter')) || 1;
    // Ensure familiarise pool exists
    const chapter = flashcardData.chapters[chapterNumber - 1] || null;
    const wordCount = chapter && Array.isArray(chapter.words) ? chapter.words.length : 0;
    flashcardData.initFamiliariseChapter(chapterNumber, wordCount);

    // read card count from UI (same control used for other levels)
    const cardCount = parseInt(document.getElementById('cardCount')?.value) || 10;
    localStorage.setItem('famCardCount', String(cardCount));

    // set a special level marker and navigate
    localStorage.setItem('gameLevel', 'familiarise');
    window.location.href = 'familiarise.html';
}

// Reset familiarise pool for the current chapter (called from level-select UI)
function resetFamiliarisePoolFromLevel() {
    const chapterNumber = parseInt(localStorage.getItem('currentChapter')) || 1;
    const chapter = flashcardData.chapters[chapterNumber - 1] || null;
    const wordCount = chapter && Array.isArray(chapter.words) ? chapter.words.length : 0;
    if (!flashcardData.progress.familiarise) flashcardData.progress.familiarise = {};
    flashcardData.progress.familiarise[chapterNumber] = Array.from({length: wordCount}, (_, i) => i);
    flashcardData.saveProgress();
    // update UI count immediately
    const famCountElem = document.getElementById('famCount');
    if (famCountElem) famCountElem.textContent = (flashcardData.getFamiliarisePool(chapterNumber) || []).length;
}