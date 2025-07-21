(function() {
  const RAW_PING    = 'http://10.10.10.104:3000/ping';
  const RAW_HEALTH  = 'http://10.10.10.104:3000/health';
  const PROXY_BASE  = window.location.origin;
  const PROXY_PING  = PROXY_BASE + '/ping';
  const PROXY_HEALTH= PROXY_BASE + '/health';
  const useProxy    = window.location.protocol === 'https:';

  const PING_URL   = useProxy ? PROXY_PING   : RAW_PING;
  const HEALTH_URL = useProxy ? PROXY_HEALTH : RAW_HEALTH;

  let adblockSuspected = false;

  // Pré‑vérification
  fetch(HEALTH_URL, { mode:'cors' })
    .then(r => { adblockSuspected = !r.ok; })
    .catch(() => { adblockSuspected = true; })
    .finally(startScan);

  function startScan() {
    document.querySelectorAll('.item').forEach(initTile);
  }

  function initTile(tile) {
    if (tile.dataset.pingInit) return;
    tile.dataset.pingInit = '1';

    const link = tile.querySelector('a.link');
    if (!link) return;

    const { hostname, port: rawPort } = new URL(link.href);
    const host = encodeURIComponent(hostname.replace(/\^/g, ''));

    let portNum = parseInt(rawPort, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) portNum = 80;
    const port = encodeURIComponent(portNum);

    const url = `${PING_URL}?host=${host}&port=${port}`;

    const indicator = document.createElement('span');
    Object.assign(indicator.style, {
      position: 'absolute', top: '5px', right: '5px',
      width: '12px', height: '12px', borderRadius: '50%',
      backgroundColor: '#ccc', boxShadow: '0 0 2px rgba(0,0,0,0.5)',
      cursor: 'default', zIndex: 10
    });
    indicator.title = 'Vérification…';
    tile.style.position = 'relative';
    tile.appendChild(indicator);

    fetch(url, { mode:'cors' })
      .then(resp => {
        if (!resp.ok) throw new Error(`HTTP_${resp.status}`);
        return resp.json();
      })
      .then(json => {
        indicator.style.backgroundColor = json.status === 'up' ? 'lime' : 'crimson';
        indicator.title = `BACKEND – ${json.status.toUpperCase()} – ${json.code}: ${json.message}`;
      })
      .catch(err => {
        indicator.style.backgroundColor = 'crimson';
        if (adblockSuspected) {
          indicator.title = 'BLOQUÉ PAR AD‑BLOCKER / MIXED‑CONTENT';
        } else if (err.message.startsWith('HTTP_')) {
          indicator.title = `ERREUR BACKEND – ${err.message}`;
        } else {
          indicator.title = `SERVICE INJOIGNABLE – ${err.name}: ${err.message}`;
        }
      });
  }
})();