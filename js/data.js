// Data management for German Flashcards
class FlashcardData {
    constructor() {
        this.chapters = [];
        this.progress = this.loadProgress();
        this.currentChapter = null;
        this.currentLevel = 1;
    }

    // Return current app language ('de' or 'es') — prefer explicit window var then localStorage
    getAppLang() {
        try {
            return window.APP_LANG || localStorage.getItem('appLanguage') || 'de';
        } catch (e) {
            return 'de';
        }
    }

    async loadChapter(chapterNumber) {
        const lang = this.getAppLang();
        // Try a series of likely file locations to support different folder layouts
        const candidates = [];
        if (lang === 'es') {
            // prefer data/chapters/spanish, then data/spanish/chapters, then data/spanish
            candidates.push(
                `data/chapters/spanish/chapter${chapterNumber}.json`,
                `data/spanish/chapters/chapter${chapterNumber}.json`,
                `data/spanish/chapter${chapterNumber}.json`
            );
        } else {
            // prefer data/chapters/german, then data/german/chapters, then legacy data/chapters
            candidates.push(
                `data/chapters/german/chapter${chapterNumber}.json`,
                `data/german/chapters/chapter${chapterNumber}.json`,
                `data/chapters/chapter${chapterNumber}.json`,
                `data/german/chapter${chapterNumber}.json`
            );
        }

        for (const path of candidates) {
            try {
                const response = await fetch(path);
                if (response.ok) {
                    const json = await response.json();
                    json.image = json.image || `data/images/chapter${chapterNumber}.png`;
                    return json;
                }
            } catch (err) {
                // try next candidate
                // console.debug(`Failed to fetch ${path}:`, err);
            }
        }

        // If none of the candidates returned, fallback to placeholder chapter
        return this.createPlaceholderChapter(chapterNumber);
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
        const lang = (typeof window !== 'undefined' && (window.APP_LANG || localStorage.getItem('appLanguage'))) ? (window.APP_LANG || localStorage.getItem('appLanguage')) : 'de';
        const key = `germanFlashcardsProgress_${lang}`;
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.warn('Failed to parse saved progress for', lang, e);
            }
        }
        return {
            chapters: {},
            stats: {
                totalWords: 0,
                learnedWords: 0,
                strongestWords: 0
            },
            familiarise: {}
        };
    }

    saveProgress() {
        const lang = this.getAppLang();
        const key = `germanFlashcardsProgress_${lang}`;
        localStorage.setItem(key, JSON.stringify(this.progress));
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
        // also ensure familiarise pool exists for the chapter (full set initially)
        this.initFamiliariseChapter(chapterNumber, wordCount);
    }

    // Initialize familiarise pool for a chapter if missing; stores remaining indices
    initFamiliariseChapter(chapterNumber, wordCount) {
        if (!this.progress.familiarise) this.progress.familiarise = {};
        if (!this.progress.familiarise[chapterNumber] || !Array.isArray(this.progress.familiarise[chapterNumber])) {
            this.progress.familiarise[chapterNumber] = Array.from({length: wordCount}, (_, i) => i);
            this.saveProgress();
        }
    }

    // Return the current pool (array of indices) for the Familiarise game for a chapter
    getFamiliarisePool(chapterNumber) {
        if (!this.progress.familiarise) this.progress.familiarise = {};
        return this.progress.familiarise[chapterNumber] ? [...this.progress.familiarise[chapterNumber]] : [];
    }

    // Mark a word index as correctly answered in Familiarise: remove it from the pool and persist.
    markFamiliariseCorrect(chapterNumber, wordIndex) {
        if (!this.progress.familiarise) this.progress.familiarise = {};
        const pool = this.progress.familiarise[chapterNumber] || [];
        const pos = pool.indexOf(Number(wordIndex));
        if (pos > -1) {
            pool.splice(pos, 1);
            this.progress.familiarise[chapterNumber] = pool;
            // if emptied, reset to full set for that chapter (so the pool cycles)
            if (pool.length === 0) {
                // try to find chapter length
                const ch = this.chapters.find(c => Number(c.chapter) === Number(chapterNumber));
                const count = ch && Array.isArray(ch.words) ? ch.words.length : 0;
                this.progress.familiarise[chapterNumber] = Array.from({length: count}, (_, i) => i);
            }
            this.saveProgress();
            return true;
        }
        return false;
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
        const lang = this.getAppLang();
        const exportFileDefaultName = `german-flashcards-progress-${lang}-${new Date().toISOString().split('T')[0]}.json`;
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
