document.addEventListener('DOMContentLoaded', () => {
  const chapterNumber = parseInt(localStorage.getItem('currentChapter')) || 1;
  initFamiliarise(chapterNumber);
});

let famPool = [];
let famSessionPool = []; // indices chosen for this session
let sessionPos = 0; // position inside famSessionPool
let currentCorrectIndex = null; // index in chapter.words
let currentOptions = []; // array of {index, text}
let correctCount = 0;
let attemptedCount = 0;

function initFamiliarise(chapterNumber) {
  // Load chapter (prefer loaded chapters array, fallback to stored chapterData)
  let chapter = flashcardData.chapters.find(c => Number(c.chapter) === Number(chapterNumber));
  if (!chapter) {
    try {
      const stored = localStorage.getItem('chapterData');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (String(parsed.chapter) === String(chapterNumber)) chapter = parsed;
      }
    } catch (e) {
      console.warn('Failed loading chapterData fallback', e);
    }
  }

  // DEBUG: log language and chapter info to help diagnose missing Spanish familiarise pool
  try {
    console.log('initFamiliarise: chapterNumber=', chapterNumber, 'appLang=', flashcardData.getAppLang && flashcardData.getAppLang());
    console.log('initFamiliarise: chapter object=', chapter);
    console.log('initFamiliarise: existing familiarise progress=', flashcardData.progress && flashcardData.progress.familiarise);
  } catch (e) { /* ignore logging errors */ }

  if (!chapter) {
    document.getElementById('mcqQuestion').textContent = 'No chapter data available.';
    return;
  }

  document.getElementById('gameChapter').textContent = chapter.title || `Chapter ${chapterNumber}`;

  // If aggregated 'all' chapter, build famPool from per-chapter pools; otherwise init per-chapter pool
  if (String(chapterNumber) === 'all' || (chapter && String(chapter.chapter) === 'all')) {
    // ensure all per-chapter progress exists and load chapters
    if (!Array.isArray(flashcardData.chapters) || flashcardData.chapters.length === 0) {
      // try loading
      flashcardData.loadAllChapters().then(() => {
        // nothing here, we proceed below
      });
    }
    // build famPool as indices into chapter.words where the original chapter's familiarise pool still contains that index
    famPool = [];
    for (let i = 0; i < chapter.words.length; i++) {
      const w = chapter.words[i];
      const origCh = Number(w.originalChapter || w.chapter || 0);
      const origIdx = Number(w.originalIndex !== undefined ? w.originalIndex : i);
      const pool = flashcardData.getFamiliarisePool(origCh) || [];
      if (pool.includes(origIdx)) famPool.push(i);
    }
  } else {
    // Ensure familiarise pool initialized and load it for the single chapter
    flashcardData.initFamiliariseChapter(chapterNumber, chapter.words.length);
    famPool = flashcardData.getFamiliarisePool(chapterNumber) || [];

    // If pool is empty but chapter has words, re-init (covers cases where progress stored an empty array)
    if ((Array.isArray(famPool) && famPool.length === 0) && Array.isArray(chapter.words) && chapter.words.length > 0) {
      console.warn(`Familiarise pool for chapter ${chapterNumber} was empty; reinitializing to full set for language ${flashcardData.getAppLang()}`);
      if (!flashcardData.progress.familiarise) flashcardData.progress.familiarise = {};
      flashcardData.progress.familiarise[chapterNumber] = Array.from({length: chapter.words.length}, (_, i) => i);
      flashcardData.saveProgress();
      famPool = flashcardData.getFamiliarisePool(chapterNumber) || [];
    }
  }

  // DEBUG: after initialization
  try {
    console.log('initFamiliarise: famPool after init (length)=', famPool.length);
    console.log('initFamiliarise: progress.familiarise[chapter]=', flashcardData.progress.familiarise && flashcardData.progress.familiarise[chapterNumber]);
  } catch (e) { /* ignore */ }

  // Determine session cap (from level-select control stored as famCardCount)
  const famCardCount = parseInt(localStorage.getItem('famCardCount')) || 20;

  // Build a session-limited random selection from the global pool (those not yet answered correctly)
  const poolCopy = shuffleArray([...famPool]);
  const take = Math.min(famCardCount, poolCopy.length);
  famSessionPool = poolCopy.slice(0, take);
  sessionPos = 0;

  // bind buttons
  document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = 'level-select.html';
  });

  document.getElementById('nextBtn').addEventListener('click', () => {
    document.getElementById('nextBtn').style.display = 'none';
    sessionPos++;
    // if session finished, show summary modal
    if (sessionPos >= famSessionPool.length) {
      // small delay so user sees updated stats, then show summary modal
      setTimeout(() => showFamiliariseSummary(), 250);
      return;
    }
    renderNextQuestion(chapterNumber, chapter);
  });

  // initial stats
  correctCount = 0;
  attemptedCount = 0;
  updateStatsDisplay();

  renderNextQuestion(chapterNumber, chapter);
}

// Show familiarise session summary modal
function showFamiliariseSummary() {
  const total = correctCount + attemptedCount - correctCount >= 0 ? attemptedCount : (famSessionPool ? famSessionPool.length : 0);
  // Use attemptedCount as total questions answered in session
  const totalQ = attemptedCount || (famSessionPool ? famSessionPool.length : 0);
  const correct = correctCount;
  const wrong = attemptedCount - correctCount;
  const accuracy = totalQ > 0 ? Math.round((correct / totalQ) * 100) : 0;

  document.getElementById('famResultTotal').textContent = totalQ;
  document.getElementById('famResultCorrect').textContent = correct;
  document.getElementById('famResultWrong').textContent = wrong;
  document.getElementById('famResultAccuracy').textContent = `${accuracy}%`;

  document.getElementById('famSessionCompleteModal').style.display = 'flex';

  // wire modal buttons
  document.getElementById('famPracticeAgainBtn').onclick = function() { location.reload(); };
  document.getElementById('famBackToLevelsBtn').onclick = function() { window.location.href = 'level-select.html'; };
}

function updateStatsDisplay() {
  // Remaining shows how many questions left in THIS SESSION (not entire pool)
  const remaining = Math.max(0, (famSessionPool ? famSessionPool.length : 0) - sessionPos);
  document.getElementById('remainingCount').textContent = remaining;
  document.getElementById('correctCount').textContent = correctCount;
  document.getElementById('attemptedCount').textContent = attemptedCount;
}

function renderNextQuestion(chapterNumber, chapter) {
  // Refresh famPool in case other tabs changed it
  if (String(chapterNumber) === 'all' || (chapter && String(chapter.chapter) === 'all')) {
    // rebuild famPool from per-chapter pools
    famPool = [];
    for (let i = 0; i < chapter.words.length; i++) {
      const w = chapter.words[i];
      const origCh = Number(w.originalChapter || w.chapter || 0);
      const origIdx = Number(w.originalIndex !== undefined ? w.originalIndex : i);
      const pool = flashcardData.getFamiliarisePool(origCh) || [];
      if (pool.includes(origIdx)) famPool.push(i);
    }
    // rebuild session pool to reflect any removals
    const famCardCount = parseInt(localStorage.getItem('famCardCount')) || 20;
    const poolCopy = shuffleArray([...famPool]);
    const take = Math.min(famCardCount, poolCopy.length);
    famSessionPool = poolCopy.slice(0, take);
  } else {
    famPool = flashcardData.getFamiliarisePool(chapterNumber) || [];
  }

  // DEBUG: log pool when rendering
  try {
    console.log('renderNextQuestion: famPool length=', famPool.length, 'famSessionPool length=', famSessionPool.length, 'sessionPos=', sessionPos);
  } catch (e) {}

  // If session exhausted (safety), show summary modal
  if (!famSessionPool || sessionPos >= famSessionPool.length) {
    showFamiliariseSummary();
    return;
  }

  // pick the next correct index from famSessionPool
  currentCorrectIndex = famSessionPool[sessionPos];

  // Prepare distractors: choose up to 3 other unique indices from the chapter words (excluding correct)
  const allIndices = Array.from({length: chapter.words.length}, (_, i) => i).filter(i => i !== currentCorrectIndex);
  shuffleArray(allIndices);
  const distractorCount = Math.min(3, allIndices.length);
  const distractors = allIndices.slice(0, distractorCount);

  // Determine language key (spanish/german)
  const langKey = (flashcardData.getAppLang && flashcardData.getAppLang() === 'es') ? 'spanish' : 'german';

  // Build options array and shuffle
  currentOptions = [{ index: currentCorrectIndex, text: chapter.words[currentCorrectIndex][langKey] }];
  distractors.forEach(d => currentOptions.push({ index: d, text: chapter.words[d][langKey] }));
  shuffleArray(currentOptions);

  // Render question and options
  const english = chapter.words[currentCorrectIndex].english || '';
  const qEl = document.getElementById('mcqQuestion');
  qEl.textContent = `Which word means "${english}"?`;

  const optionsContainer = document.getElementById('mcqOptions');
  optionsContainer.innerHTML = '';

  currentOptions.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'mcq-option btn';
    btn.textContent = opt.text;
    btn.dataset.index = opt.index;
    btn.addEventListener('click', onOptionSelected);
    optionsContainer.appendChild(btn);
  });

  // hide next button until answered
  document.getElementById('nextBtn').style.display = 'none';
  updateStatsDisplay();
}

function onOptionSelected(e) {
  const btn = e.currentTarget;
  const selectedIndex = Number(btn.dataset.index);

  // disable all options
  document.querySelectorAll('.mcq-option').forEach(b => {
    b.disabled = true;
    b.classList.remove('mcq-correct','mcq-wrong');
  });

  attemptedCount++;

  const isCorrect = selectedIndex === Number(currentCorrectIndex);
  if (isCorrect) {
    correctCount++;
    btn.classList.add('mcq-correct');
    // remove from familiarise pool on the correct word
    // If aggregated 'all' chapter, mark against the original chapter/index
    const chapterData = JSON.parse(localStorage.getItem('chapterData') || '{}');
    const isAll = (String(localStorage.getItem('currentChapter')) === 'all') || (chapterData && String(chapterData.chapter) === 'all');
    if (isAll) {
      const sessionWord = chapterData.words && chapterData.words[currentCorrectIndex];
      if (sessionWord && sessionWord.originalChapter !== undefined && sessionWord.originalIndex !== undefined) {
        flashcardData.markFamiliariseCorrect(Number(sessionWord.originalChapter), Number(sessionWord.originalIndex));
      } else {
        // fallback: if structure not present, try using currentChapter numeric
        flashcardData.markFamiliariseCorrect(parseInt(localStorage.getItem('currentChapter')) || 1, currentCorrectIndex);
      }
    } else {
      flashcardData.markFamiliariseCorrect(parseInt(localStorage.getItem('currentChapter')) || 1, currentCorrectIndex);
    }
  } else {
    btn.classList.add('mcq-wrong');
    // highlight the correct option
    const correctBtn = Array.from(document.querySelectorAll('.mcq-option')).find(b => Number(b.dataset.index) === Number(currentCorrectIndex));
    if (correctBtn) correctBtn.classList.add('mcq-correct');
    // Do NOT modify level 1 progress — this game is independent
  }

  // Update pool and stats display after marking
  const chapterData = JSON.parse(localStorage.getItem('chapterData') || '{}');
  const isAll = (String(localStorage.getItem('currentChapter')) === 'all') || (chapterData && String(chapterData.chapter) === 'all');
  if (isAll) {
    // rebuild famPool for aggregated view
    famPool = [];
    for (let i = 0; i < chapterData.words.length; i++) {
      const w = chapterData.words[i];
      const origCh = Number(w.originalChapter || w.chapter || 0);
      const origIdx = Number(w.originalIndex !== undefined ? w.originalIndex : i);
      const pool = flashcardData.getFamiliarisePool(origCh) || [];
      if (pool.includes(origIdx)) famPool.push(i);
    }
  } else {
    famPool = flashcardData.getFamiliarisePool(parseInt(localStorage.getItem('currentChapter')) || 1) || [];
  }
  updateStatsDisplay();

  // show next button (positioned under options in the UI)
  const nextBtn = document.getElementById('nextBtn');
  nextBtn.style.display = 'inline-block';
  nextBtn.textContent = (sessionPos + 1 >= famSessionPool.length) ? 'Finish' : 'Next';
}

// small utility
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
