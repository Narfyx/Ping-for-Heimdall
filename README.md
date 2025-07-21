# Ping-for-Heimdall

Ce document décrit la mise en place d’une API Node.js pour exécuter des ping TCP et l’intégration d’un script client dans Heimdall pour afficher, sur chaque tuile, un indicateur de disponibilité.

---

## 1. Backend : ping‑service

### Prérequis

- Node.js ≥ 18  
- npm (inclus avec Node.js)

### Fichier `package.json`

Créez un fichier `package.json` à la racine de votre projet :

```json
{
  "name": "ping-service",
  "version": "1.0.0",
  "type": "module",
  "main": "ping-service.js",
  "scripts": {
    "start": "node ping-service.js"
  },
  "dependencies": {
    "express": "^5.1.0",
    "cors": "^2.8.5"
  }
}
```

### Fichier `ping-service.js`

```js
import express from 'express';
import cors    from 'cors';
import net     from 'net';

const app = express();
app.use(cors());

//  ➔ Health‑check minimal pour détecter ad‑blocker ou mixed‑content
app.get('/health', (req, res) => {
  res.send('pong');
});

//  ➔ Route de ping TCP
// GET /ping?host=HOTE&port=PORT
app.get('/ping', (req, res) => {
  const rawHost = req.query.host || '';
  const host    = decodeURIComponent(rawHost).replace(/\^/g, '');
  let   port    = parseInt(req.query.port, 10);
  if (isNaN(port) || port < 1 || port > 65535) port = 80;

  const socket  = new net.Socket();
  const timeout = 2000;
  let   done    = false;

  socket.setTimeout(timeout);

  socket.on('connect', () => {
    if (done) return;
    done = true;
    res.json({ status: 'up',   code: 'CONNECT', message: 'Connexion établie' });
    socket.destroy();
  });

  socket.on('timeout', () => {
    if (done) return;
    done = true;
    res.json({ status: 'down', code: 'TIMEOUT', message: `Pas de réponse après ${timeout} ms` });
    socket.destroy();
  });

  socket.on('error', err => {
    if (done) return;
    done = true;
    res.json({ status: 'down', code: 'ERROR',   message: err.message });
  });

  socket.connect(port, host);
});

//  ➔ Démarrage sur toutes les interfaces
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Ping service running on port ${PORT}`);
});
```

### Installation & lancement

1. Dans le dossier contenant `package.json` et `ping-service.js`, exécutez :
    
    ```bash
    npm install
    npm start
    ```
    
2. Vérifiez la route de santé :
    
    ```bash
    curl http://localhost:3000/health
    # → pong
    ```
    
3. Testez un ping :
    
    ```bash
    curl "http://localhost:3000/ping?host=10.10.10.1&port=80"
    # → {"status":"up","code":"CONNECT","message":"Connexion établie"}
    ```
    

---

## 2. Client : ping‑client pour Heimdall

### Fichier à intégrer depuis l'interface web de Heimdall: Réglages -> JavaScript personnalisé

```js
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
```

# Résultat:
![[Pasted image 20250721210313.png]]

