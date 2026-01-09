// Data management for German Flashcards
class FlashcardData {
    constructor() {
        this.chapters = [];
        this.progress = this.loadProgress();
        this.currentChapter = null;
        this.currentLevel = 1;
    }
    
    // Load chapter data from JSON files
    async loadChapter(chapterNumber) {
        try {
            const response = await fetch(`data/chapters/chapter${chapterNumber}.json`);
            if (!response.ok) {
                // Create placeholder if chapter doesn't exist yet
                return {
                    chapter: chapterNumber,
                    title: `Chapter ${chapterNumber}`,
                    words: [],
                    image: "data/images/placeholder.jpg"
                };
            }
            return await response.json();
        } catch (error) {
            console.error(`Error loading chapter ${chapterNumber}:`, error);
            return this.createPlaceholderChapter(chapterNumber);
        }
    }
    
    createPlaceholderChapter(number) {
        return {
            chapter: number,
            title: `Chapter ${number}`,
            words: [],
            image: "data/images/placeholder.jpg"
        };
    }
    
    // Load all chapters (up to 17)
    async loadAllChapters() {
        const chapterPromises = [];
        for (let i = 1; i <= 17; i++) {
            chapterPromises.push(this.loadChapter(i));
        }
        
        this.chapters = await Promise.all(chapterPromises);
        return this.chapters;
    }
    
    // Progress management
    loadProgress() {
        const saved = localStorage.getItem('germanFlashcardsProgress');
        if (saved) {
            return JSON.parse(saved);
        }
        
        // Initialize empty progress
        return {
            chapters: {},
            stats: {
                totalWords: 0,
                learnedWords: 0,
                strongestWords: 0
            }
        };
    }
    
    saveProgress() {
        localStorage.setItem('germanFlashcardsProgress', JSON.stringify(this.progress));
    }
    
    // Initialize progress for a chapter if it doesn't exist
    initChapterProgress(chapterNumber, wordCount) {
        if (!this.progress.chapters[chapterNumber]) {
            this.progress.chapters[chapterNumber] = {
                wordsToLearn: Array.from({length: wordCount}, (_, i) => i), // All word indices
                learnedWords: [],
                strongestWords: []
            };
            this.updateStats();
            this.saveProgress();
        }
    }
    
    updateStats() {
        let total = 0;
        let learned = 0;
        let strongest = 0;
        
        Object.values(this.progress.chapters).forEach(chapter => {
            total += chapter.wordsToLearn.length + chapter.learnedWords.length + chapter.strongestWords.length;
            learned += chapter.learnedWords.length;
            strongest += chapter.strongestWords.length;
        });
        
        this.progress.stats = { totalWords: total, learnedWords: learned, strongestWords: strongest };
    }
    
    // Get words for a session
    getSessionWords(chapterNumber, level, count, mode = 'mix') {
        const chapter = this.chapters.find(c => c.chapter === chapterNumber);
        const progress = this.progress.chapters[chapterNumber];
        
        if (!chapter || !progress) return [];
        
        let wordPool = [];
        
        if (level === 1) {
            // Level 1: Only wordsToLearn
            if (mode === 'weak') {
                wordPool = progress.wordsToLearn;
            } else if (mode === 'consolidate') {
                wordPool = progress.learnedWords;
            } else {
                wordPool = [...progress.wordsToLearn, ...progress.learnedWords];
            }
        } else if (level === 2) {
            // Level 2: Only learnedWords and strongestWords
            wordPool = [...progress.learnedWords, ...progress.strongestWords];
        } else if (level === 3) {
            // Level 3: Only strongestWords
            wordPool = progress.strongestWords;
        }
        
        // Shuffle and select limited number
        const shuffled = this.shuffleArray([...wordPool]);
        const selectedIndices = shuffled.slice(0, Math.min(count, shuffled.length));
        
        return selectedIndices.map(index => ({
            ...chapter.words[index],
            index: index,
            level: level
        }));
    }
    
    shuffleArray(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }
    
    // Update progress after a session
    updateWordStatus(chapterNumber, wordIndex, level, isCorrect) {
        const progress = this.progress.chapters[chapterNumber];
        if (!progress) return;
        
        if (level === 1) {
            if (isCorrect) {
                // Move from wordsToLearn to learnedWords
                const wordIndexInToLearn = progress.wordsToLearn.indexOf(wordIndex);
                if (wordIndexInToLearn > -1) {
                    progress.wordsToLearn.splice(wordIndexInToLearn, 1);
                    progress.learnedWords.push(wordIndex);
                }
            }
            // If wrong, stays in wordsToLearn
        } else if (level === 2) {
            if (isCorrect) {
                // Move from learnedWords to strongestWords
                const wordIndexInLearned = progress.learnedWords.indexOf(wordIndex);
                if (wordIndexInLearned > -1) {
                    progress.learnedWords.splice(wordIndexInLearned, 1);
                    progress.strongestWords.push(wordIndex);
                }
            } else {
                // Move from strongestWords or learnedWords back to wordsToLearn
                let sourceArray = progress.strongestWords;
                let arrayIndex = progress.strongestWords.indexOf(wordIndex);
                
                if (arrayIndex === -1) {
                    sourceArray = progress.learnedWords;
                    arrayIndex = progress.learnedWords.indexOf(wordIndex);
                }
                
                if (arrayIndex > -1) {
                    sourceArray.splice(arrayIndex, 1);
                    progress.wordsToLearn.push(wordIndex);
                }
            }
        } else if (level === 3) {
            if (!isCorrect) {
                // Move from strongestWords back to learnedWords
                const wordIndexInStrongest = progress.strongestWords.indexOf(wordIndex);
                if (wordIndexInStrongest > -1) {
                    progress.strongestWords.splice(wordIndexInStrongest, 1);
                    progress.learnedWords.push(wordIndex);
                }
            }
            // If correct, stays in strongestWords
        }
        
        this.updateStats();
        this.saveProgress();
    }
    
    // Export/Import functionality
    exportProgress() {
        const dataStr = JSON.stringify(this.progress, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `german-flashcards-progress-${new Date().toISOString().split('T')[0]}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    }
    
    importProgress(jsonData) {
        try {
            const newProgress = JSON.parse(jsonData);
            this.progress = newProgress;
            this.saveProgress();
            return true;
        } catch (error) {
            console.error('Error importing progress:', error);
            return false;
        }
    }
}

// Create global instance
const flashcardData = new FlashcardData();