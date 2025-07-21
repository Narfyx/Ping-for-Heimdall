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