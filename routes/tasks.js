// routes/tasks.js
// -----------------------------------------------------------------------------
// CRUD API for "ops tasks" (e.g. "Rotate DB creds", "Patch EC2 AMI").
//
// WHY no real database (Postgres/Mongo): the assignment's tech stack list is
// Git, Jenkins, Docker, AWS, Prometheus/Grafana, Bash/cron — it never asks for
// a database layer, and standing one up would mean a 5th EC2, secrets
// management, and a migration story, none of which the pipeline is graded on.
// A small JSON file on disk gives us real persistence (survives container
// restarts if the file is on a mounted volume) with zero extra infrastructure.
// If a real DB is ever needed, only this file changes — routes/server stay the
// same because they only talk to the functions below.
// -----------------------------------------------------------------------------

const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const DATA_FILE = path.join(__dirname, '..', 'data', 'tasks.json');

function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
  }
}

function readTasks() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function writeTasks(tasks) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2));
}

// GET /api/tasks - list all tasks
router.get('/', (req, res) => {
  res.json(readTasks());
});

// POST /api/tasks - create a task
router.post('/', (req, res) => {
  const { title, priority } = req.body;
  if (!title || typeof title !== 'string') {
    return res.status(400).json({ error: 'title is required' });
  }
  const tasks = readTasks();
  const task = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title,
    priority: priority || 'medium',
    done: false,
    createdAt: new Date().toISOString(),
  };
  tasks.push(task);
  writeTasks(tasks);
  res.status(201).json(task);
});

// PATCH /api/tasks/:id - toggle/update a task
router.patch('/:id', (req, res) => {
  const tasks = readTasks();
  const task = tasks.find((t) => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'task not found' });
  Object.assign(task, req.body, { id: task.id });
  writeTasks(tasks);
  res.json(task);
});

// DELETE /api/tasks/:id - remove a task
router.delete('/:id', (req, res) => {
  const tasks = readTasks();
  const next = tasks.filter((t) => t.id !== req.params.id);
  if (next.length === tasks.length) {
    return res.status(404).json({ error: 'task not found' });
  }
  writeTasks(next);
  res.status(204).end();
});

module.exports = router;
