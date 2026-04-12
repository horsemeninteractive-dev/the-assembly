const fs = require('fs');
const { translate } = require('@vitalets/google-translate-api');
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
  // Translate API sometimes adds spaces: [ 0 ] or [0 ]
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

async function translateAll() {
  for (const lang of langs) {
    console.log(`Starting translation for ${lang.code}...`);
    // Create a fresh clone of the English object structure
    const newData = JSON.parse(fileContent);
    
    // Batch into chunks to respect API limits
    const BATCH_SIZE = 40;
    
    for (let i = 0; i < flatStrings.length; i += BATCH_SIZE) {
      const batch = flatStrings.slice(i, i + BATCH_SIZE);
      const batchProtected = batch.map(item => protect(item.original));
      const textToTranslate = batchProtected.map(b => b.protectedStr).join(' \\n '); // Use a very specific separator
      
      try {
        const res = await translate(textToTranslate, { to: lang.code });
        const translatedLines = res.text.split(/ \\\s*n\s*|\\n|\n/); // Various ways it might split back
        
        // Match up translated lines
        for (let j = 0; j < batch.length; j++) {
          const item = batch[j];
          const transLine = translatedLines[j] || batchProtected[j].protectedStr;
          const finalStr = unprotect(transLine.trim(), batchProtected[j].placeholders);
          
          // Inject back into object
          let current = newData;
          for (let k = 0; k < item.path.length - 1; k++) {
            current = current[item.path[k]];
          }
          current[item.path[item.path.length - 1]] = finalStr;
        }
        
        // Wait a tiny bit to avoid rate limiting
        await new Promise(r => setTimeout(r, 600));
        process.stdout.write('.');
      } catch (err) {
        console.error(`\nError on batch ${i} for ${lang.code}:`, err.message);
        // Fallback: just put english text back for failed chunks
        for (let j = 0; j < batch.length; j++) {
          const item = batch[j];
          let current = newData;
          for (let k = 0; k < item.path.length - 1; k++) {
            current = current[item.path[k]];
          }
          current[item.path[item.path.length - 1]] = item.original;
        }
      }
    }
    
    fs.writeFileSync(`src/locales/${lang.file}`, JSON.stringify(newData, null, 2));
    console.log(`\nFinished ${lang.file}`);
  }
  console.log('All translations complete.');
}

translateAll();
