// Lukee tämän kansion .html-tiedostot ja kirjoittaa apps.json-listan samaan kansioon.
// Netlify ajaa tämän joka deployssa (ks. netlify.toml), joten apps.json ei ole repossa.
const fs = require("fs");
const path = require("path");

const skip = ["index.html", "404.html"];
const files = fs.readdirSync(__dirname)
  .filter(f => /\.html?$/i.test(f) && !skip.includes(f.toLowerCase()))
  .sort((a, b) => a.localeCompare(b, "fi", { numeric: true }));

fs.writeFileSync(path.join(__dirname, "apps.json"), JSON.stringify(files, null, 2));
console.log("apps.json päivitetty: " + files.length + " tiedostoa");
