cat > js/data.js << 'EOF'
// Data management for German Flashcards
class FlashcardData {
    constructor() {
        this.chapters = [];
        this.progress = this.loadProgress();
        this.currentChapter = null;
        this.currentLevel = 1;
    }
    
    async loadChapter(chapterNumber) {
        try {
            const response = await fetch(`data/chapters/chapter${chapterNumber}.json`);
            if (!response.ok) {
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
    
    async loadAllChapters() {
        const chapterPromises = [];
        for (let i = 1; i <= 17; i++) {
            chapterPromises.push(this.loadChapter(i));
        }
        
        this.chapters = await Promise.all(chapterPromises);
        return this.chapters;
    }
    
    loadProgress() {
        const saved = localStorage.getItem('germanFlashcardsProgress');
        if (saved) {
            return JSON.parse(saved);
        }
        
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
    
    initChapterProgress(chapterNumber, wordCount) {
        if (!this.progress.chapters[chapterNumber]) {
            this.progress.chapters[chapterNumber] = {
                wordsToLearn: Array.from({length: wordCount}, (_, i) => i),
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
    
    getSessionWords(chapterNumber, level, count, mode = 'mix') {
        const chapter = this.chapters.find(c => c.chapter === chapterNumber);
        const progress = this.progress.chapters[chapterNumber];
        
        if (!chapter || !progress) return [];
        
        let wordPool = [];
        
        if (level === 1) {
            if (mode === 'weak') {
                wordPool = progress.wordsToLearn;
            } else if (mode === 'consolidate') {
                wordPool = progress.learnedWords;
            } else {
                wordPool = [...progress.wordsToLearn, ...progress.learnedWords];
            }
        } else if (level === 2) {
            wordPool = [...progress.learnedWords, ...progress.strongestWords];
        } else if (level === 3) {
            wordPool = progress.strongestWords;
        }
        
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
    
    updateWordStatus(chapterNumber, wordIndex, level, isCorrect) {
        const progress = this.progress.chapters[chapterNumber];
        if (!progress) return;
        
        if (level === 1) {
            if (isCorrect) {
                const wordIndexInToLearn = progress.wordsToLearn.indexOf(wordIndex);
                if (wordIndexInToLearn > -1) {
                    progress.wordsToLearn.splice(wordIndexInToLearn, 1);
                    progress.learnedWords.push(wordIndex);
                }
            }
        } else if (level === 2) {
            if (isCorrect) {
                const wordIndexInLearned = progress.learnedWords.indexOf(wordIndex);
                if (wordIndexInLearned > -1) {
                    progress.learnedWords.splice(wordIndexInLearned, 1);
                    progress.strongestWords.push(wordIndex);
                }
            } else {
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
                const wordIndexInStrongest = progress.strongestWords.indexOf(wordIndex);
                if (wordIndexInStrongest > -1) {
                    progress.strongestWords.splice(wordIndexInStrongest, 1);
                    progress.learnedWords.push(wordIndex);
                }
            }
        }
        
        this.updateStats();
        this.saveProgress();
    }
    
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

const flashcardData = new FlashcardData();
EOF