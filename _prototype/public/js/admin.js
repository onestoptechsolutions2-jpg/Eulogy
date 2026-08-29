async function api(url, opts = {}) {
  const isFormData = opts.body instanceof FormData;
  return fetch(url, {
    ...opts,
    headers: isFormData ? opts.headers : { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}

function personName(p) {
  const core = [p.first_name, p.prefix, p.surname].filter(Boolean).join(' ').trim();
  return (p.title ? p.title + ' ' : '') + (core || 'Unknown') + (p.suffix ? ' ' + p.suffix : '');
}

async function upload(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await api('/api/admin/upload', { method: 'POST', body: form });
  if (!res.ok) { alert('Upload failed'); return null; }
  return (await res.json()).url;
}

let site = null;
let people = [];

function renderHero() {
  document.getElementById('hero-preview').innerHTML = site.hero_photo
    ? '<img src="' + esc(site.hero_photo) + '" style="width:80px;height:80px;object-fit:cover;border-radius:50%;margin-bottom:0.5rem;">'
    : '';
}

function renderGallery() {
  document.getElementById('gallery-rows').innerHTML = site.gallery.map((p, i) => `
    <div class="gallery-row">
      ${p.src ? '<img src="' + esc(p.src) + '">' : ''}
      <input placeholder="Caption (optional)" value="${esc(p.caption || '')}" data-idx="${i}" class="caption-input">
      <button type="button" class="secondary remove-photo" data-idx="${i}">Remove</button>
    </div>`).join('');
  document.querySelectorAll('.caption-input').forEach((el) => {
    el.addEventListener('input', (e) => { site.gallery[+e.target.dataset.idx].caption = e.target.value; });
  });
  document.querySelectorAll('.remove-photo').forEach((el) => {
    el.addEventListener('click', (e) => {
      site.gallery.splice(+e.target.dataset.idx, 1);
      renderGallery();
    });
  });
}

function renderSubjectOptions() {
  const sel = document.getElementById('f-subject');
  const sorted = [...people].sort((a, b) => personName(a).localeCompare(personName(b)));
  sel.innerHTML = '<option value="">— none —</option>' +
    sorted.map((p) => `<option value="${esc(p.handle)}">${esc(personName(p))}</option>`).join('');
  sel.value = site.subject_handle || '';
}

async function loadSite() {
  const res = await api('/api/admin/site');
  if (!res.ok) return false;
  site = await res.json();
  document.getElementById('f-name').value = site.name || '';
  document.getElementById('f-birth').value = site.birth_date || '';
  document.getElementById('f-death').value = site.death_date || '';
  document.getElementById('f-story').value = site.life_story || '';
  document.getElementById('f-service').value = site.service_details || '';
  document.getElementById('f-donation-link').value = site.donation_link || '';
  document.getElementById('f-donation-label').value = site.donation_label || '';
  renderHero();
  renderGallery();
  return true;
}

document.getElementById('f-hero-file').addEventListener('change', async (e) => {
  if (!e.target.files[0]) return;
  const url = await upload(e.target.files[0]);
  if (url) { site.hero_photo = url; renderHero(); }
});

document.getElementById('f-gallery-file').addEventListener('change', async (e) => {
  if (!e.target.files[0]) return;
  const url = await upload(e.target.files[0]);
  if (url) { site.gallery.push({ src: url, caption: '' }); renderGallery(); }
});

document.getElementById('save-site-btn').addEventListener('click', async () => {
  site.name = document.getElementById('f-name').value;
  site.birth_date = document.getElementById('f-birth').value;
  site.death_date = document.getElementById('f-death').value;
  site.life_story = document.getElementById('f-story').value;
  site.service_details = document.getElementById('f-service').value;
  site.donation_link = document.getElementById('f-donation-link').value;
  site.donation_label = document.getElementById('f-donation-label').value;
  site.subject_handle = document.getElementById('f-subject').value;
  const btn = document.getElementById('save-site-btn');
  btn.disabled = true; btn.textContent = 'Saving...';
  await api('/api/admin/site', { method: 'PUT', body: JSON.stringify(site) });
  btn.disabled = false; btn.textContent = 'Save site content';
});

async function loadGenealogy() {
  const res = await api('/api/admin/genealogy');
  if (!res.ok) return;
  const data = await res.json();
  people = data.people || [];
  renderSubjectOptions();
  renderPeopleEditor();
}

function renderPeopleEditor() {
  const el = document.getElementById('people-editor');
  if (!people.length) { el.innerHTML = '<p style="color:var(--sage)">No family tree loaded yet.</p>'; return; }
  el.innerHTML = people.map((p) => `
    <div class="person-edit" data-handle="${esc(p.handle)}">
      <div class="meta">${esc(personName(p))}</div>
      <div class="pe-row">
        <input class="pe-birth" placeholder="Birth (e.g. 1950 or 1950-04-12)" value="${esc(p.birth_date || '')}">
        <input class="pe-death" placeholder="Death" value="${esc(p.death_date || '')}">
      </div>
      <textarea class="pe-bio" placeholder="A few lines about them (optional)">${esc(p.bio || '')}</textarea>
      <button type="button" class="secondary pe-save">Save</button>
    </div>`).join('');
  el.querySelectorAll('.person-edit').forEach((row) => {
    row.querySelector('.pe-save').addEventListener('click', async () => {
      const btn = row.querySelector('.pe-save');
      btn.disabled = true; btn.textContent = 'Saving...';
      await api('/api/admin/people/' + row.dataset.handle, {
        method: 'PATCH',
        body: JSON.stringify({
          birth_date: row.querySelector('.pe-birth').value,
          death_date: row.querySelector('.pe-death').value,
          bio: row.querySelector('.pe-bio').value,
        }),
      });
      btn.disabled = false; btn.textContent = 'Saved';
      setTimeout(() => { btn.textContent = 'Save'; }, 1500);
    });
  });
}

document.getElementById('import-gramps-btn').addEventListener('click', async () => {
  const input = document.getElementById('f-gramps-file');
  const status = document.getElementById('import-status');
  if (!input.files[0]) { status.textContent = 'Choose a .gramps file first.'; return; }
  const btn = document.getElementById('import-gramps-btn');
  btn.disabled = true; btn.textContent = 'Importing...';
  status.textContent = '';
  const form = new FormData();
  form.append('file', input.files[0]);
  const res = await api('/api/admin/import-gramps', { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  btn.disabled = false; btn.textContent = 'Import family tree';
  if (res.ok) {
    status.textContent = `Loaded ${data.people} people, ${data.families} families.`;
    await loadGenealogy();
  } else {
    status.style.color = 'var(--amber)';
    status.textContent = data.error || 'Import failed.';
  }
});

async function loadContributions() {
  const res = await api('/api/admin/contributions');
  const rows = await res.json();
  const nameByHandle = Object.fromEntries(people.map((p) => [p.handle, personName(p)]));
  const el = document.getElementById('contrib-list');
  el.innerHTML = rows.length ? rows.map((r) => `
    <div class="card ${r.status}">
      <div class="meta">${esc(r.name)} — ${esc(r.relationship)}${r.relationship_detail ? ' (' + esc(r.relationship_detail) + ')' : ''} · ${r.status}${r.featured ? ' · featured' : ''}${r.about_handle && nameByHandle[r.about_handle] ? ' · about ' + esc(nameByHandle[r.about_handle]) : ''}</div>
      <div>${esc(r.memory)}</div>
      <div class="actions">
        <button data-id="${r.id}" data-patch='{"status":"approved"}'>Approve</button>
        <button data-id="${r.id}" data-patch='{"status":"rejected"}'>Reject</button>
        <button data-id="${r.id}" data-patch='{"featured":true}'>Feature as quote</button>
        <button data-id="${r.id}" data-patch='{"featured":false}'>Unfeature</button>
        <button class="secondary" data-id="${r.id}" data-delete="1">Delete</button>
      </div>
    </div>`).join('') : '<p>No contributions yet.</p>';
  el.querySelectorAll('button[data-patch]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api('/api/admin/contributions/' + btn.dataset.id, { method: 'PATCH', body: btn.dataset.patch });
      loadContributions();
    });
  });
  el.querySelectorAll('button[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this contribution permanently?')) return;
      await api('/api/admin/contributions/' + btn.dataset.id, { method: 'DELETE' });
      loadContributions();
    });
  });
}

async function loadGuestbook() {
  const res = await fetch('/api/guestbook');
  const rows = await res.json();
  const el = document.getElementById('guestbook-list');
  el.innerHTML = rows.length ? rows.map((g) => `
    <div class="card approved">
      <div class="meta">${esc(g.name)}</div>
      <div>${esc(g.message)}</div>
      <div class="actions"><button class="secondary" data-id="${g.id}">Delete</button></div>
    </div>`).join('') : '<p>No messages yet.</p>';
  el.querySelectorAll('button[data-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this guestbook message?')) return;
      await api('/api/guestbook/' + btn.dataset.id, { method: 'DELETE' });
      loadGuestbook();
    });
  });
}

document.getElementById('logout-btn').addEventListener('click', async () => {
  await api('/api/admin/logout', { method: 'POST' });
  window.location.reload();
});

async function unlock() {
  document.getElementById('login-gate').style.display = 'none';
  document.getElementById('admin-panel').style.display = 'block';
  await loadSite();
  await loadGenealogy();   // fills people[] — contributions render needs it for "about" names
  renderSubjectOptions();
  loadContributions();
  loadGuestbook();
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = document.getElementById('pw').value;
  const res = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) });
  if (res.ok) { unlock(); }
  else {
    const err = document.getElementById('login-error');
    err.style.display = 'block';
    err.textContent = (await res.json()).error || 'Login failed';
  }
});

// If already logged in (session cookie still valid), skip the gate
loadSite().then((ok) => { if (ok) unlock(); });
