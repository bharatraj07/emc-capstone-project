const form = document.getElementById('task-form');
const titleInput = document.getElementById('title');
const priorityInput = document.getElementById('priority');
const list = document.getElementById('task-list');
const healthDot = document.getElementById('health-dot');
const healthText = document.getElementById('health-text');
const countText = document.getElementById('count-text');

async function checkHealth() {
  try {
    const res = await fetch('/health');
    if (!res.ok) throw new Error();
    healthDot.className = 'dot ok';
    healthText.textContent = 'API healthy';
  } catch {
    healthDot.className = 'dot bad';
    healthText.textContent = 'API unreachable';
  }
}

async function loadTasks() {
  const res = await fetch('/api/tasks');
  const tasks = await res.json();
  list.innerHTML = '';
  countText.textContent = `${tasks.length} task${tasks.length === 1 ? '' : 's'}`;
  tasks
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach((t) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <input type="checkbox" ${t.done ? 'checked' : ''} data-id="${t.id}" />
        <span class="title ${t.done ? 'done' : ''}">${escapeHtml(t.title)}</span>
        <span class="priority ${t.priority}">${t.priority}</span>
        <button data-del="${t.id}" title="Delete">✕</button>
      `;
      list.appendChild(li);
    });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  if (!title) return;
  await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, priority: priorityInput.value }),
  });
  titleInput.value = '';
  loadTasks();
});

list.addEventListener('change', async (e) => {
  if (e.target.matches('input[type="checkbox"]')) {
    const id = e.target.dataset.id;
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: e.target.checked }),
    });
    loadTasks();
  }
});

list.addEventListener('click', async (e) => {
  if (e.target.matches('button[data-del]')) {
    const id = e.target.dataset.del;
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    loadTasks();
  }
});

checkHealth();
loadTasks();
setInterval(checkHealth, 15000);
