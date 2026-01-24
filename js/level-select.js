// Level selection page logic
document.addEventListener('DOMContentLoaded', async function() {
    const chapterNumber = parseInt(localStorage.getItem('selectedChapter')) || 1;
    await loadChapterData(chapterNumber);
    setupEventListeners();
});

async function loadChapterData(chapterNumber) {
    // Load chapter data
    const chapter = flashcardData.chapters[chapterNumber - 1] || 
                   await flashcardData.loadChapter(chapterNumber);
    
    if (!chapter) return;
    
    // Update UI with chapter info
    document.getElementById('chapterTitle').textContent = chapter.title || `Chapter ${chapterNumber}`;
    document.getElementById('chapterSubtitle').textContent = `Choose your learning mode`;
    
    // Set chapter image
    const imageContainer = document.getElementById('chapterImage');
    const imageUrl = chapter.words.length > 0 && chapter.image ? 
                    chapter.image : 'data/images/placeholder.jpg';
    imageContainer.style.backgroundImage = `url('${imageUrl}')`;
    
    // Initialize progress for this chapter
    flashcardData.initChapterProgress(chapterNumber, chapter.words.length);
    const progress = flashcardData.progress.chapters[chapterNumber];
    
    // Compute learned (includes strongest/mastered words)
    const learnedCount = (progress.learnedWords ? progress.learnedWords.length : 0) + (progress.strongestWords ? progress.strongestWords.length : 0);
    const masteredCount = (progress.strongestWords ? progress.strongestWords.length : 0);
    const totalCount = chapter.words.length;
    const toLearnCount = Math.max(0, totalCount - learnedCount);
    
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
    const famPool = flashcardData.getFamiliarisePool(chapterNumber) || [];
    const famCountElem = document.getElementById('famCount');
    if (famCountElem) famCountElem.textContent = famPool.length;

    // Store chapter data for game session
    localStorage.setItem('currentChapter', chapterNumber);
    localStorage.setItem('chapterData', JSON.stringify(chapter));
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