// Simple AI proxy for the client app
// Usage: set OPENROUTER_API_KEY (and optional CHECKER_MODEL/MODEL) in server/.env, then run `node server/index.js`

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PROVIDER_URL = process.env.PROVIDER_URL; // optional custom provider
const PROVIDER_KEY = process.env.PROVIDER_KEY; // optional custom provider key

function readAiSystemPrompt() {
  try {
    const notesPath = path.resolve(__dirname, '..', 'ai_system_prompt.txt');
    return fs.readFileSync(notesPath, 'utf8');
  } catch (e) {
    console.warn('Could not read ai_system_prompt.txt:', e.message);
    return '';
  }
}

// Normalize response text extractor
function extractTextFromProviderResponse(json) {
  if (!json) return null;
  if (typeof json === 'string') return json;
  if (json.output) return json.output;
  if (json.text) return json.text;
  if (json.result) return json.result;
  if (Array.isArray(json.generations) && json.generations[0] && json.generations[0].text) return json.generations[0].text;
  if (json.choices && json.choices[0] && json.choices[0].text) return json.choices[0].text;
  return JSON.stringify(json);
}

// POST /api/generate - proxy/generator endpoint for AI calls
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, userWords, chapterNumber, lang, model, max_tokens, temperature } = req.body || {};

    // Build final prompt: prefer explicit prompt, otherwise combine ai_system_prompt.txt and userWords
    let finalPrompt = prompt;
    if (!finalPrompt && userWords) {
      const notes = readAiSystemPrompt();
      finalPrompt = `${notes}\n\nConvert the following user-provided words into a JSON chapter object for language '${lang || 'de'}'.\nThe JSON must be exactly in this structure (no extra text):\n{\n  "chapter": ${chapterNumber || 0},\n  "title": "Chapter ${chapterNumber || ''}\",\n  "words": [\n    { "german": "...", "english": "...", "clue": "..." },\n    ...\n  ]\n}\n\nHere are the words (one per line):\n${userWords}\n\nRespond with valid JSON only.`;
    }

    const chosenModel = model || process.env.MODEL || 'stepfun/step-3.5-flash';
    const chosenMax = max_tokens || 1200;
    const chosenTemp = typeof temperature !== 'undefined' ? temperature : 0.0;

    // If a custom PROVIDER_URL is specified in env, proxy to it (legacy behaviour)
    if (PROVIDER_URL) {
      const bodyToProvider = {
        prompt: finalPrompt,
        model: chosenModel,
        max_tokens: chosenMax,
        temperature: chosenTemp
      };

      const headers = { 'Content-Type': 'application/json' };
      if (PROVIDER_KEY) headers['Authorization'] = `Bearer ${PROVIDER_KEY}`;

      const fetch = global.fetch || require('node-fetch');
      const providerResp = await fetch(PROVIDER_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyToProvider)
      });

      const providerJson = await providerResp.json();
      const text = extractTextFromProviderResponse(providerJson);
      return res.json({ success: true, text, raw: providerJson });
    }

    // If OpenRouter key present, call OpenRouter chat completions endpoint directly
    const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
    if (OPENROUTER_KEY) {
      const fetch = global.fetch || require('node-fetch');

      // Build messages array for chat-style API
      const messages = [];
      // If ai_system_prompt.txt present and we built finalPrompt from userWords, include it as system message
      const notes = readAiSystemPrompt();
      if (notes && !prompt) messages.push({ role: 'system', content: notes });
      // Put the actual instruction as a user message to keep semantics simple
      messages.push({ role: 'user', content: finalPrompt });

      const orBody = {
        model: chosenModel,
        messages,
        temperature: chosenTemp,
        max_tokens: chosenMax
      };

      const orResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_KEY}`
        },
        body: JSON.stringify(orBody)
      });

      const orJson = await orResp.json();
      // OpenRouter returns choices[].message.content typically
      let replyText = null;
      try {
        if (orJson && orJson.choices && orJson.choices[0] && orJson.choices[0].message) {
          replyText = orJson.choices[0].message.content;
        } else if (orJson && orJson.output) {
          replyText = orJson.output;
        } else {
          replyText = JSON.stringify(orJson);
        }
      } catch (e) {
        replyText = JSON.stringify(orJson);
      }

      // Optional checker model: validate JSON using a lightweight instruction model if configured
      const CHECKER_MODEL = process.env.CHECKER_MODEL; // e.g. 'liquid/lfm2.5-1.2b-instruct'
      if (CHECKER_MODEL) {
        try {
          const checkMessages = [
            { role: 'system', content: 'You are a strict JSON validator. Do not output anything except a single JSON object with shape { "valid": boolean, "errors": [string] }.' },
            { role: 'user', content: `Validate that the following text is a JSON array of objects with keys either 'german' or 'spanish', 'english' and optional 'clue'. Return valid:true if it satisfies, otherwise valid:false and list problems. Text:\n${replyText}` }
          ];

          const checkBody = { model: CHECKER_MODEL, messages: checkMessages, temperature: 0.0, max_tokens: 800 };
          const checkResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENROUTER_KEY}` },
            body: JSON.stringify(checkBody)
          });
          const checkJson = await checkResp.json();
          const checkText = (checkJson && checkJson.choices && checkJson.choices[0] && checkJson.choices[0].message) ? checkJson.choices[0].message.content : JSON.stringify(checkJson);
          // Try to parse checker output
          let checkResult = null;
          try { checkResult = JSON.parse(checkText); } catch (e) { checkResult = { valid: false, errors: ['Checker did not return strict JSON: ' + checkText] }; }

          return res.json({ success: true, text: replyText, raw: orJson, checker: checkResult });
        } catch (e) {
          // If checker fails, still return generation
          return res.json({ success: true, text: replyText, raw: orJson, checker: { valid: false, errors: ['Checker call failed', e.message] } });
        }
      }

      return res.json({ success: true, text: replyText, raw: orJson });
    }

    // If we reach here, no provider configured
    return res.status(500).json({ error: 'No AI provider configured. Set PROVIDER_URL+PROVIDER_KEY or OPENROUTER_API_KEY in server/.env' });
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`AI proxy listening on http://localhost:${PORT}`));
