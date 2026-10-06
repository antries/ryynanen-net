// Luo apps.json: listaa kansion .html-tiedostot (paitsi index.html).
// Aja kansiossa:  node generate-apps.js
const fs = require('fs');
const files = fs.readdirSync(__dirname)
  .filter(f => /\.html?$/i.test(f) && f.toLowerCase() !== 'index.html' && f !== '404.html')
  .sort();
fs.writeFileSync(__dirname + '/apps.json', JSON.stringify(files, null, 2));
console.log('apps.json päivitetty:', files.length, 'tiedostoa');
