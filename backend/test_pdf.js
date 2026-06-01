import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const mammoth = require('mammoth');
const csv = require('csv-parser');
console.log(typeof mammoth.extractRawText, typeof csv);
