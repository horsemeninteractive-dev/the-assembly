const fs = require('fs');
const path = require('path');

const fileContent = fs.readFileSync('src/locales/en.json', 'utf8');
const enData = JSON.parse(fileContent);

// Object to store string paths and their protected texts
const flatStrings = [];

function traverse(obj, currentPath = []) {
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      flatStrings.push({ path: [...currentPath, key], original: value });
    } else if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        value.forEach((v, index) => {
          if (typeof v === 'string') {
            flatStrings.push({ path: [...currentPath, key, String(index)], original: v });
          }
        });
      } else {
        traverse(value, [...currentPath, key]);
      }
    }
  }
}

traverse(enData);

// Protect placeholders
function protect(str) {
  const placeholders = [];
  const protectedStr = str.replace(/\{\{.*?\}\}|<\/?\d+>/g, (match) => {
    placeholders.push(match);
    return `[${placeholders.length - 1}]`;
  });
  return { protectedStr, placeholders };
}

// Unprotect
function unprotect(str, placeholders) {
  return str.replace(/\[\s*(\d+)\s*\]/g, (match, idx) => {
    return placeholders[idx] || match;
  });
}

const langs = [
  { code: 'es', file: 'es.json' },
  { code: 'fr', file: 'fr.json' },
  { code: 'de', file: 'de.json' },
  { code: 'pt', file: 'pt.json' },
  { code: 'ru', file: 'ru.json' },
  { code: 'zh-CN', file: 'zh-CN.json' },
  { code: 'ko', file: 'ko.json' }
];

async function translateText(text, targetLang) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  const data = await res.json();
  return data[0].map(item => item[0]).join('');
}

async function translateAll() {
  for (const lang of langs) {
    const targetFilePath = `src/locales/${lang.file}`;
    console.log(`Checking translations for ${lang.code} (${lang.file})...`);
    
    let existingData = {};
    if (fs.existsSync(targetFilePath)) {
      try {
        existingData = JSON.parse(fs.readFileSync(targetFilePath, 'utf8'));
      } catch (e) {
        console.warn(`Could not parse existing ${lang.file}, starting fresh.`);
      }
    }

    // Identify which strings need translation
    const toTranslate = [];
    const newData = JSON.parse(fileContent); // Start with English structure

    function getValueByPath(obj, pathParts) {
      let current = obj;
      for (const part of pathParts) {
        if (current === undefined || current === null) return undefined;
        current = current[part];
      }
      return current;
    }

    function setValueByPath(obj, pathParts, value) {
      let current = obj;
      for (let i = 0; i < pathParts.length - 1; i++) {
        if (!current[pathParts[i]]) current[pathParts[i]] = {};
        current = current[pathParts[i]];
      }
      current[pathParts[pathParts.length - 1]] = value;
    }

    for (const item of flatStrings) {
      const existingValue = getValueByPath(existingData, item.path);
      if (existingValue !== undefined) {
        // Keep existing translation (even if it's the same as English)
        setValueByPath(newData, item.path, existingValue);
      } else {
        // Mark for translation
        toTranslate.push(item);
      }
    }

    if (toTranslate.length === 0) {
      console.log(`No new keys for ${lang.code}. Skipping.`);
      // Even if no new keys, we still write newData to sync structure/deleted keys
      fs.writeFileSync(targetFilePath, JSON.stringify(newData, null, 2) + '\n');
      continue;
    }

    console.log(`Found ${toTranslate.length} new/missing keys for ${lang.code}. Translating...`);

    const BATCH_SIZE = 25; 
    for (let i = 0; i < toTranslate.length; i += BATCH_SIZE) {
      const batch = toTranslate.slice(i, i + BATCH_SIZE);
      const batchProtected = batch.map(item => protect(item.original));
      const textToTranslate = batchProtected.map(b => b.protectedStr).join(' ||| ');
      
      try {
        const translatedText = await translateText(textToTranslate, lang.code);
        const translatedLines = translatedText.split(/\s*\|\|\|\s*/);
        
        for (let j = 0; j < batch.length; j++) {
          const item = batch[j];
          const transLine = translatedLines[j] !== undefined ? translatedLines[j] : batchProtected[j].protectedStr;
          const finalStr = unprotect(transLine.trim(), batchProtected[j].placeholders);
          setValueByPath(newData, item.path, finalStr);
        }
        
        await new Promise(r => setTimeout(r, 1500)); 
        process.stdout.write('.');
      } catch (err) {
        console.error(`\nError on batch ${i} for ${lang.code}:`, err.message);
        // Fallback to original text if translation fails
        for (const item of batch) {
          setValueByPath(newData, item.path, item.original);
        }
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    
    fs.writeFileSync(targetFilePath, JSON.stringify(newData, null, 2) + '\n');
    console.log(`\nFinished ${lang.file}`);
  }
  console.log('All translations complete via incremental GTX method.');
}

translateAll();
