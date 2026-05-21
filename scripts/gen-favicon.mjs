import { readFileSync, writeFileSync } from 'fs';

const data = readFileSync('./public/favicon-32.png');
const b64  = data.toString('base64');
const svg  = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><image href="data:image/png;base64,${b64}" width="32" height="32"/></svg>`;
writeFileSync('./public/favicon.svg', svg);
console.log('favicon.svg updated:', svg.length, 'chars');
