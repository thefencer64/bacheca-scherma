/**
 * genera-icone.js
 * Genera le icone PWA usando Canvas (Node.js con canvas)
 * 
 * Installazione: npm install canvas
 * Esecuzione:    node genera-icone.js
 */

const { createCanvas } = require('canvas');
const fs               = require('fs');
const path             = require('path');

const DIMENSIONI = [72, 96, 128, 144, 152, 192, 384, 512];
const OUTPUT_DIR = path.join(__dirname, 'public', 'icons');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function generaIcona(size) {
  const canvas  = createCanvas(size, size);
  const ctx     = canvas.getContext('2d');
  const raggio  = size * 0.22; // border radius proporzionale

  // Sfondo con angoli arrotondati (colore navy Brianzascherma)
  ctx.fillStyle = '#00244F';
  ctx.beginPath();
  ctx.moveTo(raggio, 0);
  ctx.lineTo(size - raggio, 0);
  ctx.arcTo(size, 0, size, raggio, raggio);
  ctx.lineTo(size, size - raggio);
  ctx.arcTo(size, size, size - raggio, size, raggio);
  ctx.lineTo(raggio, size);
  ctx.arcTo(0, size, 0, size - raggio, raggio);
  ctx.lineTo(0, raggio);
  ctx.arcTo(0, 0, raggio, 0, raggio);
  ctx.closePath();
  ctx.fill();

  // Lettera "B" centrata (colore azzurro Brianzascherma)
  const fontSize = Math.round(size * 0.52);
  ctx.fillStyle  = '#0179C0';
  ctx.font       = `bold ${fontSize}px sans-serif`;
  ctx.textAlign  = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('B', size / 2, size / 2 + size * 0.03);

  // Salva PNG
  const buffer   = canvas.toBuffer('image/png');
  const filename = path.join(OUTPUT_DIR, `icon-${size}.png`);
  fs.writeFileSync(filename, buffer);
  console.log(`✓ icon-${size}.png`);
}

DIMENSIONI.forEach(generaIcona);
console.log(`\nIcone generate in ${OUTPUT_DIR}`);
