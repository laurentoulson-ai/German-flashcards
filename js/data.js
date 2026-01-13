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
                    image: "data/images/background.png"
                };
            }
            const json = await response.json();
            // Ensure an image property exists. Prefer a chapter-specific image if available,
            // otherwise fall back to a chapter image file or the generic background.
            json.image = json.image || `data/images/chapter${chapterNumber}.png`;
            // If that specific image doesn't exist when hosted, the browser will simply skip it
            // and the CSS fallback/background will handle appearance.
            return json;
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
            image: "data/images/background.png"
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
        // Total words should be the sum of chapter word counts (avoid double-counting indices stored in progress arrays)
        let total = 0;
        let learned = 0;
        let strongest = 0;

        // Sum total words from loaded chapter data if available
        if (Array.isArray(this.chapters) && this.chapters.length > 0) {
            total = this.chapters.reduce((sum, ch) => sum + (Array.isArray(ch.words) ? ch.words.length : 0), 0);
        } else {
            // Fallback: infer total as sum of progress arrays lengths per chapter (not ideal but safe)
            Object.values(this.progress.chapters).forEach(ch => {
                total += (ch.wordsToLearn ? ch.wordsToLearn.length : 0) + (ch.learnedWords ? ch.learnedWords.length : 0) + (ch.strongestWords ? ch.strongestWords.length : 0);
            });
        }

        // Learned should count only the level-2 list (learnedWords). Strongest counts level-3.
        Object.values(this.progress.chapters).forEach(ch => {
            learned += (ch.learnedWords ? ch.learnedWords.length : 0);
            strongest += (ch.strongestWords ? ch.strongestWords.length : 0);
        });

        this.progress.stats = { totalWords: total, learnedWords: learned, strongestWords: strongest };
    }
    
    getSessionWords(chapterNumber, level, count, mode = 'mix') {
        // Find chapter by its numeric chapter property or by index fallback
        let chapter = this.chapters.find(c => Number(c.chapter) === Number(chapterNumber)) || this.chapters[chapterNumber - 1];

        // If chapters aren't loaded (e.g. directly opened game.html), fall back to stored chapterData
        if ((!chapter || !Array.isArray(chapter.words)) && typeof localStorage !== 'undefined') {
            try {
                const stored = localStorage.getItem('chapterData');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed && Number(parsed.chapter) === Number(chapterNumber)) {
                        chapter = parsed;
                    }
                }
            } catch (e) {
                console.warn('Failed to parse chapterData from localStorage fallback', e);
            }
        }

        // Ensure chapter.words exists
        const wordsArray = (chapter && Array.isArray(chapter.words)) ? chapter.words : [];

        // Ensure progress for this chapter exists
        if (!this.progress.chapters[chapterNumber]) {
            // initialize with full range (will be empty if wordsArray.length is 0)
            this.initChapterProgress(Number(chapterNumber), wordsArray.length);
        }
        const progress = this.progress.chapters[chapterNumber];

        if (!chapter || !progress) return [];

        // Helper to sanitize an array of indices: convert to numbers, remove duplicates and out-of-range
        const sanitizeIndices = (arr) => {
            const seen = new Set();
            const res = [];
            for (const v of arr) {
                const idx = Number(v);
                if (!Number.isFinite(idx) || idx < 0 || idx >= wordsArray.length) continue;
                if (seen.has(idx)) continue;
                seen.add(idx);
                res.push(idx);
            }
            return res;
        };

        let wordPoolIndices = [];

        if (level === 1) {
            if (mode === 'weak') {
                wordPoolIndices = sanitizeIndices(progress.wordsToLearn || []);
            } else if (mode === 'consolidate') {
                wordPoolIndices = sanitizeIndices(progress.learnedWords || []);
            } else {
                // mix - combine learned and to-learn but avoid duplicates
                wordPoolIndices = sanitizeIndices([...(progress.wordsToLearn || []), ...(progress.learnedWords || [])]);
            }
        } else if (level === 2) {
            // Level 2 should draw from learnedWords (level 2). strongestWords are a subset of learnedWords and should not be combined here.
            wordPoolIndices = sanitizeIndices(progress.learnedWords || []);
        } else if (level === 3) {
            wordPoolIndices = sanitizeIndices(progress.strongestWords || []);
        }

        // Shuffle and select the requested count
        const shuffled = this.shuffleArray([...wordPoolIndices]);

        // If the sanitized pool is empty but the chapter actually has words, fall back to full range
        if (shuffled.length === 0 && wordsArray.length > 0) {
            console.warn(`getSessionWords: sanitized pool empty for chapter ${chapterNumber}, level ${level}, mode ${mode}. Falling back to all indices.`);
            const allIndices = Array.from({length: wordsArray.length}, (_, i) => i);
            // shuffle those
            const shuffledAll = this.shuffleArray(allIndices);
            const takeAll = Math.min(Number(count) || 0, shuffledAll.length);
            const selectedAll = shuffledAll.slice(0, takeAll);
            return selectedAll.map(index => ({
                ...wordsArray[index],
                index: index,
                level: level
            }));
        }

        const take = Math.min(Number(count) || 0, shuffled.length);
        const selectedIndices = shuffled.slice(0, take);

        // Debug log showing sizes
        console.log(`getSessionWords: chapter=${chapterNumber} words=${wordsArray.length} poolBefore=${wordPoolIndices.length} poolAfter=${shuffled.length} requested=${count} selected=${selectedIndices.length}`);

        // Map to word objects, include original index and level
        return selectedIndices.map(index => ({
            ...wordsArray[index],
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
            // Level 1: on correct -> remove from wordsToLearn and add to learnedWords (level 2)
            if (isCorrect) {
                const idx = progress.wordsToLearn.indexOf(wordIndex);
                if (idx > -1) progress.wordsToLearn.splice(idx, 1);
                if (!progress.learnedWords.includes(wordIndex)) progress.learnedWords.push(wordIndex);
                // Ensure it's not duplicated in strongest
                const sIdx = progress.strongestWords.indexOf(wordIndex);
                if (sIdx > -1) progress.strongestWords.splice(sIdx, 1);
            }
        } else if (level === 2) {
            if (isCorrect) {
                // Promote to strongest: remove from learnedWords and add to strongestWords
                const lIdx = progress.learnedWords.indexOf(wordIndex);
                if (lIdx > -1) progress.learnedWords.splice(lIdx, 1);
                if (!progress.strongestWords.includes(wordIndex)) progress.strongestWords.push(wordIndex);
            } else {
                // Incorrect on level 2: remove from strongest and learned and return to wordsToLearn
                const sIdx = progress.strongestWords.indexOf(wordIndex);
                if (sIdx > -1) progress.strongestWords.splice(sIdx, 1);
                const lIdx2 = progress.learnedWords.indexOf(wordIndex);
                if (lIdx2 > -1) progress.learnedWords.splice(lIdx2, 1);
                if (!progress.wordsToLearn.includes(wordIndex)) progress.wordsToLearn.push(wordIndex);
            }
        } else if (level === 3) {
            if (isCorrect) {
                // Correct on level 3: ensure in strongest and not in learned
                const lIdx3 = progress.learnedWords.indexOf(wordIndex);
                if (lIdx3 > -1) progress.learnedWords.splice(lIdx3, 1);
                if (!progress.strongestWords.includes(wordIndex)) progress.strongestWords.push(wordIndex);
            } else {
                // Incorrect on level 3: demote to learned (remove from strongest, add to learned)
                const sIdx3 = progress.strongestWords.indexOf(wordIndex);
                if (sIdx3 > -1) progress.strongestWords.splice(sIdx3, 1);
                if (!progress.learnedWords.includes(wordIndex)) progress.learnedWords.push(wordIndex);
                // Ensure it's not in wordsToLearn at the same time
                const wIdx = progress.wordsToLearn.indexOf(wordIndex);
                if (wIdx > -1) progress.wordsToLearn.splice(wIdx, 1);
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
