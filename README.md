German Flashcards
=================

A small web app for studying German vocabulary from 'Harry Potter und der Stein der Weisen', chapter-by-chapter. It displays chapter cards, lets you select learning levels and run short practice sessions (flashcards), and tracks progress in the browser.

Quick overview
--------------
- Chapters are JSON files in data/chapters/chapterN.json. Each chapter contains a "words" array of objects with fields: "german", "english" and "clue". Chapters can be added one at a time.
- The homepage shows all chapters and a progress summary (total words, words learned).
- Practice sessions are available per chapter with three levels (learn → consolidate → strengthen). Answers update progress saved to localStorage.

Main features
---------------
- Personalised learning - upload words from each chapter you want to learn
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

  # Site will be available at https://[Your username].github.io/German-flashcards/

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

AI integration (OpenRouter)
---------------------------
This app can generate chapter JSON from pasted words using an LLM via OpenRouter. To keep your API key private, the repository includes a small Node proxy (server/index.js) which injects your OPENROUTER_API_KEY from a local server/.env file and forwards requests to OpenRouter. The front-end calls the proxy; the key is never embedded in client code.

Files added/changed for AI support
- server/index.js — simple proxy that calls OpenRouter and optionally runs a small "checker" model to validate JSON. It reads configuration from server/.env.
- server/.env — local template storing OPENROUTER_API_KEY and optional MODEL/CHECKER_MODEL (replace placeholder with your real key). Do not commit sensitive keys.
- .gitignore — includes server/.env so the key file is not accidentally committed.
- ai_system_prompt.txt — system prompt used to instruct the model how to format output.
- Front-end: Upload modal uses the proxy to generate JSON, shows a readonly preview, and allows Accept or Retry before saving locally.

Quick local setup (macOS)
1. Create server/.env (a template is already included at server/.env). Edit it and replace the placeholder OPENROUTER_API_KEY value with your real OpenRouter key.
   Example server/.env:
     OPENROUTER_API_KEY=sk-or-REPLACE_WITH_YOUR_KEY
     MODEL=stepfun/step-3.5-flash
     CHECKER_MODEL=liquid/lfm2.5-1.2b-instruct
     PORT=3000
2. Install server dependencies and run the proxy:
   - cd server
   - npm install express cors dotenv node-fetch
   - node index.js
   The proxy listens on the PORT from server/.env (default 3000).

Notes about server/.env and Git
- server/.env is included as a local editable file with a placeholder in this workspace for convenience. Do not commit your real key to git.
- .gitignore contains server/.env to prevent accidental commits. If you commit a real key accidentally, rotate the key immediately.

Testing from your mobile/browser (without running VS Code on mobile)
Option A — Deploy the proxy (recommended):
  - Deploy server/index.js to a host that supports Node and environment variables (Vercel, Render, Heroku, Railway, etc.).
  - In the host dashboard, set OPENROUTER_API_KEY and any other env vars. Do NOT push the key to GitHub.
  - Configure the front-end to use the deployed proxy by setting window.AI_API_URL to the deployed URL (or host the static site on the same host). For GitHub Pages, edit index.html to set window.AI_API_URL or use a small config file.
Option B — Local testing and mobile access (temporary):
  - Run the proxy locally and expose it with a tunnel (ngrok): ngrok http 3000.
  - Use the ngrok URL on your phone to point window.AI_API_URL to the proxied URL.

Why GitHub Pages alone is insufficient
- GitHub Pages serves static files only. It cannot run the Node proxy or hold your secret key. You must host the server/index.js proxy somewhere with environment-variable support and configure the front-end to call it.

How to use the AI generation flow in the app
1. Open the app (index.html) and click Upload on an empty chapter card.
2. Paste words (one per line) in the modal and click Generate JSON (AI).
3. The app sends the words to the server proxy. The server calls OpenRouter and returns the generated JSON text and an optional checker result.
4. Preview the generated JSON (readonly). You can Accept to save to localStorage or Retry to call the model again with slightly different settings.
5. After Accept, the chapter is stored locally as localChapter_<lang>_<chapterNumber> and appears in the UI.

Security and best practices
- Never store API keys in frontend code or commit them to the repository.
- Use the host's secret management when deploying.
- If you accidentally expose a key, rotate it immediately on OpenRouter.


