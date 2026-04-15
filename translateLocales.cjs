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
    console.log(`Starting translation for ${lang.code}...`);
    const newData = JSON.parse(fileContent);
    
    const BATCH_SIZE = 25; // Smaller batch for stability
    
    for (let i = 0; i < flatStrings.length; i += BATCH_SIZE) {
      const batch = flatStrings.slice(i, i + BATCH_SIZE);
      const batchProtected = batch.map(item => protect(item.original));
      const textToTranslate = batchProtected.map(b => b.protectedStr).join(' ||| ');
      
      try {
        const translatedText = await translateText(textToTranslate, lang.code);
        const translatedLines = translatedText.split(/\s*\|\|\|\s*/);
        
        for (let j = 0; j < batch.length; j++) {
          const item = batch[j];
          const transLine = translatedLines[j] !== undefined ? translatedLines[j] : batchProtected[j].protectedStr;
          const finalStr = unprotect(transLine.trim(), batchProtected[j].placeholders);
          
          let current = newData;
          for (let k = 0; k < item.path.length - 1; k++) {
            current = current[item.path[k]];
          }
          current[item.path[item.path.length - 1]] = finalStr;
        }
        
        await new Promise(r => setTimeout(r, 1500)); // Sleep to avoid rate limits
        process.stdout.write('.');
      } catch (err) {
        console.error(`\nError on batch ${i} for ${lang.code}:`, err.message);
        for (let j = 0; j < batch.length; j++) {
          const item = batch[j];
          let current = newData;
          for (let k = 0; k < item.path.length - 1; k++) {
            current = current[item.path[k]];
          }
          current[item.path[item.path.length - 1]] = item.original;
        }
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    
    fs.writeFileSync(`src/locales/${lang.file}`, JSON.stringify(newData, null, 2) + '\n');
    console.log(`\nFinished ${lang.file}`);
  }
  console.log('All translations complete via GTX method.');
}

translateAll();
