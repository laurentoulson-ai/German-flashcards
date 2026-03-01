// Game session logic
class GameSession {
    constructor() {
        this.currentCardIndex = 0;
        this.correctAnswers = 0;
        this.wrongAnswers = 0;
        this.sessionWords = [];
        this.answeredWords = new Map(); // word index -> isCorrect
        this.isFlipped = false;
        this.clueShown = false;
        
        // Get session settings
        // Keep raw chapter identifier (can be 'all' or numeric string)
        this.chapterNumber = localStorage.getItem('currentChapter') || '1';
        this.level = parseInt(localStorage.getItem('gameLevel')) || 1;
        // New defaults: 20 cards and weak mode
        this.cardCount = parseInt(localStorage.getItem('cardCount')) || 20;
        this.sessionMode = localStorage.getItem('sessionMode') || 'weak';
        
        // Get chapter data
        const chapterData = JSON.parse(localStorage.getItem('chapterData'));
        this.chapterTitle = chapterData?.title || `Chapter ${this.chapterNumber}`;

        // Determine language key for this session (spanish or german)
        this.langKey = (flashcardData.getAppLang && flashcardData.getAppLang() === 'es') ? 'spanish' : 'german';
        this.langName = (this.langKey === 'spanish') ? 'SPANISH' : 'GERMAN';
        
        this.init();
    }
    
    async init() {
        await this.loadSessionWords();

        // Debug logging to help track values that affect session size and remaining cards
        console.log('Game init — chapter:', this.chapterNumber, 'level:', this.level, 'requested cardCount:', this.cardCount, 'mode:', this.sessionMode);
        console.log('Session words loaded:', this.sessionWords.length);

        // Ensure event listeners (back buttons etc.) are always registered so navigation works even when
        // there are no words available for the session.
        this.setupEventListeners();

        // If we have words available, cap the desired cardCount to the actual available words
        if (this.sessionWords && this.sessionWords.length > 0) {
            this.cardCount = Math.min(this.cardCount, this.sessionWords.length);
            // Reflect the chosen count in localStorage so subsequent loads are consistent
            localStorage.setItem('cardCount', this.cardCount);
        }

        // If no words were selected for the session, show the empty state and stop further setup.
        if (!this.sessionWords || this.sessionWords.length === 0) {
            this.showNoWordsMessage();
            this.updateProgressDisplay();
            return;
        }

        this.setupUI();
        this.displayCurrentCard();
        this.updateProgressDisplay();
    }
    
    async loadSessionWords() {
        this.sessionWords = flashcardData.getSessionWords(
            this.chapterNumber,
            this.level,
            this.cardCount,
            this.sessionMode
        );
        
        // Shuffle the words
        this.sessionWords = this.shuffleArray(this.sessionWords);
        
        // Note: do not call showNoWordsMessage() here any more; init() handles the empty case after
        // event listeners are set up so navigation works.
    }
    
    setupUI() {
        // Set chapter title and level
        document.getElementById('gameChapter').textContent = this.chapterTitle;
        
        // Set level badge
        const levelBadge = document.getElementById('levelBadge');
        levelBadge.innerHTML = `
            <i class="fas fa-${this.getLevelIcon()}"></i>
            <span>Level ${this.level}</span>
        `;
        levelBadge.className = `level-badge level-${this.level}`;
        
        // Update total cards
        document.getElementById('totalCards').textContent = this.sessionWords.length;
        
        // Show/hide clue button based on level
        const clueBtn = document.getElementById('clueBtn');
        if (this.level === 2 || this.level === 3) {
            clueBtn.style.display = 'none';
        } else {
            clueBtn.style.display = '';
        }
    }
    
    getLevelIcon() {
        switch(this.level) {
            case 1: return 'graduation-cap';
            case 2: return 'brain';
            case 3: return 'star';
            default: return 'question-circle';
        }
    }
    
    displayCurrentCard() {
        if (this.currentCardIndex >= this.sessionWords.length) {
            this.endSession();
            return;
        }
        
        const currentWord = this.sessionWords[this.currentCardIndex];
        this.clueShown = false;
        this.isFlipped = false;
        
        // Reset card to front
        document.getElementById('flashcard').classList.remove('flipped');
        document.getElementById('clueText').classList.remove('shown');
        document.getElementById('clueText').innerHTML = '';
        
        // Update card position
        document.getElementById('cardPosition').textContent = this.currentCardIndex + 1;
        
        // Set word based on level
        if (this.level === 1) {
            // Level 1: target language word on front
            document.getElementById('currentWord').textContent = currentWord[this.langKey];
            document.getElementById('currentTranslation').textContent = currentWord.english;
            document.querySelector('.card-front .card-label').textContent = this.langName;
            document.querySelector('.card-back .card-label').textContent = 'ENGLISH';
        } else if (this.level === 2) {
            // Level 2: English word on front
            document.getElementById('currentWord').textContent = currentWord.english;
            document.getElementById('currentTranslation').textContent = currentWord[this.langKey];
            document.querySelector('.card-front .card-label').textContent = 'ENGLISH';
            document.querySelector('.card-back .card-label').textContent = this.langName;
        } else if (this.level === 3) {
            // Level 3: Sentence with blank on front
            const clue = currentWord.clue || '';
            const targetWord = currentWord[this.langKey] || '';
            const englishWord = currentWord.english || '';

            // Create sentence with blank replaced by the English translation to give a clearer cue
            let sentenceWithBlank = clue;
            // Try to find and replace the target language word in the clue (word boundaries)
            const regex = new RegExp(`\\b${escapeRegExp(targetWord)}\\b`, 'i');
            if (regex.test(clue)) {
                // replace the target word with a styled span that contains the English translation
                sentenceWithBlank = clue.replace(regex, `<span class="filled-blank">${englishWord}</span>`);
            } else {
                // If the target word is not directly in the clue, append the English translation as a hint
                sentenceWithBlank = `${clue} <span class="filled-blank">(${englishWord})</span>`;
            }

            document.getElementById('currentWord').innerHTML = `
                <div class="sentence-blank">${sentenceWithBlank}</div>
            `;
            document.getElementById('currentTranslation').textContent = targetWord;
            document.querySelector('.card-front .card-label').textContent = 'COMPLETE THE SENTENCE';
            document.querySelector('.card-back .card-label').textContent = 'CORRECT WORD';
        }
        
        // Set clue text on back
        document.getElementById('backClueText').textContent = currentWord.clue;
        
        // Update hint text
        const hintText = document.getElementById('hintText');
        if (this.level === 1) {
            hintText.textContent = 'Tap to reveal translation';
        } else if (this.level === 2) {
            hintText.textContent = `Tap to reveal ${this.langName.toLowerCase()} word`;
        } else {
            hintText.textContent = 'Tap to reveal missing word';
        }
    }
    
    setupEventListeners() {
        // Flip card on click
        document.getElementById('flashcard').addEventListener('click', (e) => {
            if (!e.target.closest('.btn-clue')) {
                this.flipCard();
            }
        });
        
        // Flip button
        document.getElementById('flipBtn').addEventListener('click', () => this.flipCard());
        
        // Answer buttons
        document.getElementById('correctBtn').addEventListener('click', () => this.answerCard(true));
        document.getElementById('wrongBtn').addEventListener('click', () => this.answerCard(false));
        
        // Clue button
        document.getElementById('clueBtn').addEventListener('click', () => this.showClue());
        
        // Back button
        document.getElementById('backBtn').addEventListener('click', () => {
            if (confirm('Are you sure you want to end this session? Your progress will be saved.')) {
                this.saveProgress();
                window.location.href = 'level-select.html';
            }
        });
        
        // Session complete modal buttons
        document.getElementById('practiceAgainBtn').addEventListener('click', () => {
            location.reload();
        });
        
        document.getElementById('backToLevelsBtn').addEventListener('click', () => {
            window.location.href = 'level-select.html';
        });
        
        document.getElementById('backToChaptersBtn').addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
    
    flipCard() {
        const flashcard = document.getElementById('flashcard');
        this.isFlipped = !this.isFlipped;
        flashcard.classList.toggle('flipped');
    }
    
    showClue() {
        if (this.clueShown || this.level !== 1) return;
        
        const currentWord = this.sessionWords[this.currentCardIndex];
        const clueText = document.getElementById('clueText');
        
        clueText.innerHTML = `
            <i class="fas fa-quote-left"></i>
            ${currentWord.clue}
            <i class="fas fa-quote-right"></i>
        `;
        clueText.classList.add('shown');
        this.clueShown = true;
    }
    
    answerCard(isCorrect) {
        const currentWord = this.sessionWords[this.currentCardIndex];
        
        // Record answer
        this.answeredWords.set(currentWord.index, isCorrect);
        
        // Update counters
        if (isCorrect) {
            this.correctAnswers++;
        } else {
            this.wrongAnswers++;
        }
        
        // Update progress display
        this.updateProgressDisplay();
        
        // Move to next card
        this.currentCardIndex++;
        
        // If there are more cards, display next one
        if (this.currentCardIndex < this.sessionWords.length) {
            setTimeout(() => {
                this.displayCurrentCard();
            }, 300);
        } else {
            // End session
            setTimeout(() => {
                this.endSession();
            }, 500);
        }
    }
    
    updateProgressDisplay() {
        const remaining = this.sessionWords.length - this.currentCardIndex;
        document.getElementById('cardsRemaining').textContent = remaining;
        document.getElementById('correctCount').textContent = this.correctAnswers;
        document.getElementById('wrongCount').textContent = this.wrongAnswers;
    }
    
    async endSession() {
        // Save progress for all answered words
        for (const [wordIndex, isCorrect] of this.answeredWords.entries()) {
            // Find the session word object for this index
            const sessionWord = this.sessionWords.find(w => Number(w.index) === Number(wordIndex));
            if (sessionWord && sessionWord.originalChapter && (sessionWord.originalIndex !== undefined)) {
                // Update progress for the original chapter/word index
                flashcardData.updateWordStatus(
                    Number(sessionWord.originalChapter),
                    Number(sessionWord.originalIndex),
                    this.level,
                    isCorrect
                );
            } else {
                // Fallback to current chapter session (single-chapter session)
                flashcardData.updateWordStatus(
                    this.chapterNumber,
                    Number(wordIndex),
                    this.level,
                    isCorrect
                );
            }
        }
         
        // Save to localStorage
        flashcardData.saveProgress();
        
        // Calculate results
        const totalCards = this.sessionWords.length;
        const accuracy = totalCards > 0 ? Math.round((this.correctAnswers / totalCards) * 100) : 0;
        
        // Update results modal
        document.getElementById('resultTotal').textContent = totalCards;
        document.getElementById('resultCorrect').textContent = this.correctAnswers;
        document.getElementById('resultWrong').textContent = this.wrongAnswers;
        document.getElementById('resultAccuracy').textContent = `${accuracy}%`;
        
        // Update progress text
        const progressText = document.getElementById('progressUpdateText');
        let updateText = '';
        
        if (this.level === 1) {
            const newLearned = Array.from(this.answeredWords.values()).filter(v => v).length;
            updateText = `You learned ${newLearned} new words!`;
        } else if (this.level === 2) {
            const mastered = Array.from(this.answeredWords.values()).filter(v => v).length;
            updateText = `You mastered ${mastered} words!`;
        } else {
            const strengthened = Array.from(this.answeredWords.values()).filter(v => v).length;
            updateText = `You strengthened ${strengthened} words!`;
        }
        
        progressText.textContent = updateText;
        
        // Show modal
        document.getElementById('sessionCompleteModal').style.display = 'flex';
    }
    
    saveProgress() {
        // Save any answered words before leaving. Map answers back to original chapter if needed.
        for (const [wordIndex, isCorrect] of this.answeredWords.entries()) {
            const sessionWord = this.sessionWords.find(w => Number(w.index) === Number(wordIndex));
            if (sessionWord && sessionWord.originalChapter && (sessionWord.originalIndex !== undefined)) {
                flashcardData.updateWordStatus(Number(sessionWord.originalChapter), Number(sessionWord.originalIndex), this.level, isCorrect);
            } else {
                flashcardData.updateWordStatus(this.chapterNumber, Number(wordIndex), this.level, isCorrect);
            }
        }
        flashcardData.saveProgress();
    }
    
    showNoWordsMessage() {
        document.querySelector('.flashcard-container').innerHTML = `
            <div class="no-words-message">
                <i class="fas fa-book-open"></i>
                <h3>No words available</h3>
                <p>There are no words available for this level and mode.</p>
                <button class="btn" onclick="window.location.href='level-select.html'">
                    <i class="fas fa-arrow-left"></i>
                    Back to Level Select
                </button>
            </div>
        `;
        document.querySelector('.answer-buttons').style.display = 'none';
    }
    
    shuffleArray(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }
}

// utility to escape regex special chars
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.gameSession = new GameSession();
});