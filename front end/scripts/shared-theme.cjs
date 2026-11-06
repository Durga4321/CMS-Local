const fs = require('node:fs');
const path = require('node:path');

// Both localhost and LAN requests reach this single development server.
module.exports = function sharedTheme(root) {
  const file = path.join(root, '.cms-theme.json');
  return (req, res, next) => {
    if (req.url.split('?')[0] !== '/__cms/theme') return next();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    const reply = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
    if (req.method === 'GET') {
      try { reply(200, JSON.parse(fs.readFileSync(file, 'utf8'))); }
      catch (error) { reply(error.code === 'ENOENT' ? 200 : 500, null); }
      return;
    }
    if (req.method !== 'PUT') return reply(405, { error: 'Method not allowed' });
    let body = '';
    req.on('data', chunk => { if (body.length <= 4096) body += chunk; });
    req.on('end', () => {
      let theme;
      try { theme = JSON.parse(body); } catch { return reply(400, { error: 'Invalid theme' }); }
      if (body.length > 4096 || typeof theme?.id !== 'string' || theme.id.length > 32 ||
        !['color', 'dark', 'soft', 'glow'].every(key => /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(theme[key] || ''))) {
        return reply(400, { error: 'Invalid theme' });
      }
      const saved = Object.fromEntries(['id', 'color', 'dark', 'soft', 'glow'].map(key => [key, theme[key]]));
      try {
        fs.writeFileSync(`${file}.tmp`, JSON.stringify(saved));
        fs.renameSync(`${file}.tmp`, file);
        reply(200, saved);
      } catch { reply(500, { error: 'Unable to save shared theme' }); }
    });
  };
};
