const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/GlobalPlayerBar.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const seekOld = `  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(pct);
  };

`;
// Only replace the *last* instance of handleSeek block (which is in GlobalPlayerBar)
const lastIndex = content.lastIndexOf(seekOld);
if (lastIndex !== -1) {
    content = content.substring(0, lastIndex) + content.substring(lastIndex + seekOld.length);
}

fs.writeFileSync(filePath, content);
console.log("Fixed GlobalPlayerBar.tsx - removed duplicate handleSeek");
