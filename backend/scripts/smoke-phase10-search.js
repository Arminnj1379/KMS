/**
 * Phase 10 live check: Persian affix recall (file-based so Persian literals
 * stay intact — the PS console mangles inline Persian).
 * Run: node scripts/smoke-phase10-search.js  (API on :3001, STORAGE_DRIVER=local)
 */
const BASE = 'http://localhost:3001/api';

let failures = 0;
function check(name, cond, extra = '') {
  if (cond) console.log(`PASS ${name}`);
  else {
    failures++;
    console.log(`FAIL ${name} ${extra}`);
  }
}

async function call(method, path, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

(async () => {
  const ts = String(Date.now()).slice(-6);
  const email = `p10admin${ts}@example.com`;

  const reg = await call('POST', '/auth/register', null, {
    fullName: 'P10 Admin',
    email,
    password: 'Secret123!',
    organizationName: `P10 Org ${ts}`,
  });
  check('register-201', reg.status === 201, `got ${reg.status}`);
  const token = reg.data.accessToken;

  const kb = await call('POST', '/knowledge-bases', token, {
    title: `P10 KB ${ts}`,
    slug: `p10-kb-${ts}`,
    visibility: 'internal',
  });
  check('kb-create', kb.status === 201, `got ${kb.status}`);
  const kbSlug = kb.data.slug;

  const doc = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'متن راهنما برای جست‌وجو' }] }],
  };
  const art = await call('POST', `/knowledge-bases/${kbSlug}/articles`, token, {
    title: 'راهنما',
    slug: `p10-rahbar-${ts}`,
    contentJson: doc,
  });
  check('article-create', art.status === 201, `got ${art.status}`);

  // Affixed query: exact $text token is «راهنمای», doc has «راهنما».
  const affixed = await call('GET', `/search?q=${encodeURIComponent('راهنمای')}`, token);
  check('affixed-recall', affixed.status === 200 && affixed.data.total >= 1, JSON.stringify(affixed.data).slice(0, 200));
  check('affixed-via-fallback', affixed.data && affixed.data.mode === 'regex', `mode=${affixed.data && affixed.data.mode}`);
  check(
    'affixed-hit-is-ours',
    affixed.data && affixed.data.items.some((i) => i.slug === `p10-rahbar-${ts}`),
  );

  // Exact query still recalls.
  const exact = await call('GET', `/search?q=${encodeURIComponent('راهنما')}`, token);
  check('exact-recall', exact.status === 200 && exact.data.total >= 1);

  // Negative control: nonsense affixed word recalls nothing (no over-matching).
  const nope = await call('GET', `/search?q=${encodeURIComponent('زقزقیله‌ها')}`, token);
  check('negative-empty', nope.status === 200 && nope.data.total === 0, `total=${nope.data && nope.data.total}`);

  console.log(`SMOKE-P10 done failures=${failures}`);
  process.exit(failures > 0 ? 1 : 0);
})().catch((e) => {
  console.error('SMOKE-P10 error', e);
  process.exit(1);
});
