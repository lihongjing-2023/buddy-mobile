const fs = require('fs');
const path = require('path');

function walk(dir) {
  fs.readdirSync(dir).forEach(f => {
    const p = path.join(dir, f);
    const s = fs.statSync(p);
    if (s.isDirectory() && f !== 'node_modules') {
      walk(p);
    } else if (/\.(tsx|ts)$/.test(f)) {
      let c = fs.readFileSync(p, 'utf8');
      const orig = c;
      c = c.replace(/#0F0E17/gi, '__BG_PAGE__');
      c = c.replace(/#1A1925/gi, '__BG_CARD__');
      c = c.replace(/#232228/gi, '__BORDER__');
      c = c.replace(/#E4E4E7/gi, '__TEXT_PRIMARY__');
      if (c !== orig) {
        fs.writeFileSync(p, c);
        console.log('Updated:', p);
      }
    }
  });
}

walk('src');
console.log('Done!');
