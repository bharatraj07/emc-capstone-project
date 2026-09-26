# Ops Task Tracker — DevOps Capstone

A small REST API + dashboard for tracking ops tasks, built to demonstrate a
complete CI/CD pipeline: **GitHub → Jenkins → SonarQube → Docker Hub → EC2 →
Prometheus/Grafana**, with automated backups via cron.

## Tech stack

| Layer | Tool |
|---|---|
| App | Node.js 20, Express |
| Frontend | Plain HTML/CSS/JS (no framework/build step) |
| Tests | Jest + Supertest |
| Source control | Git + GitHub |
| CI/CD | Jenkins (Declarative Pipeline) |
| Code quality | SonarQube |
| Containerization | Docker (multi-stage build) + Docker Hub |
| Hosting | AWS EC2 (Ubuntu) |
| Monitoring | Prometheus + Node Exporter + Grafana |
| Automation | Bash + cron |

## Architecture

```
Developer
   │  git push
   ▼
GitHub  ───────────────► triggers ───────────────►  Jenkins (EC2 #1: Docker+Jenkins)
                                                          │
                                       ┌──────────────────┼───────────────────┐
                                       ▼                  ▼                   ▼
                                  npm ci / test     SonarQube scan      docker build
                                                     (EC2 #2)                 │
                                                                               ▼
                                                                        docker push
                                                                               │
                                                                               ▼
                                                                     docker run (same
                                                                      EC2 #1, local)
                                                                               │
                                       ┌───────────────────────────────────────┘
                                       ▼
                          Prometheus (EC2 #3) scrapes /metrics + node_exporter
                                       │
                                       ▼
                             Grafana (EC2 #4) dashboards

Nightly: cron on EC2 #1 runs scripts/backup.sh → backs up data + logs
```

## Run locally

```bash
npm install
npm test        # runs the Jest suite
npm start        # http://localhost:3000
```

## Run in Docker

```bash
docker build -t ops-task-tracker .
docker run -d -p 3000:3000 -v ops-task-data:/app/data --name ops-task-tracker ops-task-tracker
```

## CI/CD flow (what Jenkins does on every push)

1. **Checkout** — pulls the latest commit from GitHub.
2. **Install dependencies** — `npm ci` for a clean, reproducible install.
3. **Test** — runs the Jest suite; the pipeline stops here if anything fails.
4. **SonarQube Analysis + Quality Gate** — static analysis for bugs, code
   smells, and security hotspots; the pipeline aborts if the quality gate
   fails.
5. **Build Docker image** — multi-stage build, tagged with the Jenkins build
   number and `latest`.
6. **Push to Docker Hub** — publishes the image so it's available outside
   this one Jenkins box.
7. **Deploy** — pulls the freshly pushed image and replaces the running
   container, with a named volume so task data survives the redeploy.
8. **Verify deployment** — hits `/health` to confirm the new container is
   actually serving traffic, not just "running."

See `Jenkinsfile` for the full pipeline with inline reasoning on every stage.

## Monitoring

- App exposes Prometheus-format metrics at `GET /metrics` (request counts,
  latency histograms, default Node.js process metrics).
- `monitoring/prometheus.yml` is the scrape config that goes on the
  Prometheus EC2 — it also pulls host-level metrics from Node Exporter
  running on the app EC2.
- Import a Node.js/Express dashboard into Grafana (or build one) pointed at
  the Prometheus data source to visualize request rate, latency, and error
  rate alongside CPU/memory from Node Exporter.

## Backups

`scripts/backup.sh`, run nightly via cron on the app EC2, copies the task
data file and the last 24h of container logs out to `~/backups/`, and prunes
anything older than 14 days. See the script for the crontab line to install it.

## Environment / secrets used by Jenkins

- `dockerhub-creds` — Jenkins credential (username + password/token) for
  `docker login`.
- SonarQube token — configured once under Jenkins → Manage Jenkins →
  System → SonarQube servers, referenced by name (`SonarQubeServer`) in the
  Jenkinsfile.

None of these are stored in the repo — that's the whole point of using
Jenkins credentials rather than hardcoding them.
