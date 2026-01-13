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
        
        container.appendChild(chapterCard);
    });
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
