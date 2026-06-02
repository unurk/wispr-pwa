// Generiert icon-192.png und icon-512.png mit Node.js (kein Canvas nötig — reines SVG→PNG via sharp)
// Läuft einmalig: node generate-icons.js
const fs = require('fs');

const svg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="#0f0f0f"/>
  <circle cx="${size/2}" cy="${size/2}" r="${size * 0.35}" fill="#6366f1"/>
  <text x="${size/2}" y="${size/2 + size*0.12}" font-size="${size * 0.35}" text-anchor="middle" font-family="sans-serif">🎤</text>
</svg>`;

fs.writeFileSync('icon-192.svg', svg(192));
fs.writeFileSync('icon-512.svg', svg(512));
console.log('SVG icons written. Convert them to PNG via https://cloudconvert.com/svg-to-png or any tool.');
