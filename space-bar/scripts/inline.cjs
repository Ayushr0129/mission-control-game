// Builds dist/ into one self-contained page body for publishing as an Artifact.
const fs = require('fs'), path = require('path');
const dist = path.join(__dirname, '..', 'dist');
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(dist, html.match(/src="\.\/(assets\/[^"]+\.js)"/)[1]), 'utf8');
const css = fs.readFileSync(path.join(dist, html.match(/href="\.\/(assets\/[^"]+\.css)"/)[1]), 'utf8');
if (/<\/script/i.test(js)) throw new Error('script contains </script');
const out = `<title>Space Bar · Chapter 1: Race to the Moon</title>
<style>${css}
.worldbar{top:env(safe-area-inset-top,0px)}
body{padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.screen{padding-left:0;padding-right:0}
</style>
<div id="app"></div>
<script type="module">${js}</script>
`;
fs.writeFileSync(path.join(dist, 'artifact.html'), out);
console.log('artifact.html', (out.length / 1024).toFixed(0) + ' kB');
