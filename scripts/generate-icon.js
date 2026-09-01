const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgBuffer = Buffer.from(`
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="128" fill="hsl(45, 100%, 51%)" />
  <svg x="128" y="128" width="256" height="256" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>
  </svg>
</svg>
`);

// output path
const outputPath = path.join(__dirname, '..', 'public', 'icon.png');

sharp(svgBuffer)
  .png()
  .toFile(outputPath)
  .then(() => {
    console.log('Successfully generated public/icon.png');
  })
  .catch(err => {
    console.error('Error generating icon:', err);
  });
