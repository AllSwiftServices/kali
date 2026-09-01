import fs from 'fs';
import path from 'path';

const SRC_DIR = '/Users/daniel/Downloads/real-apex-trade-go/src/pages';
const DEST_DIR = '/Users/daniel/Documents/avent-ridge/src/app';

const pages = [
  'AdminKYC',
  'Dashboard',
  'LiveTrading',
  'Markets',
  'Portfolio',
  'Profile',
  'TradingHistory',
  'VerifyIdentity',
  'WalletPage'
];

for (const page of pages) {
  const src = path.join(SRC_DIR, `${page}.jsx`);
  const destDir = path.join(DEST_DIR, page.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, ''));
  const dest = path.join(destDir, 'page.tsx');
  
  if (fs.existsSync(src)) {
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    let content = fs.readFileSync(src, 'utf8');
    content = `"use client";\n\n` + content;
    fs.writeFileSync(dest, content);
  }
}

const homeDest = path.join(DEST_DIR, 'page.tsx');
if (fs.existsSync(path.join(SRC_DIR, 'Home.jsx'))) {
  let homeContent = fs.readFileSync(path.join(SRC_DIR, 'Home.jsx'), 'utf8');
  if (!homeContent.includes('"use client"')) {
    homeContent = `"use client";\n\n` + homeContent;
  }
  fs.writeFileSync(homeDest, homeContent);
}

function walkSync(dir, callback) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) walkSync(p, callback);
    else callback(p);
  }
}

walkSync('/Users/daniel/Documents/avent-ridge/src', (filePath) => {
  const ext = path.extname(filePath);
  if (!['.ts', '.tsx', '.css'].includes(ext)) return;

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    content = content.replace(/Real Apex Trade/g, 'AR Trading');
    content = content.replace(/RealApexTrade/g, 'AventRidge');
    content = content.replace(/Apex Trade/g, 'AR Trading');
    content = content.replace(/Base44/g, 'AR Trading');
    content = content.replace(/import\.meta\.env\.VITE_/g, 'process.env.NEXT_PUBLIC_');
    content = content.replace(/import\.meta\.env/g, 'process.env');
    
    // Switch routing package
    content = content.replace(/['"]react-router-dom['"]/g, `'@/lib/react-router-shim'`);

    if (content !== original) fs.writeFileSync(filePath, content);
  } catch(e) {}
});

console.log("Migration complete!");
