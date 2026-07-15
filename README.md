## Local Development

The gateway proxies to two downstream services for local testing.

**Service A (port 4001)**
```bash
mkdir service-a && cd service-a
npm init -y && npm install express
```

Create `index.js`:
\```js
const express = require('express')
const app = express()
let failing = false
app.get('/data', (req, res) => failing ? res.status(500).json({ error: 'down' }) : res.json({ service: 'A' }))
app.get('/break', (req, res) => { failing = true; res.json({ message: 'now failing' }) })
app.get('/fix', (req, res) => { failing = false; res.json({ message: 'recovered' }) })
app.listen(4001, () => console.log('Service A on 4001'))
\```

**Service B (port 4002)** — same setup, change port to 4002 and service name to 'B'.