German Flashcards
=================

A small web app I designed for studying German vocabulary from 'Harry Potter und der Stein der Weisen', chapter-by-chapter. It displays chapter cards, lets you select learning levels and run short practice sessions (flashcards), and tracks progress in the browser. The app can be used for learning any language.

Quick overview
--------------
- Chapters are JSON files in data/chapters/chapterN.json. Each chapter contains a "words" array of objects with fields: "german", "english" and "clue". Chapters can be added one at a time. The current JSON files are words I want to learn - you can replace these with your own JSON files of words you want to learn.
- The homepage shows all chapters and a progress summary (total words, words learned).
- Practice sessions are available per chapter with three levels (learn → consolidate → strengthen). Answers update progress saved to localStorage.

Main features
---------------
- Three flashcard levels:
    - Level 1: Presented with german words, you must correctly guess the translation
    - Level 2: Taking all words you previously got correct from level 1, you must now guess the german word
               when presented with the english word
    - Level 3: Master the vocab - All words previous correct words from level 2 are now put to the test in
               sentence context.
- Words automatically level up and down between flashcard levels based on gameplay
- Adjustable - Set how many cards you want to test in the game, and whether you want to test weak words or 
               learned words (level 1 only)


Running the app
---------------
The app can be run directly from GitHub pages.

  Clone repo > Settings > Pages > Publish site

  ### Site will be available at https://[Your username].github.io/German-flashcards/

Files & structure
-----------------
- index.html — homepage (chapters, progress summary)
- level-select.html — choose a level for a chapter
- game.html — flashcard gameplay
- css/ — styles (style.css, game.css)
- js/ — app logic (data.js, app.js, game.js, level-select.js, storage.js)
- data/chapters/ — JSON chapter files
- data/images/ — cover and chapter images

Progress (backup & restore)
---------------------------
- Progress is stored in browser localStorage under the key germanFlashcardsProgress.
- Export via the app (Export Progress) to save a JSON backup file. Import the JSON via the app (Import Progress) to restore progress on the same or another device.
- Important: progress refers to words by numeric index. If you edit chapter JSON and insert/remove words in the middle, indices will shift and the progress mapping may break. To avoid this, append new words to the end of a chapter or export progress before making structural edits.


