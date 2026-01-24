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
        if (Number(parsed.chapter) === Number(chapterNumber)) chapter = parsed;
      }
    } catch (e) {
      console.warn('Failed loading chapterData fallback', e);
    }
  }

  if (!chapter) {
    document.getElementById('mcqQuestion').textContent = 'No chapter data available.';
    return;
  }

  document.getElementById('gameChapter').textContent = chapter.title || `Chapter ${chapterNumber}`;

  // Ensure familiarise pool initialized and load it
  flashcardData.initFamiliariseChapter(chapterNumber, chapter.words.length);
  famPool = flashcardData.getFamiliarisePool(chapterNumber) || [];

  // Determine session cap (from level-select control stored as famCardCount)
  const famCardCount = parseInt(localStorage.getItem('famCardCount')) || 10;

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
    // if session finished, go back to level-select
    if (sessionPos >= famSessionPool.length) {
      // small delay so user sees updated stats
      setTimeout(() => window.location.href = 'level-select.html', 250);
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

function updateStatsDisplay() {
  // Remaining shows how many questions left in THIS SESSION (not entire pool)
  const remaining = Math.max(0, (famSessionPool ? famSessionPool.length : 0) - sessionPos);
  document.getElementById('remainingCount').textContent = remaining;
  document.getElementById('correctCount').textContent = correctCount;
  document.getElementById('attemptedCount').textContent = attemptedCount;
}

function renderNextQuestion(chapterNumber, chapter) {
  // Refresh famPool in case other tabs changed it
  famPool = flashcardData.getFamiliarisePool(chapterNumber) || [];

  // If session exhausted (safety), go back
  if (!famSessionPool || sessionPos >= famSessionPool.length) {
    window.location.href = 'level-select.html';
    return;
  }

  // pick the next correct index from famSessionPool
  currentCorrectIndex = famSessionPool[sessionPos];

  // Prepare distractors: choose up to 3 other unique indices from the chapter words (excluding correct)
  const allIndices = Array.from({length: chapter.words.length}, (_, i) => i).filter(i => i !== currentCorrectIndex);
  shuffleArray(allIndices);
  const distractorCount = Math.min(3, allIndices.length);
  const distractors = allIndices.slice(0, distractorCount);

  // Build options array and shuffle
  currentOptions = [{ index: currentCorrectIndex, text: chapter.words[currentCorrectIndex].german }];
  distractors.forEach(d => currentOptions.push({ index: d, text: chapter.words[d].german }));
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
    // remove from familiarise pool (and it will auto-reset if emptied)
    flashcardData.markFamiliariseCorrect(parseInt(localStorage.getItem('currentChapter')) || 1, currentCorrectIndex);
  } else {
    btn.classList.add('mcq-wrong');
    // highlight the correct option
    const correctBtn = Array.from(document.querySelectorAll('.mcq-option')).find(b => Number(b.dataset.index) === Number(currentCorrectIndex));
    if (correctBtn) correctBtn.classList.add('mcq-correct');
    // Do NOT modify level 1 progress — this game is independent
  }

  // Update pool and stats display after marking
  famPool = flashcardData.getFamiliarisePool(parseInt(localStorage.getItem('currentChapter')) || 1) || [];
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
