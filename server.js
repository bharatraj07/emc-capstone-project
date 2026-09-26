// server.js
// -----------------------------------------------------------------------------
// Entry point for the app. Kept deliberately thin: it wires up middleware,
// mounts routes, and starts the HTTP server. Business logic lives in routes/.
// -----------------------------------------------------------------------------

const express = require('express');
const path = require('path');
const client = require('prom-client');

const tasksRouter = require('./routes/tasks');

const app = express();

// PORT comes from an environment variable, not hardcoded.
// WHY: this is the same image that runs in Docker on EC2. Docker/Jenkins can
// remap ports at deploy time (e.g. -p 80:3000) without us rebuilding the image.
const PORT = process.env.PORT || 3000;

app.use(express.json());

// -----------------------------------------------------------------------------
// Serve the static dashboard (public/) that talks to the REST API below.
// WHY a static frontend instead of a template engine: one container, one
// process, no build step needed inside Docker -> smaller, simpler image.
// -----------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));

// -----------------------------------------------------------------------------
// REST API
// -----------------------------------------------------------------------------
app.use('/api/tasks', tasksRouter);

// -----------------------------------------------------------------------------
// Health check endpoint.
// WHY: Docker (HEALTHCHECK), Jenkins (post-deploy smoke test), and load
// balancers all need a cheap, dependency-free way to ask "is this app alive?"
// without touching real data.
// -----------------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// -----------------------------------------------------------------------------
// Prometheus metrics endpoint.
// WHY prom-client + a /metrics route (rather than installing something extra):
// Prometheus works on a "pull" model — it scrapes an HTTP endpoint on a
// schedule. Exposing our own app-level metrics (request counts, latency) here,
// alongside Node Exporter's OS-level metrics on the same box, gives Grafana
// both "is the server healthy" and "is the app healthy" in one dashboard.
// -----------------------------------------------------------------------------
const register = new client.Registry();
client.collectDefaultMetrics({ register }); // event loop lag, memory, GC, etc.

const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = req.route ? req.route.path : req.path;
    const labels = { method: req.method, route, status_code: res.statusCode };
    httpRequestCounter.inc(labels);
    end(labels);
  });
  next();
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Only start listening if this file is run directly (not when required by tests).
// WHY: lets Jest import the `app` object and run requests against it in-memory,
// without actually binding to a network port during CI.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`ops-task-tracker listening on port ${PORT}`);
  });
}

module.exports = app;
