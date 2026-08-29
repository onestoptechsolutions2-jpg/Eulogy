const steps = document.querySelectorAll('.step');
let current = 0;
const backBtn = document.getElementById('back-btn');
const nextBtn = document.getElementById('next-btn');

function show(i) {
  steps.forEach((s, idx) => s.classList.toggle('active', idx === i));
  backBtn.disabled = i === 0;
  nextBtn.textContent = i === steps.length - 1 ? 'Submit' : 'Next';
}

function validate(i) {
  if (i === 0) return document.getElementById('name').value.trim() && document.getElementById('relationship').value.trim();
  if (i === 1) return document.getElementById('memory').value.trim();
  return true;
}

function renderReview() {
  const name = document.getElementById('name').value.trim();
  const rel = document.getElementById('relationship').value.trim();
  const memory = document.getElementById('memory').value.trim();
  const review = document.getElementById('review');
  review.innerHTML = '';
  const p1 = document.createElement('p');
  const strong = document.createElement('strong');
  strong.textContent = name;
  p1.append(strong, document.createTextNode(' — ' + rel));
  const p2 = document.createElement('p');
  p2.textContent = memory;
  review.append(p1, p2);
}

backBtn.addEventListener('click', () => { current--; show(current); });

nextBtn.addEventListener('click', async () => {
  if (!validate(current)) { alert('Please fill in this step before continuing.'); return; }

  if (current === 1) renderReview();

  if (current === steps.length - 1) {
    nextBtn.disabled = true;
    try {
      const res = await fetch('/api/contributions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: document.getElementById('name').value.trim(),
          relationship: document.getElementById('relationship').value.trim(),
          relationshipDetail: document.getElementById('detail').value.trim(),
          memory: document.getElementById('memory').value.trim(),
          aboutHandle: document.getElementById('about') ? document.getElementById('about').value : '',
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Request failed');
      }
      document.getElementById('wizard-form').style.display = 'none';
      document.getElementById('success').style.display = 'block';
    } catch (err) {
      alert(err.message === 'Request failed' || !err.message
        ? 'Something went wrong submitting your memory. Please try again in a moment.'
        : err.message);
      nextBtn.disabled = false;
    }
    return;
  }

  current++;
  show(current);
});
