document.getElementById('gb-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('gb-name').value.trim();
  const message = document.getElementById('gb-message').value.trim();
  if (!name || !message) return;
  const btn = document.getElementById('gb-submit');
  btn.disabled = true;
  const res = await fetch('/api/guestbook', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, message }),
  });
  btn.disabled = false;
  if (res.ok) {
    document.getElementById('gb-form').style.display = 'none';
    const s = document.getElementById('gb-status');
    s.style.display = 'block';
    s.textContent = 'Thank you — your message has been added below.';
    const list = document.getElementById('gb-list');
    const entry = document.createElement('div');
    entry.className = 'guestbook-entry';
    entry.innerHTML = '<div class="meta"></div><div></div>';
    entry.querySelector('.meta').textContent = name;
    entry.querySelector('div:last-child').textContent = message;
    list.prepend(entry);
  } else {
    const s = document.getElementById('gb-status');
    s.style.display = 'block';
    s.style.color = 'var(--amber)';
    const body = await res.json().catch(() => ({}));
    s.textContent = body.error || 'Something went wrong — please try again.';
  }
});
