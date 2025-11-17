// React + Babel SPA with hash routing and three sections + home
const Section = ({ title, children }) => (
  <section className="card">
    <h2>{title}</h2>
    {children}
  </section>
);

class SimpleErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) {}
  render(){ if (this.state.hasError) { return React.createElement('div', { className: 'card' }, React.createElement('h4', { className: 'section-title' }, 'Something went wrong'), React.createElement('div', { style: { fontSize: 12, color: 'var(--muted)', marginBottom: 8 } }, String(this.state.error?.message || 'Unknown error')), React.createElement('button', { type: 'button', className: 'btn', onClick: () => this.setState({ hasError: false, error: null }) }, 'Retry')); } return this.props.children; }
}

const Toast = ({ message, ok }) => {
  const cls = ok ? 'toast ok' : 'toast bad';
  return <span className={cls}>{message}</span>;
};

// Pick the first non-empty field from a list of possible keys
// Robust matching: tries exact keys, then normalized keys (lowercased, whitespace/punctuation removed, Unicode-safe),
// and finally fuzzy includes to catch variants like "Mobile No." or "Phone #".
function pickField(obj, keys) {
  if (!obj) return null;

  // 1) Exact key matches (case-sensitive as provided)
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null) {
      const s = String(v).trim();
      if (s) return s;
    }
  }

  // Build normalized map of object keys
  const normalizeKey = (s) => {
    try {
      const t = String(s || '').toLowerCase().trim().normalize('NFKD');
      // Keep letters and digits across languages; drop spaces/punctuations
      return t.replace(/[^\p{L}\p{N}]+/gu, '');
    } catch {
      // Fallback if Unicode regex unsupported
      return String(s || '').toLowerCase().trim().replace(/[\s_\-./()#]+/g, '');
    }
  };
  const normEntries = Object.keys(obj).map(k => [normalizeKey(k), k]);
  const normMap = new Map(normEntries);

  // 2) Normalized key equality
  for (const k of keys) {
    const nk = normalizeKey(k);
    const orig = normMap.get(nk);
    if (orig !== undefined) {
      const v = obj[orig];
      if (v !== undefined && v !== null) {
        const s = String(v).trim();
        if (s) return s;
      }
    }
  }

  // 3) Fuzzy includes: variant contained in object key or vice versa
  for (const k of keys) {
    const nk = normalizeKey(k);
    for (const [normK, orig] of normMap.entries()) {
      if (!nk || !normK) continue;
      if (normK.includes(nk) || nk.includes(normK)) {
        const v = obj[orig];
        if (v !== undefined && v !== null) {
          const s = String(v).trim();
          if (s) return s;
        }
      }
    }
  }

  return null;
}

let firebaseReady = false;
const firebaseService = {
  init() {
    try {
      if (typeof firebase !== 'undefined' && !firebaseReady) {
        const cfg = (() => {
          try { return JSON.parse(localStorage.getItem('firebase_config')); } catch { return null; }
        })() || (typeof window !== 'undefined' ? window.__FIREBASE_CONFIG__ : null);
        if (cfg && cfg.apiKey) {
          firebase.initializeApp(cfg);
          firebaseReady = true;
          if (typeof window !== 'undefined') window.firebaseReady = true;
        }
      }
    } catch {}
  },
  read(key) {
    try {
      if (firebaseReady) {
        return firebase.database().ref(key).once('value').then(s => s.val()).catch(() => null);
      }
      return null;
    } catch { return null; }
  },
  write(key, value) {
    try { if (firebaseReady) { return firebase.database().ref(key).set(value).catch(() => {}); } } catch {}
  },
  applyingRemote: false,
  subscribe(key, onData) {
    try {
      if (!firebaseReady) return () => {};
      const ref = firebase.database().ref(key);
      const handler = snap => { try { const v = snap.val(); onData(v); } catch {} };
      ref.on('value', handler);
      return () => { try { ref.off('value', handler); } catch {} };
    } catch { return () => {} }
  }
};
firebaseService.init();

const store = {
  read(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; } },
  write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
    if (!firebaseService.applyingRemote) firebaseService.write(key, value);
  },
  writeFirebaseConfig(cfg) { try { localStorage.setItem('firebase_config', JSON.stringify(cfg)); } catch {} firebaseService.init(); }
};

function ensureSeeds() {
  if (!store.read('shifts')) {
    store.write('shifts', [
      { id: 1, code: 'MORNING', name: 'Morning', start_time: '08:00', end_time: '16:00' },
      { id: 2, code: 'EVENING', name: 'Evening', start_time: '16:00', end_time: '00:00' },
      { id: 3, code: 'NIGHT', name: 'Night', start_time: '00:00', end_time: '08:00' },
    ]);
  }
  if (!store.read('vacations')) store.write('vacations', []);
  if (!store.read('vacation_plans')) store.write('vacation_plans', []);
  if (!store.read('duties')) store.write('duties', []);
  if (!store.read('hospitals')) store.write('hospitals', []);
  if (!store.read('specialties')) store.write('specialties', []);
  if (!store.read('departments')) store.write('departments', []);
}

async function loadDataKey(key) {
  try {
    const fromFirebase = await (firebaseReady ? firebaseService.read(key) : Promise.resolve(null));
    if (fromFirebase && Array.isArray(fromFirebase)) return fromFirebase;
    const api = await fetch(`api/data/${key}`).then(r => r.ok ? r.text() : 'null').catch(() => 'null');
    const fromApi = (() => { try { return JSON.parse(api); } catch { return null; } })();
    if (fromApi && Array.isArray(fromApi)) return fromApi;
    const file = await fetch(`data/${key}.json`).then(r => r.ok ? r.json() : null).catch(() => null);
    if (file && Array.isArray(file)) return file;
    return null;
  } catch { return null; }
}

// Global helpers for cross-section integration
function defaultMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

// Unified on-call detection logic used across pages and reports
const isOnCallDuty = (d) => {
  const code = String(d?.shift_code || '').toUpperCase();
  return code === '24H' || code === 'FULL24' || d?.shift_id == null;
};

// Global filters persisted in localStorage for consistent UX across sections
function useGlobalFilters() {
  const [filters, setFilters] = React.useState(() => {
    const init = store.read('filters', null);
    if (init && typeof init === 'object') return init;
    return { hospitalId: '', department: '', month: defaultMonth() };
  });
  React.useEffect(() => { store.write('filters', filters); }, [filters]);
  return [filters, setFilters];
}

function useToast() {
  const [toast, setToast] = React.useState(null);
  const show = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };
  return [toast, show];
}


function Hospitals({ hospitals, setHospitals, doctors, setDoctors, departments }) {
  const [name, setName] = React.useState('');
  const [toast, showToast] = useToast();
  const [editId, setEditId] = React.useState(null);
  const [editName, setEditName] = React.useState('');
  const startEdit = (h) => { setEditId(h.id); setEditName(h.name); };
  const cancelEdit = () => { setEditId(null); setEditName(''); };
  const saveEdit = () => {
    const nextName = String(editName || '').trim();
    if (!nextName) return showToast('Hospital name required', false);
    if (hospitals.some(h => h.id !== editId && String(h.name).toLowerCase() === nextName.toLowerCase())) {
      return showToast('Hospital name must be unique', false);
    }
    const nextHospitals = hospitals.map(h => h.id === editId ? { ...h, name: nextName } : h);
    setHospitals(nextHospitals);
    store.write('hospitals', nextHospitals);
    // Propagate rename to doctors referencing this hospital_id
    if (doctors && setDoctors) {
      const nextDoctors = doctors.map(d => d.hospital_id === editId ? { ...d, hospital: nextName } : d);
      setDoctors(nextDoctors);
      store.write('doctors', nextDoctors);
    }
    showToast('Hospital updated');
    cancelEdit();
  };
  const add = (e) => { e.preventDefault(); if (!name.trim()) return showToast('Hospital name required', false);
    const nextId = (hospitals.reduce((m, h) => Math.max(m, h.id), 0) || 0) + 1;
    const h = { id: nextId, name: name.trim() };
    const next = [...hospitals, h]; setHospitals(next); store.write('hospitals', next);
    showToast('Hospital added'); setName(''); };
  return (<>
    <form onSubmit={add}>
      <div className="row"><label>Hospital Name</label><input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g., City General Hospital" /></div>
      <button type="submit"><i className="bi bi-plus-circle"></i>Add Hospital</button>
    </form>
    <div className="list">
      <h3>Hospitals</h3>
      <div className="card-grid">
        {hospitals.map(h => (
          <HospitalCard key={h.id}
            hospital={h}
            editId={editId}
            editName={editName}
            onEditStart={() => startEdit(h)}
            onEditName={setEditName}
            onEditSave={saveEdit}
            onEditCancel={cancelEdit}
            hospitals={hospitals}
            setHospitals={setHospitals}
            doctors={doctors}
            setDoctors={setDoctors}
          />
        ))}
      </div>
    </div>
    <footer>{toast && <Toast message={toast.msg} ok={toast.ok} />}</footer>
  </>);
}

function Specialties({ specialties, setSpecialties, doctors, setDoctors }) {
  const [name, setName] = React.useState('');
  const [toast, showToast] = useToast();
  const [editId, setEditId] = React.useState(null);
  const [editName, setEditName] = React.useState('');
  const [openId, setOpenId] = React.useState(null);
  const doctorSpecialties = React.useMemo(() => {
    const names = new Set();
    (doctors || []).forEach(d => { if (d.specialty && String(d.specialty).trim()) names.add(String(d.specialty).trim()); });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [doctors]);
  const existsInSpecialties = (n) => specialties.some(s => String(s.name).toLowerCase() === String(n).toLowerCase());
  const addMissingFromDoctors = () => {
    const missing = doctorSpecialties.filter(n => !existsInSpecialties(n));
    if (missing.length === 0) return showToast('No new specialties from doctors', true);
    let nextId = (specialties.reduce((m, s) => Math.max(m, s.id), 0) || 0) + 1;
    const additions = missing.map(n => ({ id: nextId++, name: n }));
    const next = [...specialties, ...additions]; setSpecialties(next); store.write('specialties', next);
    showToast(`Added ${additions.length} specialties from doctors`);
  };
  const startEdit = (s) => { setEditId(s.id); setEditName(s.name); };
  const cancelEdit = () => { setEditId(null); setEditName(''); };
  const saveEdit = () => {
    const nextName = String(editName || '').trim();
    if (!nextName) return showToast('Specialty name required', false);
    if (specialties.some(s => s.id !== editId && String(s.name).toLowerCase() === nextName.toLowerCase())) {
      return showToast('Specialty name must be unique', false);
    }
    const nextSpecialties = specialties.map(s => s.id === editId ? { ...s, name: nextName } : s);
    setSpecialties(nextSpecialties);
    store.write('specialties', nextSpecialties);
    if (doctors && setDoctors) {
      const nextDoctors = doctors.map(d => d.specialty_id === editId ? { ...d, specialty: nextName } : d);
      setDoctors(nextDoctors);
      store.write('doctors', nextDoctors);
    }
    showToast('Specialty updated');
    cancelEdit();
  };
  const removeSpecialty = (sid) => {
    if (!window.confirm('Remove this specialty?')) return;
    const nextSpecialties = specialties.filter(s => s.id !== sid);
    setSpecialties(nextSpecialties);
    store.write('specialties', nextSpecialties);
    if (doctors && setDoctors) {
      const nextDoctors = doctors.map(d => d.specialty_id === sid ? { ...d, specialty_id: null, specialty: null } : d);
      setDoctors(nextDoctors);
      store.write('doctors', nextDoctors);
    }
    showToast('Specialty removed');
  };
  const add = (e) => { e.preventDefault(); if (!name.trim()) return showToast('Specialty name required', false);
    if (existsInSpecialties(name.trim())) return showToast('Specialty already exists', false);
    const nextId = (specialties.reduce((m, s) => Math.max(m, s.id), 0) || 0) + 1;
    const s = { id: nextId, name: name.trim() };
    const next = [...specialties, s]; setSpecialties(next); store.write('specialties', next);
    showToast('Specialty added'); setName(''); };
  return (<>
    <form onSubmit={add}>
      <div className="row"><label>Specialty Name</label><input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g., Cardiology" /></div>
      <button type="submit"><i className="bi bi-plus-circle"></i>Add Specialty</button>
      <button type="button" style={{ marginLeft: 8 }} onClick={addMissingFromDoctors}><i className="bi bi-list-check"></i>Add All Missing Specialties</button>
    </form>
    <div className="list">
      <h3>Specialties</h3>
      <div className="card-grid">
        {specialties.map(s => (
          <div key={s.id} className="hospital-card">
            {editId === s.id ? (
              <>
                <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Specialty name" style={{ flex: 1, marginRight: 8 }} />
                <button type="button" onClick={saveEdit}><i className="bi bi-save"></i>Save</button>
                <button type="button" className="btn btn-deny" onClick={cancelEdit}><i className="bi bi-x-circle"></i>Cancel</button>
              </>
            ) : (
              <>
                <div className="name">{s.name}</div>
                <button className="kebab-btn" type="button" onClick={() => setOpenId(prev => prev === s.id ? null : s.id)} aria-label="Options" aria-expanded={openId === s.id}>⋮</button>
                {openId === s.id && (
                  <div className="kebab-menu">
                    <button className="kebab-item" type="button" onClick={() => { startEdit(s); setOpenId(null); }}><i className="bi bi-pencil"></i>Edit</button>
                    <button className="kebab-item" type="button" onClick={() => removeSpecialty(s.id)}>Remove</button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
    <footer>{toast && <Toast message={toast.msg} ok={toast.ok} />}</footer>
  </>);
}

function Departments({ departments, setDepartments, doctors, hospitals }) {
  const [name, setName] = React.useState('');
  const [headQuery, setHeadQuery] = React.useState('');
  const [headId, setHeadId] = React.useState(null);
  const [hospitalId, setHospitalId] = React.useState('');
  const [showMatches, setShowMatches] = React.useState(false);
  const [toast, showToast] = useToast();
  const [editId, setEditId] = React.useState(null);
  const [editName, setEditName] = React.useState('');
  const [editHeadQuery, setEditHeadQuery] = React.useState('');
  const [editHeadId, setEditHeadId] = React.useState(null);
  const [editHospitalId, setEditHospitalId] = React.useState(null);
  const [showEditMatches, setShowEditMatches] = React.useState(false);
  const [openId, setOpenId] = React.useState(null);
  const existsInDepartments = (n) => departments.some(d => String(d.name).toLowerCase() === String(n).toLowerCase());
  const getDoctorName = (id) => (doctors.find(doc => Number(doc.id) === Number(id)) || {}).name || '';
  const getHospitalName = (id) => (hospitals.find(h => Number(h.id) === Number(id)) || {}).name || '';
  const startEdit = (d) => {
    setEditId(d.id);
    setEditName(d.name);
    const preId = d.head_id ?? null;
    setEditHeadId(preId);
    setEditHeadQuery(preId ? getDoctorName(preId) : (d.head || ''));
    setEditHospitalId(d.hospital_id ?? null);
  };
  const cancelEdit = () => { setEditId(null); setEditName(''); setEditHeadQuery(''); setEditHeadId(null); setEditHospitalId(null); };
  const saveEdit = () => {
    const nextName = String(editName || '').trim();
    let nextHeadDoctor = doctors.find(doc => Number(doc.id) === Number(editHeadId));
    if (!nextName) return showToast('Department name required', false);
    if (!nextHeadDoctor) {
      const hid = Number(editHospitalId) || null;
      const hname = hospitals.find(h => h.id === hid)?.name || null;
      nextHeadDoctor = doctors.find(d => (
        (Number(d.hospital_id) === hid || (!!hname && !!d.hospital && d.hospital === hname))
        && String(d.name).trim() === String(editHeadQuery).trim()
      ));
      if (!nextHeadDoctor) return showToast('Select head from doctor list', false);
    }
    if (!editHospitalId) return showToast('Select hospital', false);
    {
      const hid = Number(editHospitalId) || null;
      const hname = hospitals.find(h => h.id === hid)?.name || null;
      const matches = (Number(nextHeadDoctor.hospital_id) === hid) || (!!hname && !!nextHeadDoctor.hospital && nextHeadDoctor.hospital === hname);
      if (!matches) return showToast('Head must be from selected hospital', false);
    }
    if (departments.some(d => d.id !== editId && String(d.name).toLowerCase() === nextName.toLowerCase())) {
      return showToast('Department name must be unique', false);
    }
    const nextDepartments = departments.map(d => (
      d.id === editId ? { ...d, name: nextName, head_id: Number(nextHeadDoctor.id), head: nextHeadDoctor.name, hospital_id: Number(editHospitalId) } : d
    ));
    setDepartments(nextDepartments);
    store.write('departments', nextDepartments);
    showToast('Department updated');
    cancelEdit();
  };
  const removeDepartment = (did) => {
    if (!window.confirm('Remove this department?')) return;
    const nextDepartments = departments.filter(d => d.id !== did);
    setDepartments(nextDepartments);
    store.write('departments', nextDepartments);
    showToast('Department removed');
  };
  const add = (e) => {
    e.preventDefault();
    const n = String(name || '').trim();
    let headDoctor = doctors.find(doc => Number(doc.id) === Number(headId));
    if (!n) return showToast('Department name required', false);
    if (!headDoctor) {
      const hid = Number(hospitalId) || null;
      const hname = hospitals.find(h => h.id === hid)?.name || null;
      headDoctor = doctors.find(d => (
        (Number(d.hospital_id) === hid || (!!hname && !!d.hospital && d.hospital === hname))
        && String(d.name).trim() === String(headQuery).trim()
      ));
      if (!headDoctor) return showToast('Select head from doctor list', false);
    }
    if (!hospitalId) return showToast('Select hospital', false);
    {
      const hid = Number(hospitalId) || null;
      const hname = hospitals.find(h => h.id === hid)?.name || null;
      const matches = (Number(headDoctor.hospital_id) === hid) || (!!hname && !!headDoctor.hospital && headDoctor.hospital === hname);
      if (!matches) return showToast('Head must be from selected hospital', false);
    }
    if (existsInDepartments(n)) return showToast('Department already exists', false);
    const nextId = (departments.reduce((m, d) => Math.max(m, d.id), 0) || 0) + 1;
    const dep = { id: nextId, name: n, head_id: Number(headDoctor.id), head: headDoctor.name, hospital_id: Number(hospitalId) };
    const next = [...departments, dep];
    setDepartments(next);
    store.write('departments', next);
    showToast('Department added');
    setName(''); setHeadQuery(''); setHeadId(null); setHospitalId('');
  };
  const stripMarksAndSpaces = (s) => String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // Latin diacritics
    .replace(/[\u064B-\u065F]/g, '') // Arabic diacritics
    .replace(/\s+/g, '');
  const isSubsequence = (text, pattern) => {
    const t = stripMarksAndSpaces(text);
    const p = stripMarksAndSpaces(pattern);
    if (!p) return false;
    let i = 0;
    for (const ch of p) {
      i = t.indexOf(ch, i);
      if (i === -1) return false;
      i += 1;
    }
    return true;
  };
  const docMatchesQuery = (doc, q) => isSubsequence(doc.name, q);
  // Build highlighted name for suggestions using subsequence matching
  const highlightName = (name, query) => {
    const original = String(name || '');
    const q = String(query || '').trim();
    if (!q) return original;
    const normalizeChar = (ch) => ch
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '') // Latin diacritics
      .replace(/[\u064B-\u065F]/g, '') // Arabic diacritics
      .toLowerCase();
    const mapping = []; // index in normalized -> index in original
    let norm = '';
    for (let i = 0; i < original.length; i++) {
      const ch = original[i];
      const n = normalizeChar(ch);
      // Skip whitespace in normalized sequence
      if (!/\s/.test(ch) && n) {
        norm += n;
        mapping.push(i);
      }
    }
    const nq = normalizeChar(q).replace(/\s+/g, '');
    if (!nq) return original;
    const matchedIdx = [];
    let pos = 0;
    for (const qc of nq) {
      const idx = norm.indexOf(qc, pos);
      if (idx === -1) return original;
      matchedIdx.push(mapping[idx]);
      pos = idx + 1;
    }
    const parts = [];
    const set = new Set(matchedIdx);
    let last = 0;
    for (let i = 0; i < original.length; i++) {
      if (set.has(i)) {
        if (last < i) parts.push(original.slice(last, i));
        parts.push(<mark key={`m-${i}`}>{original[i]}</mark>);
        last = i + 1;
      }
    }
    if (last < original.length) parts.push(original.slice(last));
    return parts;
  };
  const matches = React.useMemo(() => {
    const q = String(headQuery || '').trim();
    if (!hospitalId) return [];
    const hid = Number(hospitalId) || null;
    const hname = hospitals.find(h => h.id === hid)?.name || null;
    const base = doctors.filter(d => (
      Number(d.hospital_id) === hid
      || (!!hname && !!d.hospital && d.hospital === hname)
    ));
    return (q ? base.filter(d => docMatchesQuery(d, q)) : base).slice(0, 30);
  }, [headQuery, hospitalId, doctors]);
  const editMatches = React.useMemo(() => {
    const q = String(editHeadQuery || '').trim();
    if (!editHospitalId) return [];
    const hid = Number(editHospitalId) || null;
    const hname = hospitals.find(h => h.id === hid)?.name || null;
    const base = doctors.filter(d => (
      Number(d.hospital_id) === hid
      || (!!hname && !!d.hospital && d.hospital === hname)
    ));
    return (q ? base.filter(d => docMatchesQuery(d, q)) : base).slice(0, 30);
  }, [editHeadQuery, editHospitalId, doctors]);

  React.useEffect(() => {
    if (!hospitalId) return;
    if (headId) {
      const doc = doctors.find(d => Number(d.id) === Number(headId));
      const hid = Number(hospitalId) || null;
      const hname = hospitals.find(h => h.id === hid)?.name || null;
      const matchesHospital = !!doc && (
        Number(doc.hospital_id) === hid || (!!hname && !!doc.hospital && doc.hospital === hname)
      );
      if (!doc || !matchesHospital) {
        setHeadId(null);
        setHeadQuery('');
      }
    }
  }, [hospitalId, headId, doctors, hospitals]);

  React.useEffect(() => {
    if (!editHospitalId) return;
    if (editHeadId) {
      const doc = doctors.find(d => Number(d.id) === Number(editHeadId));
      const hid = Number(editHospitalId) || null;
      const hname = hospitals.find(h => h.id === hid)?.name || null;
      const matchesHospital = !!doc && (
        Number(doc.hospital_id) === hid || (!!hname && !!doc.hospital && doc.hospital === hname)
      );
      if (!doc || !matchesHospital) {
        setEditHeadId(null);
        setEditHeadQuery('');
      }
    }
  }, [editHospitalId, editHeadId, doctors, hospitals]);

  // Show suggestions when hospital changes or field gains focus; hide when selecting
  React.useEffect(() => {
    setShowMatches(!!hospitalId);
  }, [hospitalId]);
  React.useEffect(() => {
    setShowEditMatches(!!editHospitalId);
  }, [editHospitalId]);
  const onHeadInputFocus = () => { if (hospitalId) setShowMatches(true); };
  const onEditHeadInputFocus = () => { if (editHospitalId) setShowEditMatches(true); };
  const onHeadInputChange = (e) => { setHeadQuery(e.target.value); setHeadId(null); if (hospitalId) setShowMatches(true); };
  const onEditHeadInputChange = (e) => { setEditHeadQuery(e.target.value); setEditHeadId(null); if (editHospitalId) setShowEditMatches(true); };
  const onPickHead = (doc) => { setHeadQuery(doc.name); setHeadId(doc.id); setShowMatches(false); };
  const onPickEditHead = (doc) => { setEditHeadQuery(doc.name); setEditHeadId(doc.id); setShowEditMatches(false); };
  
  return (<>
    <form onSubmit={add}>
      <div className="row"><label>Hospital</label>
        <select value={hospitalId} onChange={e => setHospitalId(e.target.value)} required>
          <option value="">Select hospital</option>
          {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>
      <div className="row"><input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g., Emergency" dir="auto" /></div>
      <div className="row"><label>Head of Department</label>
        <input value={headQuery} onChange={onHeadInputChange} onFocus={onHeadInputFocus} required placeholder="Type name" dir="auto" />
      </div>
      {showMatches && matches.length > 0 && (
        <div className="card" style={{ marginTop: 8, maxHeight: 240, overflowY: 'auto' }}>
          {matches.map(doc => (
            <button type="button" key={doc.id} className="kebab-item" onClick={() => onPickHead(doc)} dir="auto">
              <span className="suggest-name">{highlightName(doc.name, headQuery)}</span>
                {(doc.job_number || doc.jobnumber || doc.JobNumber || doc.job_number || doc.Job || doc.job || doc['Job #'] || doc['JOB#'] || doc.JobNo || doc['Job No'] || doc.JobNum || doc['Job Num'])
                  ? <span className="suggest-meta">{` · ${(doc.job_number || doc.jobnumber || doc.JobNumber || doc.job_number || doc.Job || doc.job || doc['Job #'] || doc['JOB#'] || doc.JobNo || doc['Job No'] || doc.JobNum || doc['Job Num'])}`}</span>
                  : null}
              {doc.specialty ? <span className="suggest-meta">{` · ${doc.specialty}`}</span> : null}
              {doc.hospital ? <span className="suggest-meta">{` · ${doc.hospital}`}</span> : null}
            </button>
          ))}
        </div>
      )}
      <button type="submit"><i className="bi bi-plus-circle"></i>Add Department</button>
    </form>
    <div className="list">
      <h3>Departments</h3>
      <div className="card-grid">
        {departments.map(d => (
          <div key={d.id} className="hospital-card">
            {editId === d.id ? (
              <>
                <select value={editHospitalId ?? ''} onChange={e => setEditHospitalId(Number(e.target.value) || null)} style={{ marginRight: 8 }}>
                  <option value="">Select hospital</option>
                  {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
                <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Department name" style={{ flex: 1, marginRight: 8 }} dir="auto" />
                <input value={editHeadQuery} onChange={onEditHeadInputChange} onFocus={onEditHeadInputFocus} placeholder="Type name" style={{ flex: 1, marginRight: 8 }} dir="auto" />
                {showEditMatches && editMatches.length > 0 && (
                  <div className="card" style={{ gridColumn: '1 / -1', marginTop: 8, maxHeight: 240, overflowY: 'auto' }}>
                    {editMatches.map(doc => (
                      <button type="button" key={doc.id} className="kebab-item" onClick={() => onPickEditHead(doc)} dir="auto">
                        <span className="suggest-name">{highlightName(doc.name, editHeadQuery)}</span>
                {(doc.job_number || doc.jobnumber || doc.JobNumber || doc.job_number || doc.Job || doc.job || doc['Job #'] || doc['JOB#'] || doc.JobNo || doc['Job No'] || doc.JobNum || doc['Job Num'])
                  ? <span className="suggest-meta">{` · ${(doc.job_number || doc.jobnumber || doc.JobNumber || doc.job_number || doc.Job || doc.job || doc['Job #'] || doc['JOB#'] || doc.JobNo || doc['Job No'] || doc.JobNum || doc['Job Num'])}`}</span>
                  : null}
                        {doc.specialty ? <span className="suggest-meta">{` · ${doc.specialty}`}</span> : null}
                        {doc.hospital ? <span className="suggest-meta">{` · ${doc.hospital}`}</span> : null}
                      </button>
                    ))}
                  </div>
                )}
                <button type="button" onClick={saveEdit}><i className="bi bi-save"></i>Save</button>
                <button type="button" className="btn btn-deny" onClick={cancelEdit}><i className="bi bi-x-circle"></i>Cancel</button>
              </>
            ) : (
              <>
                <div className="name">{d.name}</div>
                <div className="meta">Hospital: {getHospitalName(d.hospital_id) || '-'}</div>
                <div className="meta">Head: {d.head || getDoctorName(d.head_id) || '-'}</div>
                <button className="btn-view" type="button" onClick={() => { window.location.hash = `#/assign/${d.id}`; }} style={{ marginRight: 8 }}><i className="bi bi-person-plus"></i>Assign Doctors</button>
                <button className="kebab-btn" type="button" onClick={() => setOpenId(prev => prev === d.id ? null : d.id)} aria-label="Options" aria-expanded={openId === d.id}>⋮</button>
                {openId === d.id && (
                  <div className="kebab-menu">
                    <button className="kebab-item" type="button" onClick={() => { startEdit(d); setOpenId(null); }}><i className="bi bi-pencil"></i>Edit</button>
                    <button className="kebab-item" type="button" onClick={() => { window.location.hash = `#/assign/${d.id}`; }}><i className="bi bi-person-plus"></i>Assign Doctors</button>
                    <button className="kebab-item" type="button" onClick={() => removeDepartment(d.id)}><i className="bi bi-trash"></i>Remove</button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
    <footer>{toast && <Toast message={toast.msg} ok={toast.ok} />}</footer>
  </>);
}

function DepartmentAssignPage({ departmentId, departments = [], setDepartments, doctors = [], hospitals = [], setDoctors }) {
  const [toast, showToast] = useToast();
  const dep = departments.find(d => Number(d.id) === Number(departmentId));
  const [query, setQuery] = React.useState('');
  const [specialtyFilter, setSpecialtyFilter] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newHospitalId, setNewHospitalId] = React.useState(dep?.hospital_id || '');
  const [newDepartment, setNewDepartment] = React.useState(dep?.name || '');
  const [newJobNumber, setNewJobNumber] = React.useState('');
  const [newEmail, setNewEmail] = React.useState('');
  const [selected, setSelected] = React.useState(() => (
    Array.isArray(dep?.members) ? dep.members.map(x => Number(x)).filter(x => Number.isFinite(x)) : []
  ));
  if (!dep) {
    return (
      <main className="data-content" style={{ padding: 16 }}>
        <div className="card"><div className="name">Department not found</div></div>
        <button type="button" className="btn-view" onClick={() => { window.location.hash = '#/admin'; }}><i className="bi bi-arrow-left"></i>Back</button>
      </main>
    );
  }
  const hid = Number(dep.hospital_id) || null;
  const hname = hospitals.find(h => h.id === hid)?.name || null;
  const stripMarksAndSpaces = (s) => String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/\s+/g, '');
  const isSubsequence = (text, pattern) => {
    const t = stripMarksAndSpaces(text);
    const p = stripMarksAndSpaces(pattern);
    if (!p) return true;
    let i = 0;
    for (const ch of p) {
      i = t.indexOf(ch, i);
      if (i === -1) return false;
      i += 1;
    }
    return true;
  };
  const base = doctors.filter(d => (
    Number(d.hospital_id) === hid || (!!hname && !!d.hospital && d.hospital === hname)
  ));
  const availableSpecialties = Array.from(new Set(base.map(d => d.specialty).filter(Boolean)))
    .sort((a, b) => stripMarksAndSpaces(a).localeCompare(stripMarksAndSpaces(b)));
  const availableDepartments = Array.from(new Set((() => {
    const targetHospId = newHospitalId ? Number(newHospitalId) : Number(dep.hospital_id);
    const selectedHname = hospitals.find(h => Number(h.id) === targetHospId)?.name || null;
    return departments
      .filter(dp => (
        Number(dp.hospital_id) === targetHospId
        || (!!selectedHname && hospitals.find(h => Number(h.id) === Number(dp.hospital_id))?.name === selectedHname)
      ))
      .map(dp => dp.name)
      .filter(Boolean);
  })())).sort((a, b) => stripMarksAndSpaces(a).localeCompare(stripMarksAndSpaces(b)));
  React.useEffect(() => {
    const targetHospId = newHospitalId ? Number(newHospitalId) : Number(dep.hospital_id);
    const options = departments
      .filter(dp => Number(dp.hospital_id) === targetHospId)
      .map(dp => dp.name)
      .filter(Boolean);
    if (!options.includes(newDepartment)) {
      setNewDepartment('');
    }
  }, [newHospitalId, departments]);
  const candidates = base
    .filter(d => isSubsequence(d.name, query))
    .filter(d => !specialtyFilter || stripMarksAndSpaces(d.specialty) === stripMarksAndSpaces(specialtyFilter))
    .filter(d => !selected.includes(Number(d.id)));
  const getHospitalName = (id) => (hospitals.find(h => Number(h.id) === Number(id)) || {}).name || '';
  const getDoctorName = (id) => (doctors.find(doc => Number(doc.id) === Number(id)) || {}).name || '';
  const todayISO = new Date().toISOString().slice(0, 10);
  const addDoctorQuick = (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) { showToast('Doctor name is required', false); return; }
    if (!newDepartment) { showToast('Select department', false); return; }
    const maxId = (doctors.reduce((m, d) => Math.max(m, Number(d.id) || 0), 0) || 0);
    const targetHospId = newHospitalId ? Number(newHospitalId) : Number(dep.hospital_id);
    const hospObj = hospitals.find(h => Number(h.id) === targetHospId);
    const doc = {
      id: maxId + 1,
      name,
      specialty: newDepartment ? newDepartment.trim() : null,
      grade: null,
      phone: null,
      job_number: newJobNumber ? newJobNumber.trim() : null,
      email: newEmail ? newEmail.trim() : null,
      hospital_id: hospObj ? hospObj.id : (Number(dep.hospital_id) || null),
      hospital: hospObj ? hospObj.name : (dep.hospital || null),
      active: 1,
    };
    const next = [...doctors, doc];
    setDoctors(next);
    store.write('doctors', next);
    setSelected(prev => [...prev, doc.id]);
    showToast('Doctor added');
    setAdding(false);
    setNewName(''); setNewHospitalId(dep?.hospital_id || ''); setNewDepartment(dep?.name || ''); setNewJobNumber(''); setNewEmail('');
  };
  const toggleDoctor = (id) => {
    const nid = Number(id);
    setSelected(prev => {
      const norm = prev.map(x => Number(x)).filter(x => Number.isFinite(x));
      return norm.includes(nid) ? norm.filter(x => x !== nid) : [...norm, nid];
    });
  };
  const save = () => {
    const unique = Array.from(new Set(selected.map(x => Number(x)).filter(x => Number.isFinite(x))));
    const next = departments.map(d => (
      d.id === dep.id ? { ...d, members: unique } : d
    ));
    setDepartments(next);
    store.write('departments', next);
    showToast('Assignments saved');
  };
  // Drag-and-drop helpers scoped to DepartmentAssignPage
  const getDoctorById = (id) => doctors.find(d => Number(d.id) === Number(id)) || null;
  const assignDoctor = (id) => {
    const nid = Number(id);
    if (!Number.isFinite(nid)) return;
    setSelected(prev => {
      const norm = prev.map(x => Number(x)).filter(Number.isFinite);
      return norm.includes(nid) ? norm : [...norm, nid];
    });
  };
  const handleDropAssigned = (e) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');
    if (data) assignDoctor(Number(data));
  };
  const allowDrop = (e) => { e.preventDefault(); };
  const unassignDoctor = (id) => {
    const nid = Number(id);
    setSelected(prev => prev.filter(x => Number(x) !== nid));
  };
  // Reverted to table view; no KPI or div list
  return (
    <main className="data-content" style={{ padding: 16 }}>
        <div className="card">
          <div className="name">Assign Doctors to: {dep.name}</div>
          <div className="meta">Hospital: {getHospitalName(dep.hospital_id) || dep.hospital || '-'}</div>
          <div className="row" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn" title="Add doctor" aria-label="Add doctor" onClick={() => setAdding(a => !a)} style={{ padding: '2px 8px' }}><i className="bi bi-plus-lg"></i></button>
          </div>
          {adding && (
            <form onSubmit={addDoctorQuick} className="inline" style={{ marginTop: 8 }}>
              <div className="row"><label>Name</label><input value={newName} onChange={e => setNewName(e.target.value)} required /></div>
              <div className="row"><label>Hospital</label>
                <select value={newHospitalId} onChange={e => setNewHospitalId(e.target.value)} required>
                  <option value="">Select hospital</option>
                  {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
              <div className="row"><label>Department</label>
                <select value={newDepartment} onChange={e => setNewDepartment(e.target.value)} required>
                  <option value="">Select department</option>
                  {availableDepartments.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {availableDepartments.length === 0 && (
                  <div className="meta" style={{ marginTop: 6, color: 'var(--muted)' }}>No departments for selected hospital</div>
                )}
              </div>
              <div className="row"><label>Job Number</label><input value={newJobNumber} onChange={e => setNewJobNumber(e.target.value)} /></div>
              <div className="row"><label>Email</label><input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} /></div>
              <div>
                <button type="submit" className="btn-view"><i className="bi bi-plus-lg"></i>Add</button>
                <button type="button" className="btn" style={{ marginLeft: 8 }} onClick={() => setAdding(false)}><i className="bi bi-x-circle"></i>Cancel</button>
              </div>
            </form>
          )}
          <div className="assign-layout" style={{ marginTop: 8 }}>
            <section className="assign-left">
              <div className="row" style={{ marginTop: 0 }}>
                <label>Specialty</label>
                <select value={specialtyFilter} onChange={e => setSpecialtyFilter(e.target.value)}>
                  <option value="">All specialties</option>
                  {availableSpecialties.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <label>Search</label>
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Type name" dir="auto" />
              </div>
              <div className="card-grid" style={{ marginTop: 8 }}>
                {candidates.map(doc => {
                  const isSel = selected.includes(Number(doc.id));
                  return (
                    <button type="button" key={doc.id} className="doctor-card" onClick={() => toggleDoctor(doc.id)} aria-pressed={isSel} dir="auto" draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(doc.id)); }}>
                      <div>
                        <div className="name">{doc.name}</div>
                        <div className="meta">
                          {(doc.specialty || 'Unspecified')}
              {(doc.job_number || doc.jobnumber || doc.JobNumber || doc.job_number || doc.Job || doc.job || doc['Job #'] || doc['JOB#'] || doc.JobNo || doc['Job No'] || doc.JobNum || doc['Job Num'])
                ? ` · ${(doc.job_number || doc.jobnumber || doc.JobNumber || doc.job_number || doc.Job || doc.job || doc['Job #'] || doc['JOB#'] || doc.JobNo || doc['Job No'] || doc.JobNum || doc['Job Num'])}`
                : ''}
                        </div>
                        <div className="meta">{doc.hospital || getHospitalName(doc.hospital_id) || ''}</div>
                      </div>
                      <div style={{ fontSize: 12 }}>{isSel ? '☑' : '☐'}</div>
                    </button>
                  );
                })}
                {candidates.length === 0 && (
                  <div className="card" style={{ gridColumn: '1 / -1', color: 'var(--muted)' }}>No matching doctors</div>
                )}
              </div>
            </section>
            <section className="assign-middle">
              <div className="list" style={{ marginTop: 0 }}>
                <h3 style={{ marginTop: 6, marginBottom: 6 }}>Assigned Doctors</h3>
                <table className="table">
                  <thead>
                    <tr><th>Name</th><th>Specialty</th><th>Remove</th></tr>
                  </thead>
                  <tbody>
                    {selected.length > 0 ? selected.map(id => {
                      const doc = getDoctorById(id);
                      return (
                        <tr key={`sel-${id}`}>
                          <td>{(doc && pickField(doc, ['name','Name','Doctor','DOCTOR','Doctor Name','اسم','اسم الطبيب','Arabic Name','name_ar'])) || getDoctorName(id) || '-'}</td>
                          <td>{pickField(doc, ['specialty','Specialty','speciality','Speciality','Department','قسم']) || '-'}</td>
                          <td>
                            <button type="button" className="btn" title="Unassign" onClick={() => unassignDoctor(id)} style={{ padding: '4px 8px', fontSize: 12 }}><i className="bi bi-x-lg"></i></button>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr><td colSpan={3} style={{ color: 'var(--muted)' }}>None assigned yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
          <div style={{ marginTop: 12 }}>
            <button type="button" className="btn-view" onClick={save}><i className="bi bi-save"></i>Save</button>
            <button type="button" className="btn" style={{ marginLeft: 8 }} onClick={() => { window.location.hash = '#/admin'; }}><i className="bi bi-arrow-left"></i>Back</button>
          </div>
        </div>
        <footer>{toast && <Toast message={toast.msg} ok={toast.ok} />}</footer>
    </main>
  );
}

function Doctors({ doctors, setDoctors, specialties, setSpecialties, hospitals, setHospitals, departments, setDepartments }) {
  const [name, setName] = React.useState('');
  const [specialtyId, setSpecialtyId] = React.useState('');
  const [grade, setGrade] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [jobNumber, setJobNumber] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [hospitalId, setHospitalId] = React.useState('');
  // Live search/filter states for Existing Doctors list
  const [listQuery, setListQuery] = React.useState('');
  const [filterHospitalId, setFilterHospitalId] = React.useState('');
  const [filterDepartmentName, setFilterDepartmentName] = React.useState('');
  const [toast, showToast] = useToast();
  const fileInputRef = React.useRef(null);

  const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const mapRowToDoctor = (row, nextIdStart = 1) => {
    const idRaw = pickField(row, ['id','ID','Id','Doctor ID','DoctorId','DoctorID','DocID','Doctor Code','Code','Staff ID','Employee ID','EmpID','StaffNumber','Staff No','StaffNo']) || null;
    const nameRaw = pickField(row, ['name','Name','Full Name','Doctor','DOCTOR','Doctor Name','Doctor Full Name','اسم','الاسم','اسم الطبيب','اسم الدكتور','Arabic Name','name_ar']) || '';
    const specRaw = pickField(row, ['specialty','Specialty','speciality','Speciality','Department','Dept','Division','Unit','Clinic','قسم','القسم']) || null;
    const specIdRaw = pickField(row, ['specialty_id','specialtyid','SpecialtyId','Specialty ID','specialityid']) || null;
    const gradeRaw = pickField(row, ['grade','Grade','Rank','Title','Designation','Position','Level','Category','المسمى','المسمى الوظيفي','الدرجة','الرتبة','المستوى','الدرجة الوظيفية']) || null;
    const phoneRaw = pickField(row, ['phone','Phone','Mobile','Phone Number','Phone No','Tel','Tel No','Telephone','Telephone No','WhatsApp','Whatsapp','موبايل','الهاتف','هاتف','جوال','محمول','واتساب','رقم الهاتف','رقم الجوال','رقم التليفون','رقم الموبايل']) || null;
    const jobRaw = pickField(row, ['job_number','jobnumber','JobNumber','Job Number','JobNo','Job No','JobNum','Job Num','JOB#','Job #','Job','job','Employee Number','EmployeeNo','Emp No','EmpNo','EmployeeID','EmpID','Staff Number','StaffNo']) || null;
    const emailRaw = pickField(row, ['email','Email','E-mail','Mail','Email Address','E-mail Address','البريد','البريد الإلكتروني','البريد الالكتروني','الإيميل']) || null;
    const hospNameRaw = pickField(row, ['hospital','Hospital','Hospital Name','Facility','Center','Site','المستشفى','المرفق','المنشأة','المؤسسة','المركز']) || null;
    const hospIdRaw = pickField(row, ['hospital_id','hospitalid','HospitalId','Hospital ID','HospID','FacilityID','CenterID','SiteID','InstitutionID']) || null;
    const deptRaw = pickField(row, ['department','Department','Department Name','Dept','قسم','القسم']) || null;
    const activeRaw = pickField(row, ['active','Active','status','Status']) || null;

    const activeVal = (() => {
      const s = String(activeRaw || '').trim().toLowerCase();
      if (!s) return 1;
      if (['0','false','inactive','no','n'].includes(s)) return 0;
      return 1;
    })();

    return {
      id: Number(idRaw) || nextIdStart,
      name: String(nameRaw || '').trim(),
      specialty: specRaw ? String(specRaw).trim() : null,
      specialty_id: specIdRaw ? Number(specIdRaw) : null,
      grade: gradeRaw ? String(gradeRaw).trim() : null,
      phone: phoneRaw ? String(phoneRaw).trim() : null,
      job_number: jobRaw ? String(jobRaw).trim() : null,
      email: emailRaw ? String(emailRaw).trim() : null,
      hospital: hospNameRaw ? String(hospNameRaw).trim() : null,
      hospital_id: hospIdRaw ? Number(hospIdRaw) : null,
      department: deptRaw ? String(deptRaw).trim() : null,
      active: activeVal,
    };
  };

  const importDoctorsFromFile = async (file) => {
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target.result;
        let rows = [];
        try {
          const wb = XLSX.read(data, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        } catch (err) {
          console.error('Parse error', err);
          showToast('Failed to parse file', false);
          return;
        }
        const maxId = (doctors.reduce((m, d) => Math.max(m, d.id || 0), 0) || 0);
        let imported = rows.map((row, idx) => mapRowToDoctor(row, maxId + idx + 1)).filter(d => d.name);

        // Sync hospitals by name/id
        let nextHospitals = hospitals.slice();
        const existingHospitalNames = new Set(nextHospitals.map(h => String(h.name).trim().toLowerCase()));
        let hMaxId = (nextHospitals.reduce((m, h) => Math.max(m, h.id || 0), 0) || 0);
        imported = imported.map(d => {
          let hid = Number(d.hospital_id) || null;
          let hname = d.hospital ? String(d.hospital).trim() : null;
          if (hid && !nextHospitals.some(h => Number(h.id) === hid)) {
            const addName = hname || `Hospital #${hid}`;
            nextHospitals = [...nextHospitals, { id: hid, name: addName }];
            existingHospitalNames.add(String(addName).trim().toLowerCase());
          }
          if (!hid && hname) {
            const match = nextHospitals.find(h => String(h.name).trim().toLowerCase() === String(hname).trim().toLowerCase());
            if (match) {
              hid = Number(match.id);
            } else {
              hid = ++hMaxId;
              nextHospitals = [...nextHospitals, { id: hid, name: hname }];
              existingHospitalNames.add(String(hname).trim().toLowerCase());
            }
          }
          return { ...d, hospital_id: hid };
        });

        // Sync specialties by name/id
        let nextSpecialties = specialties.slice();
        let sMaxId = (nextSpecialties.reduce((m, s) => Math.max(m, s.id || 0), 0) || 0);
        imported = imported.map(d => {
          let sid = Number(d.specialty_id) || null;
          const sname = d.specialty ? String(d.specialty).trim() : null;
          if (sid && !nextSpecialties.some(s => Number(s.id) === sid) && sname) {
            nextSpecialties = [...nextSpecialties, { id: sid, name: sname }];
          }
          if (!sid && sname) {
            const match = nextSpecialties.find(s => String(s.name).trim().toLowerCase() === String(sname).trim().toLowerCase());
            if (match) sid = Number(match.id); else { sid = ++sMaxId; nextSpecialties = [...nextSpecialties, { id: sid, name: sname }]; }
          }
          return { ...d, specialty_id: sid };
        });

        // Sync department membership if department name present
        let nextDepartments = departments.slice();
        const depByKey = (name, hid) => nextDepartments.find(dd => String(dd.name).trim().toLowerCase() === String(name).trim().toLowerCase() && Number(dd.hospital_id) === Number(hid));
        imported.forEach(d => {
          if (d.department && d.hospital_id) {
            const dep = depByKey(d.department, d.hospital_id);
            if (dep) {
              const members = Array.isArray(dep.members) ? dep.members.slice() : [];
              const idNum = Number(d.id);
              if (!members.map(Number).includes(idNum)) {
                const updated = { ...dep, members: [...members, idNum] };
                nextDepartments = nextDepartments.map(x => x.id === dep.id ? updated : x);
              }
            }
          }
        });

        setHospitals(nextHospitals);
        store.write('hospitals', nextHospitals);
        setSpecialties(nextSpecialties);
        store.write('specialties', nextSpecialties);
        setDepartments(nextDepartments);
        store.write('departments', nextDepartments);

        setDoctors(imported);
        store.write('doctors', imported);
        showToast(`Imported ${imported.length} doctors; synced ${nextHospitals.length - hospitals.length} hospitals, ${nextSpecialties.length - specialties.length} specialties`);
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
      showToast('Import failed', false);
    }
  };

  const clearAllDoctors = () => {
    if (!window.confirm('Are you sure you want to remove all doctors?')) return;
    setDoctors([]);
    store.write('doctors', []);
    showToast('All doctors removed');
  };
  const add = (e) => {
    e.preventDefault();
    if (!name.trim() || !specialtyId || !grade.trim() || !phone.trim() || !jobNumber.trim() || !email.trim() || !hospitalId) {
      return showToast('All fields are required', false);
    }
    const nextId = (doctors.reduce((m, d) => Math.max(m, d.id), 0) || 0) + 1;
    const specialtyObj = specialties.find(s => s.id === Number(specialtyId));
    const hospitalObj = hospitals.find(h => h.id === Number(hospitalId));
    const doc = {
      id: nextId,
      name: name.trim(),
      specialty_id: specialtyObj ? specialtyObj.id : null,
      specialty: specialtyObj ? specialtyObj.name : null,
      grade: grade.trim(),
      phone: phone.trim(),
      job_number: jobNumber.trim(),
      email: email.trim(),
      hospital_id: hospitalObj ? hospitalObj.id : null,
      hospital: hospitalObj ? hospitalObj.name : null,
      active: 1,
    };
    const next = [...doctors, doc];
    setDoctors(next);
    store.write('doctors', next);
    showToast('Doctor added');
    setName(''); setSpecialtyId(''); setGrade(''); setPhone(''); setJobNumber(''); setEmail(''); setHospitalId('');
  };
  // Helpers and computed list for live filtering by name and hospital
  const stripMarksAndSpaces = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').toLowerCase();
  const isSubsequence = (needle, hay) => {
    const n = stripMarksAndSpaces(needle);
    const h = stripMarksAndSpaces(hay);
    if (!n) return true;
    let i = 0;
    for (const c of n) {
      i = h.indexOf(c, i);
      if (i === -1) return false;
      i++;
    }
    return true;
  };
  const filteredDoctors = React.useMemo(() => {
    const selectedHospitalId = Number(filterHospitalId) || null;
    const selectedHospitalName = hospitals.find(h => h.id === selectedHospitalId)?.name || null;
    const selectedDepartment = filterDepartmentName && selectedHospitalId
      ? departments.find(d => Number(d.hospital_id) === selectedHospitalId && String(d.name).trim() === String(filterDepartmentName).trim())
      : null;
    const memberIds = selectedDepartment && Array.isArray(selectedDepartment.members)
      ? selectedDepartment.members.map(Number).filter(Number.isFinite)
      : null;
    return doctors.filter(d => {
      const matchesHospital = !selectedHospitalId
        || d.hospital_id === selectedHospitalId
        || (!!selectedHospitalName && !!d.hospital && d.hospital === selectedHospitalName);
      const matchesDepartment = !filterDepartmentName
        || (!!memberIds && memberIds.includes(Number(d.id)))
        || (String(d.department || '').trim() === String(filterDepartmentName).trim());
      const matchesName = isSubsequence(listQuery, d.name || '');
      return matchesHospital && matchesDepartment && matchesName;
    });
  }, [doctors, listQuery, filterHospitalId, filterDepartmentName, hospitals, departments]);
  return (<>
    <div className="row">
      <label>Import Doctors (CSV or Excel)</label>
      <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={e => importDoctorsFromFile(e.target.files[0])} />
      <button type="button" onClick={() => { if (fileInputRef.current && fileInputRef.current.files[0]) importDoctorsFromFile(fileInputRef.current.files[0]); }}><i className="bi bi-file-earmark-arrow-up"></i>Import</button>
      <button type="button" className="btn btn-deny" onClick={clearAllDoctors}><i className="bi bi-person-x"></i>Clear All Doctors</button>
    </div>
    <form onSubmit={add}>
      <div className="row"><label>Name</label><input value={name} onChange={e => setName(e.target.value)} required /></div>
      <div className="row"><label>Specialty</label><select value={specialtyId} onChange={e => setSpecialtyId(e.target.value)} required><option value="">Select specialty</option>{specialties.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
      <div className="row"><label>Grade</label><input value={grade} onChange={e => setGrade(e.target.value)} required placeholder="e.g., Consultant" /></div>
      <div className="row"><label>Phone Number</label><input value={phone} onChange={e => setPhone(e.target.value)} required placeholder="e.g., +1 555 0100" /></div>
      <div className="row"><label>Job Number</label><input value={jobNumber} onChange={e => setJobNumber(e.target.value)} required placeholder="e.g., EMP-1234" /></div>
      <div className="row"><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="e.g., alice@hospital.org" /></div>
      <div className="row"><label>Hospital</label><select value={hospitalId} onChange={e => setHospitalId(e.target.value)} required><option value="">Select hospital</option>{hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div>
      <button type="submit"><i className="bi bi-plus-circle"></i>Add Doctor</button>
    </form>
    <div className="list">
      <h3>Existing Doctors</h3>
      <form className="inline" onSubmit={e => e.preventDefault()}>
        <input value={listQuery} onChange={e => setListQuery(e.target.value)} placeholder="Search by doctor name" dir="auto" />
        <select value={filterHospitalId} onChange={e => setFilterHospitalId(e.target.value)}>
          <option value="">Filter by hospital</option>
          {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <select value={filterDepartmentName} onChange={e => setFilterDepartmentName(e.target.value)} disabled={!filterHospitalId}>
          <option value="">Filter by department</option>
          {departments.filter(d => String(d.hospital_id) === String(filterHospitalId)).map(d => (
            <option key={d.id} value={d.name}>{d.name}</option>
          ))}
        </select>
      </form>
      <div className="card-grid">
        {filteredDoctors.map(d => (
          <DoctorCard key={d.id}
            doctor={d}
            doctors={doctors}
            setDoctors={setDoctors}
            specialties={specialties}
            hospitals={hospitals}
          />
        ))}
      </div>
    </div>
    <footer>{toast && <Toast message={toast.msg} ok={toast.ok} />}</footer>
  </>);
}

function Shifts({ shifts, setShifts }) {
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [start, setStart] = React.useState('');
  const [end, setEnd] = React.useState('');
  const [toast, showToast] = useToast();
  const add = (e) => { e.preventDefault(); if (!code || !name || !start || !end) return showToast('All shift fields required', false);
    const nextId = (shifts.reduce((m, s) => Math.max(m, s.id), 0) || 0) + 1;
    const shift = { id: nextId, code, name, start_time: start, end_time: end };
    const next = [...shifts, shift]; setShifts(next); store.write('shifts', next);
    showToast('Shift added'); setCode(''); setName(''); setStart(''); setEnd(''); };
  return (<>
    <form onSubmit={add}>
      <div className="row"><label>Code</label><input placeholder="MORNING" value={code} onChange={e => setCode(e.target.value)} required /></div>
      <div className="row"><label>Name</label><input placeholder="Morning" value={name} onChange={e => setName(e.target.value)} required /></div>
      <div className="row"><label>Start Time</label><input type="time" value={start} onChange={e => setStart(e.target.value)} required /></div>
      <div className="row"><label>End Time</label><input type="time" value={end} onChange={e => setEnd(e.target.value)} required /></div>
      <button type="submit"><i className="bi bi-plus-circle"></i>Add Shift</button>
    </form>
    <div className="list"><h3>Existing Shifts</h3><ul>{shifts.map(s => (<li key={s.id}><strong>{s.code}</strong> · {s.name} · {s.start_time} – {s.end_time}</li>))}</ul></div>
    <footer>{toast && <Toast message={toast.msg} ok={toast.ok} />}</footer>
  </>);
}

function Vacations({ doctors, hospitals, departments, vacations, setVacations }) {
  const [doctorId, setDoctorId] = React.useState('');
  const [start, setStart] = React.useState('');
  const [end, setEnd] = React.useState('');
  const [status, setStatus] = React.useState('requested');
  const [vacationType, setVacationType] = React.useState('annual');
  const [filterHospitalId, setFilterHospitalId] = React.useState('');
  const [filterDepartmentName, setFilterDepartmentName] = React.useState('');
  const [toast, showToast] = useToast();
  const selectedDays = React.useMemo(() => {
    if (!start || !end) return null;
    const s = new Date(start), e = new Date(end);
    const ms = e - s;
    if (!Number.isFinite(ms) || ms < 0) return null;
    return Math.round(ms / (1000 * 60 * 60 * 24)) + 1;
  }, [start, end]);
  const add = (e) => { e.preventDefault(); if (!doctorId || !start || !end) return showToast('Doctor, start, end required', false);
    const nextId = (vacations.reduce((m, v) => Math.max(m, v.id), 0) || 0) + 1;
    const v = { id: nextId, doctor_id: Number(doctorId), start_date: start, end_date: end, status, type: vacationType };
    const next = [...vacations, v]; setVacations(next); store.write('vacations', next);
    showToast('Vacation added'); setDoctorId(''); setStart(''); setEnd(''); setStatus('requested'); setVacationType('annual'); };
  const updateStatus = (id, nextStatus) => { const next = vacations.map(v => v.id === id ? { ...v, status: nextStatus } : v); setVacations(next); store.write('vacations', next); showToast(`Vacation ${nextStatus}`); };
  const visibleDoctors = React.useMemo(() => {
    const selectedHospitalId = Number(filterHospitalId) || null;
    const selectedHospitalName = hospitals?.find(h => h.id === selectedHospitalId)?.name || null;
    const selectedDepartment = filterDepartmentName && selectedHospitalId && Array.isArray(departments)
      ? departments.find(d => Number(d.hospital_id) === selectedHospitalId && String(d.name).trim() === String(filterDepartmentName).trim())
      : null;
    const memberIds = selectedDepartment && Array.isArray(selectedDepartment.members)
      ? selectedDepartment.members.map(Number).filter(Number.isFinite)
      : null;
    return doctors.filter(d => {
      const matchesHospital = !selectedHospitalId
        || d.hospital_id === selectedHospitalId
        || (!!selectedHospitalName && !!d.hospital && d.hospital === selectedHospitalName);
      const matchesDepartment = !filterDepartmentName
        || (!!memberIds && memberIds.includes(Number(d.id)))
        || (String(d.department || '').trim() === String(filterDepartmentName).trim());
      return matchesHospital && matchesDepartment;
    });
  }, [doctors, hospitals, departments, filterHospitalId, filterDepartmentName]);
  return (<>
    <form onSubmit={add}>
      <div className="row"><label>Hospital</label><select value={filterHospitalId} onChange={e => { setFilterHospitalId(e.target.value); setFilterDepartmentName(''); }}><option value="">Select hospital</option>{(hospitals || []).map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div>
      <div className="row"><label>Department</label><select value={filterDepartmentName} onChange={e => setFilterDepartmentName(e.target.value)} disabled={!filterHospitalId}><option value="">Select department</option>{(departments || []).filter(d => String(d.hospital_id) === String(filterHospitalId)).map(d => (<option key={d.id} value={d.name}>{d.name}</option>))}</select></div>
      <div className="row"><label>Doctor</label><select value={doctorId} onChange={e => setDoctorId(e.target.value)} required><option value="" disabled>Select doctor</option>{visibleDoctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
      <div className="row"><label>Start Date</label><input type="date" value={start} onChange={e => setStart(e.target.value)} required /></div>
      <div className="row"><label>End Date</label><input type="date" value={end} onChange={e => setEnd(e.target.value)} required /></div>
      <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 6 }}>
        Selected: {start || '—'} to {end || '—'}{selectedDays ? ` (${selectedDays} day${selectedDays === 1 ? '' : 's'})` : ''}
      </div>
      <div className="row"><label>Type of Vacation</label><select value={vacationType} onChange={e => setVacationType(e.target.value)}>
        <option value="annual">Annual</option>
        <option value="emergency">Emergency</option>
        <option value="sick_leave">Sick Leave</option>
      </select></div>
      <button type="submit"><i className="bi bi-plus-circle"></i>Add Vacation</button>
    </form>
    <div className="list"><h3>Vacation Requests</h3>
      <table><thead><tr><th>Doctor</th><th>Start</th><th>End</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{vacations.filter(v => v.status !== 'planned').map(v => (<tr key={v.id}><td>{(doctors.find(d => d.id === v.doctor_id) || {}).name || v.doctor_id}</td><td>{v.start_date}</td><td>{v.end_date}</td><td><strong>{v.status}</strong></td><td><button className="btn btn-approve" onClick={() => updateStatus(v.id, 'approved')}><i className="bi bi-check-circle"></i>Approve</button> <button className="btn btn-deny" onClick={() => updateStatus(v.id, 'denied')}><i className="bi bi-x-circle"></i>Deny</button></td></tr>))}</tbody>
      </table>
    </div>
    <footer>{toast && <Toast message={toast.msg} ok={toast.ok} />}</footer>
  </>);
}

function generateSchedule({ start, end, doctors, shifts, vacations }) {
  const dateToISO = d => new Date(d).toISOString().slice(0, 10);
  const s = new Date(start), e = new Date(end);
  const activeDocs = doctors.filter(d => d.active !== 0);
  let pointer = 0; const duties = [];
  const isOnLeave = (docId, dateISO) => vacations.some(v => v.doctor_id === docId && v.status === 'approved' && v.start_date <= dateISO && v.end_date >= dateISO);
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const dateISO = dateToISO(d);
    for (const shift of shifts) {
      let assigned = null;
      for (let i = 0; i < activeDocs.length; i++) {
        const idx = (pointer + i) % activeDocs.length; const doc = activeDocs[idx];
        if (!isOnLeave(doc.id, dateISO)) { assigned = doc; pointer = (idx + 1) % activeDocs.length; break; }
      }
      if (assigned) duties.push({ id: `${dateISO}-${shift.id}-${assigned.id}`, date: dateISO, shift_id: shift.id, shift_code: shift.code, doctor_id: assigned.id, doctor_name: assigned.name });
    }
  }
  return duties;
}

function Schedule({ doctors, shifts, vacations, duties, setDuties }) {
  const [genStart, setGenStart] = React.useState('');
  const [genEnd, setGenEnd] = React.useState('');
  const [viewStart, setViewStart] = React.useState('');
  const [viewEnd, setViewEnd] = React.useState('');
  const [toast, showToast] = useToast();
  React.useEffect(() => { const now = new Date(); const s = new Date(now.getFullYear(), now.getMonth(), 1); const e = new Date(now.getFullYear(), now.getMonth() + 1, 0); const fmt = (d) => d.toISOString().slice(0, 10); setViewStart(fmt(s)); setViewEnd(fmt(e)); }, []);
  const submitGenerate = (e) => { e.preventDefault(); if (!genStart || !genEnd) return showToast('Start and End required', false);
    const created = generateSchedule({ start: genStart, end: genEnd, doctors, shifts, vacations }); setDuties(created); store.write('duties', created); showToast('Schedule generated'); setViewStart(genStart); setViewEnd(genEnd); };
  const rows = duties.filter(d => (!viewStart || d.date >= viewStart) && (!viewEnd || d.date <= viewEnd));
  return (<>
    <form onSubmit={submitGenerate}>
      <div className="row"><label>Start</label><input type="date" value={genStart} onChange={e => setGenStart(e.target.value)} required /></div>
      <div className="row"><label>End</label><input type="date" value={genEnd} onChange={e => setGenEnd(e.target.value)} required /></div>
      <button type="submit"><i className="bi bi-lightning"></i>Generate Schedule</button>
    </form>
    <div className="list"><h3>Duties</h3>
      <form className="inline" onSubmit={e => e.preventDefault()}>
        <input type="date" value={viewStart} onChange={e => setViewStart(e.target.value)} />
        <input type="date" value={viewEnd} onChange={e => setViewEnd(e.target.value)} />
      </form>
      <table><thead><tr><th>Date</th><th>Shift</th><th>Doctor</th></tr></thead>
        <tbody>{rows.map(d => (<tr key={d.id}><td>{d.date}</td><td>{d.shift_code}</td><td>{d.doctor_name}</td></tr>))}</tbody>
      </table>
    </div>
    <footer>{toast && <Toast message={toast.msg} ok={toast.ok} />}</footer>
  </>);
}

function DutiesDesigner({ hospitals, departments, doctors, shifts, duties, setDuties, vacations }) {
  const [hospitalId, setHospitalId] = React.useState('');
  const [deptName, setDeptName] = React.useState('');
  const [format, setFormat] = React.useState('8H');
  const [month, setMonth] = React.useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const [selectedDate, setSelectedDate] = React.useState('');
  const [assignments, setAssignments] = React.useState({}); // { dateISO: { slotCode: [doctorId, ...] } }
  const [picker, setPicker] = React.useState({}); // { slotCode: selectedDoctorId }
  const [toast, showToast] = useToast();

  const doctorsForHospital = React.useMemo(() => {
    if (!hospitalId) return doctors;
    const selectedHospitalName = hospitals?.find(h => String(h.id) === String(hospitalId))?.name || null;
    return doctors.filter(d => (
      String(d.hospital_id) === String(hospitalId)
      || (!!selectedHospitalName && !!d.hospital && String(d.hospital).trim() === String(selectedHospitalName).trim())
    ));
  }, [doctors, hospitals, hospitalId]);

  const selectedDept = React.useMemo(() => {
    if (!hospitalId || !deptName) return null;
    const nameTrim = String(deptName || '').trim();
    return departments.find(d => Number(d.hospital_id) === Number(hospitalId) && String(d.name || '').trim() === nameTrim) || null;
  }, [departments, hospitalId, deptName]);

  const doctorsForDepartment = React.useMemo(() => {
    if (!selectedDept) return [];
    const memberIds = Array.isArray(selectedDept.members) ? selectedDept.members.map(x => Number(x)).filter(x => Number.isFinite(x)) : [];
    return doctorsForHospital.filter(d => memberIds.includes(Number(d.id)));
  }, [doctorsForHospital, selectedDept]);

  const monthDays = React.useMemo(() => {
    if (!month) return [];
    const [y, m] = month.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0);
    const days = [];
    for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      days.push({ iso, day: d.getDate(), dow: d.getDay() });
    }
    return days;
  }, [month]);

  const slotsForFormat = React.useMemo(() => {
    const upper = String(format).toUpperCase();
    if (upper === '8H') {
      // Use seeded shifts when available
      const map = {};
      ['MORNING','EVENING','NIGHT'].forEach(code => {
        const s = shifts.find(x => String(x.code).toUpperCase() === code);
        map[code] = { code, id: s ? s.id : null };
      });
      return map;
    }
    if (upper === '12H') {
      return { DAY12: { code: 'DAY12', id: null }, NIGHT12: { code: 'NIGHT12', id: null } };
    }
    // 24H
    return { FULL24: { code: 'FULL24', id: null } };
  }, [format, shifts]);

  const openDay = (iso) => { setSelectedDate(iso); };

  const tooltipForDay = React.useCallback((iso) => {
    const dept = String(deptName || '').trim();
    if (!hospitalId || !dept) return 'Select hospital & department';
    const slotCodes = Object.keys(slotsForFormat).map(c => String(c).toUpperCase());
    const entries = duties.filter(d => d.date === iso
      && Number(d.hospital_id) === Number(hospitalId)
      && String(d.department) === dept
      && slotCodes.includes(String(d.shift_code).toUpperCase()));
    if (!entries.length) return 'No doctors assigned';
    const bySlot = {};
    entries.forEach(d => {
      const code = String(d.shift_code).toUpperCase();
      const name = d.doctor_name || String(d.doctor_id);
      bySlot[code] = (bySlot[code] || []).concat([name]);
    });
    const parts = Object.keys(bySlot).sort().map(code => `${labelForSlot(code)}: ${bySlot[code].join(', ')}`);
    return parts.join(' • ');
  }, [duties, hospitalId, deptName, slotsForFormat]);

  const addAssignment = (slotCode, doctorId) => {
    if (!selectedDate || !doctorId) return;
    const idNum = Number(doctorId);
    const onLeave = Array.isArray(vacations)
      && vacations.some(v => v && v.status === 'approved' && Number(v.doctor_id) === idNum && String(v.start_date) <= String(selectedDate) && String(v.end_date) >= String(selectedDate));
    if (onLeave) { showToast('Doctor on vacation', false); return; }
    setAssignments(prev => {
      const prevDay = prev[selectedDate] || {};
      const prevArr = prevDay[slotCode] || [];
      if (prevArr.includes(idNum)) return prev; // avoid duplicates
      const nextArr = [...prevArr, idNum];
      return { ...prev, [selectedDate]: { ...prevDay, [slotCode]: nextArr } };
    });
    setPicker(prev => ({ ...prev, [slotCode]: '' }));
  };
  const removeAssignment = (slotCode, doctorId) => {
    if (!selectedDate) return;
    const idNum = Number(doctorId);
    setAssignments(prev => {
      const prevDay = prev[selectedDate] || {};
      const prevArr = prevDay[slotCode] || [];
      const nextArr = prevArr.filter(id => id !== idNum);
      return { ...prev, [selectedDate]: { ...prevDay, [slotCode]: nextArr } };
    });
  };

  const saveAssignments = () => {
    if (!selectedDate) return;
    const slotEntries = assignments[selectedDate] || {};
    const slotCodes = Object.keys(slotsForFormat);
    if (!hospitalId) return showToast('Select hospital first', false);
    if (!deptName.trim()) return showToast('Enter department name', false);
    // Build duty entries; remove existing for date for target slot codes
    const filtered = duties.filter(d => d.date !== selectedDate || !slotCodes.includes(String(d.shift_code).toUpperCase()));
    const additions = [];
    slotCodes.forEach(code => {
      const doctorIds = slotEntries[code] || [];
      const slot = slotsForFormat[code];
      const idPart = slot.id != null ? slot.id : code;
      doctorIds.forEach(doctorId => {
        const doc = doctors.find(dd => dd.id === Number(doctorId));
        additions.push({
          id: `${selectedDate}-${idPart}-${doctorId}`,
          date: selectedDate,
          shift_id: slot.id,
          shift_code: code,
          doctor_id: Number(doctorId),
          doctor_name: doc ? doc.name : String(doctorId),
          department: deptName,
          hospital_id: Number(hospitalId)
        });
      });
    });
    const next = [...filtered, ...additions];
    setDuties(next);
    store.write('duties', next);
    showToast(`Saved ${additions.length} duty${additions.length===1?'':'ies'} for ${selectedDate}`, true);
  };

  const labelForSlot = (code) => {
    if (code === 'DAY12') return 'Day (12H)';
    if (code === 'NIGHT12') return 'Night (12H)';
    if (code === 'FULL24') return 'Full (24H)';
    return code.charAt(0) + code.slice(1).toLowerCase();
  };

  // Prefill assignments when opening a day based on saved duties
  React.useEffect(() => {
    if (!selectedDate) return;
    const dept = String(deptName || '').trim();
    if (!hospitalId || !dept) return;
    const codes = Object.keys(slotsForFormat);
    const existing = duties.filter(d => d.date === selectedDate
      && Number(d.hospital_id) === Number(hospitalId)
      && String(d.department) === dept
      && codes.includes(String(d.shift_code).toUpperCase()));
    const pre = {};
    existing.forEach(d => {
      const code = String(d.shift_code).toUpperCase();
      const arr = pre[code] || [];
      const idNum = Number(d.doctor_id);
      if (!arr.includes(idNum)) arr.push(idNum);
      pre[code] = arr;
    });
    setAssignments(prev => ({ ...prev, [selectedDate]: pre }));
  }, [selectedDate, hospitalId, deptName, slotsForFormat, duties]);

  const isDayComplete = React.useCallback((iso) => {
    const dept = String(deptName || '').trim();
    if (!hospitalId || !dept) return false;
    const slotCodes = Object.keys(slotsForFormat);
    return slotCodes.every(code => {
      const match = duties.some(d => d.date === iso
        && String(d.shift_code).toUpperCase() === String(code).toUpperCase()
        && Number(d.hospital_id) === Number(hospitalId)
        && String(d.department) === dept);
      return match;
    });
  }, [duties, hospitalId, deptName, slotsForFormat]);

  const todayIso = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  return (
    <>
      <div className="card scheduler-controls">
        <div className="row"><label>Hospital</label>
          <select value={hospitalId} onChange={e => setHospitalId(e.target.value)}>
            <option value="">Select hospital</option>
            {hospitals.map(h => (<option key={h.id} value={h.id}>{h.name}</option>))}
          </select>
        </div>
        {!!hospitalId && (
          <div className="row" style={{ gridColumn: '1 / -1' }}>
            <label>Departments</label>
            <div className="chips" style={{ marginTop: 6 }}>
              {departments.filter(d => Number(d.hospital_id) === Number(hospitalId)).map(d => (
                <button type="button" key={d.id} className={'chip' + (String(deptName).trim() === String(d.name).trim() ? ' selected' : '')} onClick={() => setDeptName(d.name)}>{d.name}</button>
              ))}
              {departments.filter(d => Number(d.hospital_id) === Number(hospitalId)).length === 0 && (
                <span style={{ color: 'var(--muted)' }}>No departments for selected hospital</span>
              )}
            </div>
          </div>
        )}
        <div className="row"><label>Duty Format</label>
          <select value={format} onChange={e => setFormat(e.target.value)}>
            <option value="8H">8H</option>
            <option value="12H">12H</option>
            <option value="24H">24H</option>
          </select>
        </div>
        <div className="row"><label>Month</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        <div>
          <div className="month-grid">
            {/* Render weekday headers */}
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((w, idx) => (
              <div key={idx} className="weekday">{w}</div>
            ))}
            {/* Add empty cells for first weekday offset */}
            {(() => {
              const [y, m] = month.split('-').map(Number);
              const first = new Date(y, m - 1, 1);
              const offset = first.getDay();
              return Array.from({ length: offset }).map((_, i) => <div key={'empty-'+i}></div>);
            })()}
              {monthDays.map(d => (
                  <div key={d.iso}
                   className={'day-cell' + (selectedDate === d.iso ? ' selected' : '') + ((d.dow === 0 || d.dow === 6) ? ' weekend' : '') + (todayIso === d.iso ? ' today' : '')}
                   onClick={() => openDay(d.iso)}>
                <div className="day-num">{d.day}</div>
                <div
                  className="day-date"
                  tabIndex={0}
                  data-tooltip={tooltipForDay(d.iso)}
                >{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.dow]}</div>
                <span className={'day-dot ' + (isDayComplete(d.iso) ? 'ok' : 'bad')}></span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="assign-panel">
            <h3 style={{ marginTop: 0 }}><i className="bi bi-person-plus"></i>Assign Doctors</h3>
            <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 8 }}>
              {selectedDate ? `Date: ${selectedDate}` : 'Select a day to assign'}<br/>
              {hospitalId ? `Hospital: ${(hospitals.find(h => String(h.id) === String(hospitalId))||{}).name}` : 'Hospital not selected'}<br/>
              {deptName ? `Department: ${deptName}` : 'Department not set'}
            </div>
            {selectedDate && (
              <>
                {Object.keys(slotsForFormat).map(code => {
                  const isFilled = (((assignments[selectedDate]||{})[code]) || []).length > 0;
                  return (
                  <div className={"assign-slot" + (isFilled ? " filled" : "")} key={code}>
                    <div>{labelForSlot(code)}</div>
                    <div className="slot-actions">
                      <select value={picker[code] || ''} onChange={(e) => setPicker(prev => ({ ...prev, [code]: e.target.value }))} disabled={!selectedDept}>
                        <option value="">Choose doctor</option>
                        {doctorsForDepartment.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                      <button type="button" className="btn-view" onClick={() => addAssignment(code, picker[code])} disabled={!selectedDept}><i className="bi bi-plus-lg"></i>Add</button>
                    </div>
                    {!!selectedDept && doctorsForDepartment.length === 0 && (
                      <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>
                        No doctors assigned to this department.
                      </div>
                    )}
                    <div className="chips">
                      {((assignments[selectedDate]||{})[code] || []).map(id => {
                        const doc = doctorsForDepartment.find(d => d.id === id) || doctorsForHospital.find(d => d.id === id);
                        return (
                          <span key={id} className="chip">
                            {doc ? doc.name : id}
                            <button type="button" className="rm" aria-label="Remove" title="Remove" onClick={() => removeAssignment(code, id)}><i className="bi bi-x-lg"></i></button>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ); })}
                <button type="button" className="btn-view save-btn" onClick={saveAssignments}><i className="bi bi-save"></i>Save</button>
              </>
            )}
            {!selectedDate && (
              <p style={{ color: 'var(--muted)' }}>Pick a day from the calendar to assign doctors to duty slots.</p>
            )}
          </div>
        </div>
      </div>
      <footer>{toast && <Toast message={toast.msg} ok={toast.ok} />}</footer>
    </>
  );
}

function AdminPage({ hospitals, setHospitals, specialties, setSpecialties, departments, setDepartments, shifts, setShifts, doctors, setDoctors }) {
  const [active, setActive] = React.useState('hospitals');
  const todayISO = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [toast, showToast] = useToast();
  const fileInputRef = React.useRef(null);
  const exportAllData = () => {
    try {
      const payload = {
        hospitals: store.read('hospitals', []),
        specialties: store.read('specialties', []),
        departments: store.read('departments', []),
        doctors: store.read('doctors', []),
        shifts: store.read('shifts', []),
        vacations: store.read('vacations', []),
        duties: store.read('duties', []),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `hbhc-backup-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Backup exported');
    } catch {
      showToast('Failed to export backup', false);
    }
  };
  const resetAllData = () => {
    if (!window.confirm('Reset all data to initial seeds?')) return;
    store.write('hospitals', []);
    store.write('specialties', []);
    store.write('departments', []);
    store.write('doctors', []);
    store.write('vacations', []);
    store.write('duties', []);
    ensureSeeds();
    setHospitals(store.read('hospitals', []));
    setSpecialties(store.read('specialties', []));
    setDepartments(store.read('departments', []));
    setDoctors(store.read('doctors', []));
    setShifts(store.read('shifts', []));
    showToast('Data reset');
  };

  const importDataFromFile = async (file) => {
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target.result;
        let rows = [];
        try {
          const wb = XLSX.read(data, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        } catch (err) {
          console.error('Parse error', err);
          showToast('Failed to parse file', false);
          return;
        }
        const mapRowToDoctor = (row, id) => {
          const nameRaw = pickField(row, ['name','Name','Full Name','Doctor','DOCTOR','Doctor Name','Doctor Full Name','اسم','الاسم','اسم الطبيب','اسم الدكتور','Arabic Name','name_ar']) || '';
          const jobRaw = pickField(row, ['job_number','jobnumber','JobNumber','Job Number','JobNo','Job No','JobNum','Job Num','JOB#','Job #','Job','job','Employee Number','EmployeeNo','Emp No','EmpNo','EmployeeID','EmpID','Staff Number','StaffNo']) || null;
          const gradeRaw = pickField(row, ['grade','Grade','Rank','Title','Designation','Position','Level','Category','المسمى','المسمى الوظيفي','الدرجة','الرتبة','المستوى','الدرجة الوظيفية']) || null;
          const emailRaw = pickField(row, ['email','Email','E-mail','Mail','Email Address','E-mail Address','البريد','البريد الإلكتروني','البريد الالكتروني','الإيميل']) || null;
          const phoneRaw = pickField(row, ['phone','Phone','Mobile','Phone Number','Phone No','Tel','Tel No','Telephone','Telephone No','WhatsApp','Whatsapp','موبايل','الهاتف','هاتف','جوال','محمول','واتساب','رقم الهاتف','رقم الجوال','رقم التليفون','رقم الموبايل']) || null;
          const hospIdRaw = pickField(row, ['hospital_id','hospitalid','HospitalId','Hospital ID','HospID','FacilityID','CenterID','SiteID','InstitutionID']) || null;
          const hospNameRaw = pickField(row, ['hospital','Hospital','Hospital Name','Facility','Center','Site','المستشفى','المرفق','المنشأة','المؤسسة','المركز']) || null;
          const specIdRaw = pickField(row, ['specialty_id','specialtyid','SpecialtyId','Specialty ID','specialityid']) || null;
          const specRaw = pickField(row, ['specialty','Specialty','speciality','Speciality','Department','Dept','Division','Unit','Clinic','قسم','القسم']) || null;
          const deptRaw = pickField(row, ['department','Department','Department Name','Dept','قسم','القسم']) || null;
          const activeRaw = pickField(row, ['active','Active','status','Status']) || null;

          const activeVal = (() => {
            const s = String(activeRaw || '').trim().toLowerCase();
            if (!s) return 1;
            if (['0','false','inactive','no','n'].includes(s)) return 0;
            return 1;
          })();

          return {
            id,
            name: String(nameRaw || '').trim(),
            job_number: jobRaw ? String(jobRaw).trim() : null,
            grade: gradeRaw ? String(gradeRaw).trim() : null,
            email: emailRaw ? String(emailRaw).trim() : null,
            phone: phoneRaw ? String(phoneRaw).trim() : null,
            hospital_id: hospIdRaw ? Number(hospIdRaw) : null,
            hospital: hospNameRaw ? String(hospNameRaw).trim() : null,
            specialty_id: specIdRaw ? Number(specIdRaw) : null,
            specialty: specRaw ? String(specRaw).trim() : null,
            department: deptRaw ? String(deptRaw).trim() : null,
            active: activeVal,
          };
        };

        const maxId = (doctors.reduce((m, d) => Math.max(m, d.id || 0), 0) || 0);
        let imported = rows.map((row, idx) => mapRowToDoctor(row, maxId + idx + 1)).filter(d => d.name);

        // Sync hospitals
        let nextHospitals = hospitals.slice();
        let hMaxId = (nextHospitals.reduce((m, h) => Math.max(m, h.id || 0), 0) || 0);
        imported = imported.map(d => {
          let hid = Number(d.hospital_id) || null;
          let hname = d.hospital ? String(d.hospital).trim() : null;
          if (hid && !nextHospitals.some(h => Number(h.id) === hid)) {
            const addName = hname || `Hospital #${hid}`;
            nextHospitals = [...nextHospitals, { id: hid, name: addName }];
          }
          if (!hid && hname) {
            const match = nextHospitals.find(h => String(h.name).trim().toLowerCase() === String(hname).trim().toLowerCase());
            if (match) {
              hid = Number(match.id);
            } else {
              hid = ++hMaxId;
              nextHospitals = [...nextHospitals, { id: hid, name: hname }];
            }
          }
          return { ...d, hospital_id: hid };
        });

        // Sync specialties
        let nextSpecialties = specialties.slice();
        let sMaxId = (nextSpecialties.reduce((m, s) => Math.max(m, s.id || 0), 0) || 0);
        imported = imported.map(d => {
          let sid = Number(d.specialty_id) || null;
          const sname = d.specialty ? String(d.specialty).trim() : null;
          if (sid && !nextSpecialties.some(s => Number(s.id) === sid) && sname) {
            nextSpecialties = [...nextSpecialties, { id: sid, name: sname }];
          }
          if (!sid && sname) {
            const match = nextSpecialties.find(s => String(s.name).trim().toLowerCase() === String(sname).trim().toLowerCase());
            if (match) sid = Number(match.id); else { sid = ++sMaxId; nextSpecialties = [...nextSpecialties, { id: sid, name: sname }]; }
          }
          return { ...d, specialty_id: sid };
        });

        // Sync department membership
        let nextDepartments = departments.slice();
        const depByKey = (name, hid) => nextDepartments.find(dd => String(dd.name).trim().toLowerCase() === String(name).trim().toLowerCase() && Number(dd.hospital_id) === Number(hid));
        imported.forEach(d => {
          if (d.department && d.hospital_id) {
            const dep = depByKey(d.department, d.hospital_id);
            if (dep) {
              const members = Array.isArray(dep.members) ? dep.members.slice() : [];
              const idNum = Number(d.id);
              if (!members.map(Number).includes(idNum)) {
                const updated = { ...dep, members: [...members, idNum] };
                nextDepartments = nextDepartments.map(x => x.id === dep.id ? updated : x);
              }
            }
          }
        });

        setHospitals(nextHospitals);
        store.write('hospitals', nextHospitals);
        setSpecialties(nextSpecialties);
        store.write('specialties', nextSpecialties);
        setDepartments(nextDepartments);
        store.write('departments', nextDepartments);

        setDoctors(imported);
        store.write('doctors', imported);
        showToast(`Imported ${imported.length} doctors; synced ${nextHospitals.length - hospitals.length} hospitals, ${nextSpecialties.length - specialties.length} specialties`);
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
      showToast('Import failed', false);
    }
  };
  const tabIcons = { hospitals: 'bi-hospital', specialties: 'bi-person-badge', departments: 'bi-diagram-3', doctors: 'bi-person-lines-fill' };
  const TabButton = ({ id, label }) => (
    <button className={'tab' + (active === id ? ' active' : '')} onClick={() => setActive(id)}>
      <i className={'bi ' + (tabIcons[id] || 'bi-ui-checks')}></i>{label}
    </button>
  );
  return (
    <main className={"data-layout" + (active === 'vacation-plans' ? ' vacplans-wide' : '')}>
      <aside className="vtabs">
        <TabButton id="hospitals" label="Hospitals" />
        <TabButton id="specialties" label="Specialties" />
        <TabButton id="departments" label="Departments" />
        <TabButton id="doctors" label="Doctors" />
      </aside>
      <section className="data-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: 'var(--muted)', fontSize: 12 }}>Today: {todayISO}</div>
          <div className="row" style={{ margin: 0, gap: 8, alignItems: 'center' }}>
            <label style={{ margin: 0 }}>Import Data (CSV/XLSX)</label>
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={e => importDataFromFile(e.target.files[0])} />
            <button type="button" onClick={() => { if (fileInputRef.current && fileInputRef.current.files[0]) importDataFromFile(fileInputRef.current.files[0]); }}><i className="bi bi-file-earmark-arrow-up"></i>Import</button>
            <button type="button" className="btn" onClick={exportAllData}><i className="bi bi-file-earmark-arrow-down"></i>Export Backup</button>
            <button type="button" className="btn btn-deny" onClick={resetAllData}><i className="bi bi-arrow-counterclockwise"></i>Reset Data</button>
          </div>
        </div>
        {active === 'hospitals' && (
          <Section title="Hospitals"><Hospitals hospitals={hospitals} setHospitals={setHospitals} doctors={doctors} setDoctors={setDoctors} departments={departments} /></Section>
        )}
        {active === 'specialties' && (
          <Section title="Specialties"><Specialties specialties={specialties} setSpecialties={setSpecialties} doctors={doctors} setDoctors={setDoctors} /></Section>
        )}
        {active === 'departments' && (
          <Section title="Departments"><Departments departments={departments} setDepartments={setDepartments} doctors={doctors} hospitals={hospitals} /></Section>
        )}
        {active === 'doctors' && (
          <Section title="Doctors"><Doctors doctors={doctors} setDoctors={setDoctors} specialties={specialties} setSpecialties={setSpecialties} hospitals={hospitals} setHospitals={setHospitals} departments={departments} setDepartments={setDepartments} /></Section>
        )}
        <footer>{toast && <Toast message={toast.msg} ok={toast.ok} />}</footer>
      </section>
    </main>
  );
}

function HospitalPage({ hospitalId, hospitals, departments, doctors, setDoctors, specialties }) {
  const hid = Number(hospitalId);
  const hospital = hospitals.find(h => Number(h.id) === hid);
  const hname = hospital?.name || null;
  const [selectedDeptId, setSelectedDeptId] = React.useState(null);
  const deptList = departments.filter(d => Number(d.hospital_id) === hid);
  const doctorBase = doctors.filter(d => Number(d.hospital_id) === hid || (d.hospital === hname));
  const selectedDept = selectedDeptId ? deptList.find(d => Number(d.id) === Number(selectedDeptId)) : null;
  const selectedMemberIds = selectedDept && Array.isArray(selectedDept.members) ? selectedDept.members.map(x => Number(x)).filter(x => Number.isFinite(x)) : null;
  const doctorList = doctorBase.filter(d => !selectedDeptId || (selectedMemberIds || []).includes(Number(d.id)));
  return (
    <main className="data-content" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>{hname || `Hospital #${hid}`}</h2>
        <button type="button" className="btn" onClick={() => { window.location.hash = '#/admin'; }}><i className="bi bi-arrow-left"></i>Back</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <div className="card">
          <div className="name">Departments</div>
          <div className="card-grid" style={{ marginTop: 8 }}>
            {deptList.map(d => (
              <div key={d.id} className={"hospital-card" + (Number(selectedDeptId) === Number(d.id) ? " selected" : "")} onClick={() => setSelectedDeptId(d.id)}>
                <div className="name">{d.name}</div>
                <div className="meta">Head: {(() => { const doc = doctors.find(x => Number(x.id) === Number(d.head_id)); return doc ? doc.name : '-'; })()}</div>
              </div>
            ))}
            {deptList.length === 0 && (
              <div className="card" style={{ gridColumn: '1 / -1', color: 'var(--muted)' }}>No departments for this hospital</div>
            )}
          </div>
        </div>
        <div className="card">
          <div className="name">Doctors{selectedDept ? ` · ${selectedDept.name}` : ''}</div>
          {!!selectedDept && (
            <div className="row" style={{ marginTop: 8 }}>
              <button type="button" className="btn" onClick={() => setSelectedDeptId(null)}>Clear department filter</button>
            </div>
          )}
          <div className="card-grid" style={{ marginTop: 8 }}>
            {doctorList.map(d => (
              <DoctorCard key={d.id}
                doctor={d}
                doctors={doctors}
                setDoctors={setDoctors}
                specialties={specialties}
                hospitals={hospitals}
              />
            ))}
            {doctorList.length === 0 && (
               <div className="card" style={{ gridColumn: '1 / -1', color: 'var(--muted)' }}>{selectedDept ? 'No doctors assigned to this department' : 'No doctors for this hospital'}</div>
             )}
          </div>
        </div>
      </div>
    </main>
  );
}

function HospitalCard({ hospital, editId, editName, onEditStart, onEditName, onEditSave, onEditCancel, hospitals, setHospitals, doctors, setDoctors, onSelect, selected }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const removeHospital = () => {
    if (!window.confirm('Remove this hospital?')) return;
    const hid = hospital.id;
    const nextHospitals = hospitals.filter(h => h.id !== hid);
    setHospitals(nextHospitals);
    store.write('hospitals', nextHospitals);
    if (doctors && setDoctors) {
      const nextDoctors = doctors.map(d => d.hospital_id === hid ? { ...d, hospital_id: null, hospital: null } : d);
      setDoctors(nextDoctors);
      store.write('doctors', nextDoctors);
    }
    setMenuOpen(false);
  };
  return (
    <div className={"hospital-card" + (selected ? " selected" : "")} onClick={() => { if (editId !== hospital.id) { window.location.hash = `#/hospital/${hospital.id}`; } }}>
      {editId === hospital.id ? (
        <>
          <input value={editName} onChange={e => onEditName(e.target.value)} placeholder="Hospital name" style={{ flex: 1, marginRight: 8 }} />
          <button type="button" onClick={onEditSave}>Save</button>
          <button type="button" className="btn btn-deny" onClick={onEditCancel}>Cancel</button>
        </>
      ) : (
        <>
          <div className="name">{hospital.name}</div>
          <button className="kebab-btn" type="button" onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }} aria-label="Options">⋮</button>
        </>
      )}
      {menuOpen && editId !== hospital.id && (
        <div className="kebab-menu">
            <button className="kebab-item" type="button" onClick={(e) => { e.stopPropagation(); onEditStart(); setMenuOpen(false); }}><i className="bi bi-pencil"></i>Edit</button>
          <button className="kebab-item" type="button" onClick={(e) => { e.stopPropagation(); removeHospital(); }}>Remove</button>
        </div>
      )}
    </div>
  );
}

function DoctorCard({ doctor, doctors, setDoctors, specialties, hospitals }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(doctor.name || '');
  const [grade, setGrade] = React.useState(doctor.grade || '');
  const [phone, setPhone] = React.useState(doctor.phone || '');
  const [jobNumber, setJobNumber] = React.useState(doctor.job_number || '');
  const [email, setEmail] = React.useState(doctor.email || '');
  const initialSpecId = doctor.specialty_id || (specialties.find(s => s.name === doctor.specialty)?.id) || '';
  const initialHospId = doctor.hospital_id || (hospitals.find(h => h.name === doctor.hospital)?.id) || '';
  const [specId, setSpecId] = React.useState(initialSpecId);
  const [hospId, setHospId] = React.useState(initialHospId);

  React.useEffect(() => {
    if (editing) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
      return () => {
        document.body.style.overflow = originalOverflow || '';
        document.body.classList.remove('modal-open');
      };
    }
  }, [editing]);

  const cancelEdit = () => {
    setEditing(false);
    setMenuOpen(false);
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
  };

  const saveEdit = () => {
    const specObj = specialties.find(s => s.id === Number(specId));
    const hospObj = hospitals.find(h => h.id === Number(hospId));
    const nextDoctors = doctors.map(d => d.id === doctor.id ? {
      ...d,
      name: String(name || '').trim(),
      grade: String(grade || '').trim(),
      phone: String(phone || '').trim() || null,
      job_number: String(jobNumber || '').trim() || null,
      email: String(email || '').trim() || null,
      specialty_id: specObj ? specObj.id : null,
      specialty: specObj ? specObj.name : null,
      hospital_id: hospObj ? hospObj.id : null,
      hospital: hospObj ? hospObj.name : null,
    } : d);
    setDoctors(nextDoctors);
    store.write('doctors', nextDoctors);
    cancelEdit();
  };

  const removeDoctor = () => {
    if (!window.confirm('Remove this doctor?')) return;
    const nextDoctors = doctors.filter(d => d.id !== doctor.id);
    setDoctors(nextDoctors);
    store.write('doctors', nextDoctors);
    setMenuOpen(false);
  };

  return (
    <div className="doctor-card">
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="name">{doctor.name}</div>
        <div className="meta">{doctor.specialty || '-'} · {doctor.grade || '-'} · {doctor.hospital || '-'}</div>
      </div>
      <button className="kebab-btn" type="button" onClick={() => setMenuOpen(v => !v)} aria-label="Options">⋮</button>
      {menuOpen && (
        <div className="kebab-menu">
          <button className="kebab-item" type="button" onClick={() => { setEditing(true); setMenuOpen(false); }}>Edit</button>
          <button className="kebab-item" type="button" onClick={removeDoctor}>Remove</button>
        </div>
      )}

      {editing && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal" style={{ width: 'min(1000px, 95vw)' }}>
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>Edit Doctor</h3>
              <div>
          <button type="button" className="btn" onClick={cancelEdit}><i className="bi bi-x-lg"></i>Close</button>
              </div>
            </header>
            <div className="modal-body">
              <div className="row"><label>Name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Doctor name" dir="auto" /></div>
              <div className="row"><label>Specialty</label><select value={specId} onChange={e => setSpecId(e.target.value)}><option value="">Unspecified</option>{specialties.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div className="row"><label>Grade</label><input value={grade} onChange={e => setGrade(e.target.value)} placeholder="e.g., Consultant" /></div>
              <div className="row"><label>Phone Number</label><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g., +1 555 0100" /></div>
              <div className="row"><label>Job Number</label><input value={jobNumber} onChange={e => setJobNumber(e.target.value)} placeholder="e.g., EMP-1234" /></div>
              <div className="row"><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g., alice@hospital.org" /></div>
              <div className="row"><label>Hospital</label><select value={hospId} onChange={e => setHospId(e.target.value)}><option value="">Unspecified</option>{hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div>
            </div>
            <footer style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button type="button" className="btn-view" onClick={saveEdit}><i className="bi bi-save"></i>Save Changes</button>
          <button type="button" className="btn btn-deny" onClick={cancelEdit}><i className="bi bi-x-circle"></i>Cancel</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

function OnCall({ hospitals, departments, duties, doctors, shifts, setDuties, vacations }) {
  const [filters, setFilters] = useGlobalFilters();
  const hospitalId = filters.hospitalId || '';
  const setHospitalId = (v) => setFilters(prev => ({ ...prev, hospitalId: v }));
  const deptName = filters.department || '';
  const setDeptName = (v) => setFilters(prev => ({ ...prev, department: v }));
  const month = filters.month || defaultMonth();
  const setMonth = (v) => setFilters(prev => ({ ...prev, month: v }));
  const [selectedDate, setSelectedDate] = React.useState('');
  const [picker, setPicker] = React.useState('');
  const [assigned, setAssigned] = React.useState({}); // { dateISO: [doctorId, ...] }
  const [copyStart, setCopyStart] = React.useState('');
  const [copyEnd, setCopyEnd] = React.useState('');
  const [toast, showToast] = useToast();

  const doctorsForHospital = React.useMemo(() => {
    if (!hospitalId) return doctors;
    const selectedHospitalName = hospitals?.find(h => String(h.id) === String(hospitalId))?.name || null;
    return doctors.filter(d => (
      String(d.hospital_id) === String(hospitalId)
      || (!!selectedHospitalName && !!d.hospital && String(d.hospital).trim() === String(selectedHospitalName).trim())
    ));
  }, [doctors, hospitals, hospitalId]);

  const selectedDept = React.useMemo(() => {
    if (!hospitalId || !deptName) return null;
    const nameTrim = String(deptName || '').trim();
    return departments.find(d => Number(d.hospital_id) === Number(hospitalId) && String(d.name || '').trim() === nameTrim) || null;
  }, [departments, hospitalId, deptName]);

  const doctorsForDepartment = React.useMemo(() => {
    if (!selectedDept) return [];
    const memberIds = Array.isArray(selectedDept.members) ? selectedDept.members.map(x => Number(x)).filter(Number.isFinite) : [];
    return doctorsForHospital.filter(d => memberIds.includes(Number(d.id)));
  }, [doctorsForHospital, selectedDept]);

  const monthDays = React.useMemo(() => {
    if (!month) return [];
    const [y, m] = month.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0);
    const days = [];
    for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      days.push({ iso, day: d.getDate(), dow: d.getDay() });
    }
    return days;
  }, [month]);

  const todayIso = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const hasDuty = React.useCallback((iso) => {
    const dept = String(deptName || '').trim();
    if (!hospitalId || !dept) return false;
    return duties.some(d => d.date === iso && Number(d.hospital_id) === Number(hospitalId) && String(d.department) === dept && isOnCallDuty(d));
  }, [duties, hospitalId, deptName]);

  const tooltipForDay = React.useCallback((iso) => {
    const dept = String(deptName || '').trim();
    if (!hospitalId || !dept) return 'Select hospital & department';
    const entries = duties.filter(d => d.date === iso
      && Number(d.hospital_id) === Number(hospitalId)
      && String(d.department) === dept
      && isOnCallDuty(d));
    if (!entries.length) return 'No on-call assigned';
    const names = Array.from(new Set(entries.map(d => d.doctor_name || String(d.doctor_id))));
    return names.join(', ');
  }, [duties, hospitalId, deptName]);

  const openDay = (iso) => { setSelectedDate(iso); };

  const addDoctor = (doctorId) => {
    if (!selectedDate || !doctorId) return;
    const idNum = Number(doctorId);
    const onLeave = Array.isArray(vacations)
      && vacations.some(v => v && v.status === 'approved' && Number(v.doctor_id) === idNum && String(v.start_date) <= String(selectedDate) && String(v.end_date) >= String(selectedDate));
    if (onLeave) { showToast('Doctor on vacation', false); return; }
    setAssigned(prev => {
      const prevArr = prev[selectedDate] || [];
      if (prevArr.includes(idNum)) return prev;
      return { ...prev, [selectedDate]: [...prevArr, idNum] };
    });
  };
  const removeDoctor = (doctorId) => {
    if (!selectedDate) return;
    const idNum = Number(doctorId);
    setAssigned(prev => ({ ...prev, [selectedDate]: (prev[selectedDate]||[]).filter(id => id !== idNum) }));
  };

  const saveAssignments = () => {
    if (!selectedDate) return;
    const dept = String(deptName || '').trim();
    if (!hospitalId) return showToast('Select hospital first', false);
    if (!dept) return showToast('Enter department name', false);
    const doctorIds = assigned[selectedDate] || [];
    const filtered = duties.filter(d => !(d.date === selectedDate && Number(d.hospital_id) === Number(hospitalId) && String(d.department) === dept && isOnCallDuty(d)));
    const code = 'FULL24';
    const additions = doctorIds.map(doctorId => {
      const doc = doctors.find(dd => dd.id === Number(doctorId));
      return {
        id: `${selectedDate}-FULL24-${doctorId}`,
        date: selectedDate,
        shift_id: null,
        shift_code: code,
        doctor_id: Number(doctorId),
        doctor_name: doc ? doc.name : String(doctorId),
        department: dept,
        hospital_id: Number(hospitalId)
      };
    });
    const next = [...filtered, ...additions];
    setDuties(next);
    store.write('duties', next);
    showToast(`Saved ${additions.length} 24H assignment${additions.length===1?'':'s'} for ${selectedDate}`, true);
  };

  const copyAssignmentsToRange = () => {
    if (!selectedDate) return;
    const dept = String(deptName || '').trim();
    if (!hospitalId) return showToast('Select hospital first', false);
    if (!dept) return showToast('Enter department name', false);
    const doctorIds = assigned[selectedDate] || [];
    if (!doctorIds.length) return showToast('Add doctors before copying', false);
    if (!copyStart || !copyEnd) return showToast('Set copy start and end dates', false);
    const start = new Date(copyStart);
    const end = new Date(copyEnd);
    if (isNaN(start) || isNaN(end) || start > end) return showToast('Invalid date range', false);
    const dates = [];
    const cur = new Date(start);
    while (cur <= end) {
      const iso = cur.toISOString().slice(0, 10);
      if (iso !== selectedDate) dates.push(iso);
      cur.setDate(cur.getDate() + 1);
    }
    let next = duties.slice();
    next = next.filter(d => !(Number(d.hospital_id) === Number(hospitalId) && String(d.department) === dept && isOnCallDuty(d) && dates.includes(d.date)));
    const additions = dates.flatMap(dateISO => doctorIds.map(doctorId => {
      const doc = doctors.find(dd => dd.id === Number(doctorId));
      return {
        id: `${dateISO}-FULL24-${doctorId}`,
        date: dateISO,
        shift_id: null,
        shift_code: 'FULL24',
        doctor_id: Number(doctorId),
        doctor_name: doc ? doc.name : String(doctorId),
        department: dept,
        hospital_id: Number(hospitalId)
      };
    }));
    next = [...next, ...additions];
    setDuties(next);
    store.write('duties', next);
    showToast(`Copied assignments to ${dates.length} day${dates.length===1?'':'s'}`, true);
  };

  // Prefill when opening a day
  React.useEffect(() => {
    if (!selectedDate) return;
    const dept = String(deptName || '').trim();
    if (!hospitalId || !dept) return;
    const existing = duties.filter(d => d.date === selectedDate && Number(d.hospital_id) === Number(hospitalId) && String(d.department) === dept && isOnCallDuty(d));
    const ids = Array.from(new Set(existing.map(d => Number(d.doctor_id))));
    setAssigned(prev => ({ ...prev, [selectedDate]: ids }));
  }, [selectedDate, hospitalId, deptName, duties]);

  const getDoctorName = (id) => (doctors.find(doc => doc.id === id) || {}).name || id;
  const getDoctorGrade = (id) => (doctors.find(doc => doc.id === id) || {}).grade || '-';
  const getDoctorPhone = (id) => (doctors.find(doc => doc.id === id) || {}).phone || '-';
  const rows = duties.filter(d => d.date === selectedDate && isOnCallDuty(d)
    && (!hospitalId || Number(d.hospital_id) === Number(hospitalId))
    && (!deptName || String(d.department) === String(deptName)));

  return (
    <>
      <div className="card scheduler-controls">
        <div className="row"><label>Hospital</label>
          <select value={hospitalId} onChange={e => setHospitalId(e.target.value)}>
            <option value="">Select hospital</option>
            {hospitals.map(h => (<option key={h.id} value={h.id}>{h.name}</option>))}
          </select>
        </div>
        {!!hospitalId && (
          <div className="row" style={{ gridColumn: '1 / -1' }}>
            <label>Departments</label>
            <div className="chips" style={{ marginTop: 6 }}>
              {departments.filter(d => Number(d.hospital_id) === Number(hospitalId)).map(d => (
                <button type="button" key={d.id} className={'chip' + (String(deptName).trim() === String(d.name).trim() ? ' selected' : '')} onClick={() => setDeptName(d.name)}>{d.name}</button>
              ))}
              {departments.filter(d => Number(d.hospital_id) === Number(hospitalId)).length === 0 && (
                <span style={{ color: 'var(--muted)' }}>No departments for selected hospital</span>
              )}
            </div>
          </div>
        )}
        <div className="row"><label>Month</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        <div>
          <div className="oncall-grid">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((w, idx) => (
              <div key={idx} className="weekday">{w}</div>
            ))}
            {(() => {
              const [y, m] = month.split('-').map(Number);
              const first = new Date(y, m - 1, 1);
              const offset = first.getDay();
              return Array.from({ length: offset }).map((_, i) => <div key={'empty-'+i}></div>);
            })()}
          {monthDays.map(d => (
            <div key={d.iso}
                   className={'day-cell' + ((d.dow === 0 || d.dow === 6) ? ' weekend' : '') + (todayIso === d.iso ? ' today' : '') + (selectedDate === d.iso ? ' selected' : '')}
                   onClick={() => openDay(d.iso)}>
              <div className="day-num">{d.day}</div>
              <div
                className="day-date"
                tabIndex={0}
                data-tooltip={tooltipForDay(d.iso)}
              >{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.dow]}</div>
              <span className={'day-dot ' + (hasDuty(d.iso) ? 'ok' : 'bad')}></span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="assign-panel">
            <h3 style={{ marginTop: 0 }}>Assign On-call (24H)</h3>
            <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 8 }}>
              {selectedDate ? `Date: ${selectedDate}` : 'Select a day to assign'}<br/>
              {hospitalId ? `Hospital: ${(hospitals.find(h => String(h.id) === String(hospitalId))||{}).name}` : 'Hospital not selected'}<br/>
              {deptName ? `Department: ${deptName}` : 'Department not set'}<br/>
              Format: Full (24H)
            </div>
            {selectedDate && (
              <>
                <div className="slot-actions">
                  <select value={picker} onChange={e => setPicker(e.target.value)} disabled={!selectedDept}>
                    <option value="">Choose doctor</option>
                    {doctorsForDepartment.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <button type="button" className="btn-view" onClick={() => addDoctor(picker)} disabled={!selectedDept}><i className="bi bi-plus-lg"></i>Add</button>
                </div>
                {!!selectedDept && doctorsForDepartment.length === 0 && (
                  <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>
                    No doctors assigned to this department.
                  </div>
                )}
                <div className="chips">
                  {(assigned[selectedDate] || []).map(id => {
                    const onLeave = Array.isArray(vacations) && selectedDate
                      ? vacations.some(v => v && v.status === 'approved' && Number(v.doctor_id) === Number(id) && String(v.start_date) <= String(selectedDate) && String(v.end_date) >= String(selectedDate))
                      : false;
                    return (
                      React.createElement('span', { key: id, className: 'chip' },
                        onLeave && React.createElement('span', { style: { display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: '#dc2626', marginRight: 6 } }),
                        getDoctorName(id),
                        onLeave && React.createElement('span', { className: 'badge-vac' }, 'ON VAC'),
                        React.createElement('button', { type: 'button', className: 'rm', 'aria-label': 'Remove', title: 'Remove', onClick: () => removeDoctor(id) }, React.createElement('i', { className: 'bi bi-x-lg' }))
                      )
                    );
                  })}
                </div>
                <button type="button" className="btn-view save-btn" onClick={saveAssignments}><i className="bi bi-save"></i>Save</button>
                <div className="slot-actions" style={{ marginTop: 12 }}>
                  <label style={{ marginRight: 8 }}>Copy to range</label>
                  <input type="date" value={copyStart} onChange={e => setCopyStart(e.target.value)} style={{ marginRight: 8 }} />
                  <span style={{ marginRight: 8 }}>to</span>
                  <input type="date" value={copyEnd} onChange={e => setCopyEnd(e.target.value)} style={{ marginRight: 8 }} />
                  <button type="button" className="btn-view" onClick={copyAssignmentsToRange} disabled={!copyStart || !copyEnd}><i className="bi bi-clipboard"></i>Copy</button>
                </div>
              </>
            )}
            {!selectedDate && (
              <p style={{ color: 'var(--muted)' }}>Pick a day from the calendar to assign on-call doctors.</p>
            )}
        </div>
      </div>
      </div>

      <div className="list"><h3>On-call Roster</h3>
        <table><thead><tr><th>Date</th><th>Grade</th><th>Doctor</th><th>Phone</th></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.id}>
              <td>{r.date}</td>
              <td>{getDoctorGrade(r.doctor_id)}</td>
              <td>{getDoctorName(r.doctor_id)}</td>
              <td>{getDoctorPhone(r.doctor_id)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <footer>{toast && <Toast message={toast.msg} ok={toast.ok} />}</footer>
    </>
  );
}

function OperationsPage({ hospitals, departments, doctors, shifts, vacations, setVacations, vacationPlans, setVacationPlans, duties, setDuties }) {
  const [active, setActive] = React.useState('duties');
  const [opsHospitalId, setOpsHospitalId] = React.useState('');
  const [opsDepartmentName, setOpsDepartmentName] = React.useState('');
  const [monthOps, setMonthOps] = React.useState(defaultMonth());
  const [planInputs, setPlanInputs] = React.useState({});
  const addPlan = (docId) => {
    const s = planInputs[docId]?.start;
    const e = planInputs[docId]?.end;
    if (!s || !e) return;
    const nextId = (vacationPlans.reduce((m, v) => Math.max(m, v.id), 0) || 0) + 1;
    const v = { id: nextId, doctor_id: Number(docId), start_date: s, end_date: e, status: 'planned', type: 'annual' };
    const next = [...vacationPlans, v]; setVacationPlans(next); store.write('vacation_plans', next);
  };
  const monthRangeOps = React.useMemo(() => {
    if (!monthOps || !/^\d{4}-\d{2}$/.test(monthOps)) return null;
    const [yy, mm] = monthOps.split('-').map(Number);
    const start = new Date(yy, mm - 1, 1).toISOString().slice(0, 10);
    const end = new Date(yy, mm, 0).toISOString().slice(0, 10);
    const label = new Date(yy, mm - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    return { start, end, label };
  }, [monthOps]);
  const opsTabIcons = { duties: 'bi-clipboard-check', oncall: 'bi-telephone', vacations: 'bi-airplane', 'vacation-plans': 'bi-calendar4-week' };
  const TabButton = ({ id, label }) => (
    <button className={'tab' + (active === id ? ' active' : '')} onClick={() => setActive(id)}>
      <i className={'bi ' + (opsTabIcons[id] || 'bi-ui-checks')}></i>{label}
    </button>
  );
  return (
    <main className={"data-layout" + (active === 'vacation-plans' ? ' vacplans-wide' : '')}>
      <aside className="vtabs">
        <TabButton id="duties" label="Duties" />
        <TabButton id="oncall" label="On-call" />
        <TabButton id="vacations" label="Vacations" />
        <TabButton id="vacation-plans" label="Vacation Plans" />
      </aside>
      <section className="data-content">
        {active === 'duties' && (
          <Section title="Schedules"><DutiesDesigner hospitals={hospitals} departments={departments} doctors={doctors} shifts={shifts} duties={duties} setDuties={setDuties} vacations={vacations} /></Section>
        )}
        {active === 'oncall' && (
          <Section title="On-call"><OnCall hospitals={hospitals} departments={departments} duties={duties} doctors={doctors} shifts={shifts} setDuties={setDuties} vacations={vacations} /></Section>
        )}
        {active === 'vacations' && (
          <Section title="Vacations"><Vacations doctors={doctors} hospitals={hospitals} departments={departments} vacations={vacations} setVacations={setVacations} /></Section>
        )}
        {active === 'vacation-plans' && (
          <Section title="Annual Vacation Plans">
            <VacationPlans
              hospitals={hospitals}
              departments={departments}
              doctors={doctors}
              vacationPlans={vacationPlans}
              setVacationPlans={setVacationPlans}
              opsHospitalId={opsHospitalId}
              setOpsHospitalId={setOpsHospitalId}
              opsDepartmentName={opsDepartmentName}
              setOpsDepartmentName={setOpsDepartmentName}
              planInputs={planInputs}
              setPlanInputs={setPlanInputs}
            />
          </Section>
        )}
        
      </section>
    </main>
  );
}

function DiagnosticsPage({ hospitals, departments, doctors, specialties, vacations, duties, shifts }) {
  const [perf, setPerf] = React.useState({ renderMs: null });
  const [a11y, setA11y] = React.useState({ violations: null, error: null });
  const [smoke, setSmoke] = React.useState({ topbar: false, rootHasChildren: false, dataHospitals: 0, dataSpecialties: 0, pingOk: null });
  const start = React.useRef(performance.now());
  React.useEffect(() => { setPerf({ renderMs: Math.round(performance.now() - start.current) }); }, []);
  React.useEffect(() => {
    const tb = !!document.querySelector('.topbar');
    const rc = !!document.getElementById('root') && (document.getElementById('root').childElementCount > 0);
    setSmoke(prev => ({ ...prev, topbar: tb, rootHasChildren: rc, dataHospitals: Array.isArray(hospitals) ? hospitals.length : 0, dataSpecialties: Array.isArray(specialties) ? specialties.length : 0 }));
    fetch('api/ping').then(r => r.ok ? r.json() : Promise.resolve(null)).then(j => setSmoke(prev => ({ ...prev, pingOk: !!(j && j.ok) }))).catch(() => setSmoke(prev => ({ ...prev, pingOk: false })));
  }, [hospitals, specialties]);
  React.useEffect(() => {
    if (window.axe) {
      window.axe.run(document).then(res => setA11y({ violations: res.violations || [] })).catch(err => setA11y({ violations: null, error: String(err || 'error') }));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.2/axe.min.js';
    s.onload = () => { window.axe && window.axe.run(document).then(res => setA11y({ violations: res.violations || [] })).catch(err => setA11y({ violations: null, error: String(err || 'error') })); };
    s.onerror = () => setA11y({ violations: null, error: 'axe load failed' });
    document.head.appendChild(s);
  }, []);
  const a11yCount = Array.isArray(a11y.violations) ? a11y.violations.length : null;
  return (
    <main className="data-content" style={{ padding: 16 }}>
      <div className="card"><div className="name">Diagnostics</div>
        <div className="kpi-grid" style={{ marginTop: 8 }}>
          <div className="kpi card"><div className="value">{perf.renderMs != null ? `${perf.renderMs} ms` : '-'}</div><div className="label">Initial Render</div></div>
          <div className="kpi card"><div className="value">{smoke.topbar ? 'OK' : 'Missing'}</div><div className="label">Topbar</div></div>
          <div className="kpi card"><div className="value">{smoke.rootHasChildren ? 'OK' : 'Empty'}</div><div className="label">Root Content</div></div>
          <div className="kpi card"><div className="value">{String(smoke.pingOk === null ? '-' : smoke.pingOk ? 'OK' : 'Fail')}</div><div className="label">API Ping</div></div>
          <div className="kpi card"><div className="value">{smoke.dataHospitals}</div><div className="label">Hospitals</div></div>
          <div className="kpi card"><div className="value">{smoke.dataSpecialties}</div><div className="label">Specialties</div></div>
          <div className="kpi card"><div className="value">{a11yCount != null ? a11yCount : (a11y.error ? 'Error' : '…')}</div><div className="label">A11y Violations</div></div>
        </div>
      </div>
      {Array.isArray(a11y.violations) && a11y.violations.length > 0 && (
        <div className="card" style={{ marginTop: 8 }}>
          <div className="name">Accessibility Issues</div>
          <div className="card-grid" style={{ marginTop: 8 }}>
            {a11y.violations.map((v, i) => (
              <div key={i} className="hospital-card">
                <div className="name">{v.id}</div>
                <div className="meta">{v.help}</div>
                <div className="meta">{Array.isArray(v.nodes) ? v.nodes.map(n => n.target.join(', ')).join(' | ') : ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function VacationPlans({ hospitals, departments, doctors, vacationPlans, setVacationPlans, opsHospitalId, setOpsHospitalId, opsDepartmentName, setOpsDepartmentName, planInputs, setPlanInputs }) {
  const [yearView, setYearView] = React.useState(new Date().getFullYear());
  const [showExport, setShowExport] = React.useState(false);
  const [toast, showToast] = useToast();
  const year = yearView;
  const yearStart = React.useMemo(() => new Date(year, 0, 1), [year]);
  const yearEnd = React.useMemo(() => new Date(year, 11, 31), [year]);
  const spanMs = React.useMemo(() => yearEnd.getTime() - yearStart.getTime(), [yearStart, yearEnd]);
  const pct = (iso) => {
    if (!iso) return 0;
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return 0;
    const pos = (t - yearStart.getTime()) / spanMs;
    return Math.max(0, Math.min(100, pos * 100));
  };
  const formatDM = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  };
  const planColors = (() => {
    const s = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
    const v = (name, fb) => {
      const val = s ? s.getPropertyValue(name).trim() : '';
      return val || fb;
    };
    return [
      v('--vacplan-1', 'rgba(245, 158, 11, 0.75)'),
      v('--vacplan-2', 'rgba(16, 185, 129, 0.75)'),
      v('--vacplan-3', 'rgba(99, 102, 241, 0.75)'),
      v('--vacplan-4', 'rgba(234, 88, 12, 0.75)'),
      v('--vacplan-5', 'rgba(20, 184, 166, 0.75)')
    ];
  })();
  const CalendarBubble = ({ docId, value, onOpenEntry }) => {
    return (
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 } },
        React.createElement('button', { type: 'button', className: 'btn btn-icon-sm', onClick: () => onOpenEntry(docId), 'aria-label': 'Enter vacation', title: 'Enter vacation' },
          React.createElement('i', { className: 'bi bi-calendar2-week' })
        ),
        value && React.createElement('span', { style: { fontSize: 12 } }, formatDM(value))
      )
    );
  };
  const YearBar = ({ year, plans, selection, onClickSegment, planColors }) => {
    const ticks = Array.from({ length: 12 }, (_, i) => {
      const left = (i / 12) * 100;
      return React.createElement('div', { key: 't-'+i, className: 'tick', style: { left: left+'%' } });
    });
    const labels = Array.from({ length: 12 }, (_, i) => {
      const left = ((i + 0.5) / 12) * 100;
      const text = new Date(year, i, 1).toLocaleString(undefined, { month: 'short' });
      return React.createElement('div', { key: 'l-'+i, className: 'month-label', style: { left: left+'%' } }, text);
    });
    const segments = (plans || []).map((v, idx) => {
      const left = pct(v.start_date);
      const width = Math.max(0, pct(v.end_date) - pct(v.start_date));
      const color = planColors[idx % planColors.length];
      return React.createElement('div', { key: 'p-'+idx, className: 'highlight planned', onClick: () => onClickSegment && onClickSegment(v), style: { left: left+'%', width: width+'%', background: color, cursor: 'pointer' } });
    });
    const selLeft = (selection?.start && selection?.end) ? pct(selection.start) : null;
    const selWidth = (selection?.start && selection?.end) ? Math.max(0, pct(selection.end) - pct(selection.start)) : null;
    return React.createElement('div', { className: 'year-bar day-grid' },
      Array.from({ length: 12 }, (_, i) => {
        const left = (i / 12) * 100; const width = (1 / 12) * 100;
        return React.createElement('div', { key: 'band-'+i, className: 'month-band', style: { left: left+'%', width: width+'%' } });
      }),
      ticks,
      segments,
      labels,
      (selLeft != null && selWidth != null) && React.createElement('div', { className: 'highlight selected', style: { left: selLeft+'%', width: selWidth+'%' } })
    );
  };
  const LegendList = ({ plans, year }) => {
    const yStart = new Date(year, 0, 1);
    const yEnd = new Date(year, 11, 31);
    return React.createElement('div', { style: { marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' } },
      plans.map((v, idx) => {
        const vs = new Date(v.start_date); const ve = new Date(v.end_date);
        const os = Math.max(vs.getTime(), yStart.getTime());
        const oe = Math.min(ve.getTime(), yEnd.getTime());
        const days = oe >= os ? (Math.floor((oe - os) / (1000*60*60*24)) + 1) : 0;
        return React.createElement('span', { key: 'k-'+idx, style: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10 } },
          React.createElement('span', { style: { width: 10, height: 10, borderRadius: 2, background: planColors[idx % planColors.length] } }),
          `${formatDM(v.start_date)}→${formatDM(v.end_date)} (${days} days)`
        );
      })
    );
  };
  const selectedHospitalId = Number(opsHospitalId) || null;
  const safeDepartments = Array.isArray(departments) ? departments.filter(d => d && typeof d === 'object') : [];
  const selectedDepartment = (opsDepartmentName && selectedHospitalId)
    ? safeDepartments.find(d => Number(d.hospital_id) === selectedHospitalId && String(d.name || '').trim() === String(opsDepartmentName || '').trim())
    : null;
  const hospName = (hospitals || []).find(h => String(h.id) === String(opsHospitalId))?.name || 'All';
  const deptName = opsDepartmentName || 'All';
  const memberIds = (selectedDepartment && Array.isArray(selectedDepartment.members))
    ? selectedDepartment.members.map(x => Number(x)).filter(x => Number.isFinite(x))
    : [];
  const deptDoctorsRaw = Array.isArray(doctors) ? doctors.filter(x => x && typeof x === 'object') : [];
  const deptDoctors = deptDoctorsRaw.filter(d => memberIds.includes(Number(d?.id)));
  const safeDeptDoctors = deptDoctors.filter(d => Number.isFinite(Number(d?.id)) && typeof d?.name === 'string' && d.name.trim().length > 0);
  const [entryDocId, setEntryDocId] = React.useState(null);
  const [entryStart, setEntryStart] = React.useState('');
  const [entryEnd, setEntryEnd] = React.useState('');
  const [entryPlanId, setEntryPlanId] = React.useState(null);
  const [showEntryModal, setShowEntryModal] = React.useState(false);
  React.useEffect(() => { if (showEntryModal) document.body.classList.add('modal-open'); else document.body.classList.remove('modal-open'); }, [showEntryModal]);
  const startRef = React.useRef(null);
  React.useEffect(() => { if (showEntryModal && startRef.current) startRef.current.focus(); }, [showEntryModal]);
  React.useEffect(() => { const h = (e) => { if (e.key === 'Escape') closeEntry(); }; if (showEntryModal) { document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); } }, [showEntryModal]);
  const openEntry = (docId) => { setEntryDocId(docId); const s = planInputs[docId]?.start || ''; const e = planInputs[docId]?.end || ''; setEntryStart(s); setEntryEnd(e); setShowEntryModal(true); };
  const closeEntry = () => { setShowEntryModal(false); setEntryDocId(null); setEntryPlanId(null); };
  const openEditPlan = (docId, plan) => { setEntryDocId(docId); setEntryStart(plan.start_date); setEntryEnd(plan.end_date); setEntryPlanId(plan.id); setShowEntryModal(true); };
  const addPlan = (docId) => {
    const s = planInputs[docId]?.start;
    const e = planInputs[docId]?.end;
    if (!s || !e) return;
    const nextId = (vacationPlans.reduce((m, v) => Math.max(m, v.id), 0) || 0) + 1;
    const v = { id: nextId, doctor_id: Number(docId), start_date: s, end_date: e, status: 'planned', type: 'annual' };
    const next = [...vacationPlans, v]; setVacationPlans(next); store.write('vacation_plans', next);
  };
  const addPlanFromModal = () => {
    if (!entryDocId || !entryStart || !entryEnd) return;
    const s = new Date(entryStart); const e = new Date(entryEnd);
    if (s > e) { showToast('Start must be before end', false); return; }
    const ys = new Date(year, 0, 1); const ye = new Date(year, 11, 31);
    if (s < ys || e > ye) { showToast('Plan must be within selected year', false); return; }
    const existing = (vacationPlans || []).filter(v => Number(v.doctor_id) === Number(entryDocId) && v.status === 'planned');
    const overlapExists = existing.some(v => Math.max(s.getTime(), new Date(v.start_date).getTime()) <= Math.min(e.getTime(), new Date(v.end_date).getTime()));
    if (overlapExists) { showToast('Overlapping plan detected', false); return; }
    const nextId = (vacationPlans.reduce((m, v) => Math.max(m, v.id), 0) || 0) + 1;
    const v = { id: nextId, doctor_id: Number(entryDocId), start_date: entryStart, end_date: entryEnd, status: 'planned', type: 'annual' };
    const next = [...vacationPlans, v]; setVacationPlans(next); store.write('vacation_plans', next); setEntryStart(''); setEntryEnd(''); showToast('Vacation plan added');
  };
  const updatePlanFromModal = () => {
    if (!entryPlanId || !entryDocId) return;
    if (!entryStart || !entryEnd) return;
    const s = new Date(entryStart); const e = new Date(entryEnd);
    if (s > e) { showToast('Start must be before end', false); return; }
    const ys = new Date(year, 0, 1); const ye = new Date(year, 11, 31);
    if (s < ys || e > ye) { showToast('Plan must be within selected year', false); return; }
    const existing = (vacationPlans || []).filter(v => Number(v.doctor_id) === Number(entryDocId) && v.status === 'planned' && v.id !== entryPlanId);
    const overlapExists = existing.some(v => Math.max(s.getTime(), new Date(v.start_date).getTime()) <= Math.min(e.getTime(), new Date(v.end_date).getTime()));
    if (overlapExists) { showToast('Overlapping plan detected', false); return; }
    const next = (vacationPlans || []).map(v => v.id === entryPlanId ? { ...v, start_date: entryStart, end_date: entryEnd } : v);
    setVacationPlans(next); store.write('vacation_plans', next); closeEntry(); showToast('Vacation plan updated');
  };
  const deletePlanFromModal = () => { if (!entryPlanId) return; const next = (vacationPlans || []).filter(v => v.id !== entryPlanId); setVacationPlans(next); store.write('vacation_plans', next); closeEntry(); };
  const buildRows = () => {
    return deptDoctors.map(doc => {
      const plans = (vacationPlans || []).filter(v => Number(v.doctor_id) === Number(doc.id) && v.status === 'planned');
      const sVal = planInputs[doc.id]?.start || '';
      const eVal = planInputs[doc.id]?.end || '';
      const selDays = (sVal && eVal) ? (Math.floor((new Date(eVal) - new Date(sVal)) / (1000*60*60*24)) + 1) : null;
      const plannedDays = plans.reduce((sum, v) => sum + (Math.floor((new Date(v.end_date) - new Date(v.start_date)) / (1000*60*60*24)) + 1), 0);
      return { Doctor: doc.name, Start: formatDM(sVal), End: formatDM(eVal), Days: (selDays && selDays > 0) ? selDays : (plannedDays ? plannedDays : '-') };
    });
  };
  const exportExcel = () => {
    const rows = buildRows();
    const header = ['Doctor','Start','End','Days'];
    const data = [header, ...rows.map(r => [r.Doctor, r.Start, r.End, r.Days])];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'VacationPlans');
    XLSX.writeFile(wb, 'vacation-plans.xlsx');
  };
  const exportWord = () => {
    const blocks = deptDoctors.map(doc => {
      const sVal = planInputs[doc.id]?.start || '';
      const eVal = planInputs[doc.id]?.end || '';
      const ys = new Date(year,0,1), ye = new Date(year,11,31);
      const plans = (vacationPlans || []).filter(v => Number(v.doctor_id) === Number(doc.id) && v.status === 'planned' && !(new Date(v.end_date) < ys || new Date(v.start_date) > ye));
      const ticks = Array.from({ length: 12 }, (_, i) => `<div class="tick" style="left: ${(i/12)*100}%;"></div>`).join('');
      const bands = Array.from({ length: 12 }, (_, i) => `<div class="month-band" style="left: ${(i/12)*100}%; width: ${(1/12)*100}%;"></div>`).join('');
      const labels = Array.from({ length: 12 }, (_, i) => { const left = ((i + 0.5) / 12) * 100; const text = new Date(year, i, 1).toLocaleString(undefined, { month: 'short' }); return `<div class="month-label" style="left: ${left}%">${text}</div>`; }).join('');
      const plansHtml = plans.map((v, idx) => { const left = Math.max(0, pct(v.start_date)); const width = Math.max(0, pct(v.end_date) - pct(v.start_date)); const color = planColors[idx % planColors.length]; return `<div class="highlight planned" style="left: ${left}%; width: ${width}%; background: ${color}"></div>`; }).join('');
      const bar = `<div class="year-bar day-grid">${bands}${ticks}${plansHtml}${labels}</div>`;
      const legend = plans.map((v, idx) => { const vs = new Date(v.start_date); const ve = new Date(v.end_date); const os = Math.max(vs.getTime(), ys.getTime()); const oe = Math.min(ve.getTime(), ye.getTime()); const days = oe >= os ? (Math.floor((oe - os) / (1000*60*60*24)) + 1) : 0; return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px"><span style="width:10px;height:10px;border-radius:2px;background:${planColors[idx % planColors.length]}"></span>${formatDM(v.start_date)}→${formatDM(v.end_date)} (${days} days)</span>`; }).join(' ');
      return `<section class="card" style="margin-bottom:6px"><h4>${doc.name}</h4><div style="margin:4px 0">Start: ${formatDM(sVal)} · End: ${formatDM(eVal)}</div>${bar}<div style="margin-top:2px;display:flex;flex-wrap:wrap;gap:4px;align-items:center">${legend}</div></section>`;
    }).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="stylesheet" href="styles.css"></head><body>${blocks}</body></html>`;
    const blob = new Blob([html], { type: 'application/msword' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'vacation-plans.doc'; a.click(); URL.revokeObjectURL(a.href);
  };
  const exportPDF = () => {
    const ys = new Date(year,0,1), ye = new Date(year,11,31);
    const msDay = 1000*60*60*24;
    const headerRow = '<thead><tr><th>Doctor</th><th>Plan (Start)</th><th>Days</th><th>Year</th></tr></thead>';
    const rowsHtml = safeDeptDoctors.map(doc => {
      const sVal = planInputs[doc.id]?.start || '';
      const eVal = planInputs[doc.id]?.end || '';
      const plans = (vacationPlans || []).filter(v => Number(v.doctor_id) === Number(doc.id) && v.status === 'planned' && Number.isFinite(new Date(v.start_date).getTime()) && Number.isFinite(new Date(v.end_date).getTime()) && !(new Date(v.end_date) < ys || new Date(v.start_date) > ye));
      const sDate = sVal ? new Date(sVal) : null;
      const eDate = eVal ? new Date(eVal) : null;
      const selStartMs = (sDate && eDate) ? Math.max(sDate.getTime(), ys.getTime()) : null;
      const selEndMs = (sDate && eDate) ? Math.min(eDate.getTime(), ye.getTime()) : null;
      const selDays = (selStartMs != null && selEndMs != null && selEndMs >= selStartMs) ? (Math.floor((selEndMs - selStartMs) / msDay) + 1) : null;
      const plannedDays = plans.reduce((sum, v) => {
        const vs = new Date(v.start_date); const ve = new Date(v.end_date);
        const os = Math.max(vs.getTime(), ys.getTime());
        const oe = Math.min(ve.getTime(), ye.getTime());
        const days = oe >= os ? (Math.floor((oe - os) / msDay) + 1) : 0;
        return sum + days;
      }, 0);
      const ticks = Array.from({ length: 12 }, (_, i) => `<div class="tick" style="left: ${(i/12)*100}%;"></div>`).join('');
      const bands = Array.from({ length: 12 }, (_, i) => `<div class="month-band" style="left: ${(i/12)*100}%; width: ${(1/12)*100}%;"></div>`).join('');
      const labels = Array.from({ length: 12 }, (_, i) => { const left = ((i + 0.5) / 12) * 100; const text = new Date(year, i, 1).toLocaleString(undefined, { month: 'short' }); return `<div class="month-label" style="left: ${left}%">${text}</div>`; }).join('');
      const segments = plans.map((v, idx) => { const left = Math.max(0, pct(v.start_date)); const width = Math.max(0, pct(v.end_date) - pct(v.start_date)); const color = planColors[idx % planColors.length]; return `<div class="highlight planned" style="left: ${left}%; width: ${width}%; background: ${color}"></div>`; }).join('');
      const bar = `<div class="year-bar day-grid">${bands}${ticks}${segments}${labels}</div>`;
      const legend = plans.map((v, idx) => { const vs = new Date(v.start_date); const ve = new Date(v.end_date); const os = Math.max(vs.getTime(), ys.getTime()); const oe = Math.min(ve.getTime(), ye.getTime()); const days = oe >= os ? (Math.floor((oe - os) / (1000*60*60*24)) + 1) : 0; return `<span style="display:inline-flex;align-items:center;gap:6px;font-size:11px"><span style="width:10px;height:10px;border-radius:2px;background:${planColors[idx % planColors.length]}"></span>${formatDM(v.start_date)}→${formatDM(v.end_date)} (${days} days)</span>`; }).join(' ');
      const daysCell = (selDays && selDays > 0) ? selDays : (plannedDays ? plannedDays : '-');
      const startCell = sVal ? formatDM(sVal) : '-';
      return `<tr><td>${doc.name}</td><td>${startCell}</td><td>${daysCell}</td><td>${bar}<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:6px;align-items:center">${legend}</div></td></tr>`;
    }).join('');
    const tableHtml = `<table class="table vacplans-table">${headerRow}<tbody>${rowsHtml}</tbody></table>`;
    const hospName = (hospitals || []).find(h => String(h.id) === String(opsHospitalId))?.name || 'All';
    const deptName = opsDepartmentName || 'All';
    const baseUrl = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
    const css = `@page{size:A4;margin:2mm 6mm 6mm 6mm}
    .card{padding:6px;border:1px solid #e2e8f0;border-radius:8px;background:#fff}
    .year-bar{position:relative;width:100%;height:14px;border:1px solid #cbd5e1;background:#ffffff}
    .year-bar .month-band{position:absolute;top:0;bottom:0;background:rgba(0,0,0,0.06)}
    .year-bar .tick{position:absolute;top:-3px;bottom:-3px;width:1px;background:#cbd5e1}
    .year-bar .month-label{position:absolute;top:100%;transform:translateX(-50%);font-size:9px;color:#475569}
    .year-bar .highlight{position:absolute;top:2px;bottom:2px;border-radius:2px}
    .sign-row{display:flex;gap:12px;margin-top:12px}
    .sign{flex:1;border-top:1px solid #94a3b8;padding-top:6px;font-size:11px;color:#334155;text-align:center}`;
    const header = `<div class="print-header">
      <img src="${baseUrl}hbhc-logo.png" alt="HBHC Logo" />
      <div>
        <div class="org-name">Annual Vacation Plans</div>
        <div class="org-subtitle">Hospital: ${hospName} · Department: ${deptName} · Year: ${year}</div>
      </div>
    </div>`;
    const signatures = `<div class="sign-row"><div class="sign">Head of Department</div><div class="sign">Medical Director</div><div class="sign">Hospital Director</div></div>`;
    const docHtml = `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Vacation Plans</title><base href="${baseUrl}"><link rel="stylesheet" href="${baseUrl}styles.css" /><style>${css}</style></head><body class="printing-only"><main class="printable"><section class="card print-only report-content">${header}${tableHtml}${signatures}</section></main></body></html>`;
    const w = window.open('', '_blank'); if (!w) return; w.document.open(); w.document.write(docHtml); w.document.close(); w.focus(); setTimeout(() => { w.print(); w.close(); }, 500);
  };
  const printVacationPlansPage = () => {
    const ys = new Date(year,0,1), ye = new Date(year,11,31);
    const msDay = 1000*60*60*24;
    const headerRow = '<thead><tr><th>Doctor</th><th>Plan (Start)</th><th>Days</th><th>Year</th></tr></thead>';
    const rowsHtml = (safeDeptDoctors || deptDoctors).map(doc => {
      const sVal = planInputs[doc.id]?.start || '';
      const eVal = planInputs[doc.id]?.end || '';
      const plans = (vacationPlans || []).filter(v => Number(v.doctor_id) === Number(doc.id) && v.status === 'planned' && Number.isFinite(new Date(v.start_date).getTime()) && Number.isFinite(new Date(v.end_date).getTime()) && !(new Date(v.end_date) < ys || new Date(v.start_date) > ye));
      const sDate = sVal ? new Date(sVal) : null;
      const eDate = eVal ? new Date(eVal) : null;
      const selStartMs = (sDate && eDate) ? Math.max(sDate.getTime(), ys.getTime()) : null;
      const selEndMs = (sDate && eDate) ? Math.min(eDate.getTime(), ye.getTime()) : null;
      const selDays = (selStartMs != null && selEndMs != null && selEndMs >= selStartMs) ? (Math.floor((selEndMs - selStartMs) / msDay) + 1) : null;
      const plannedDays = plans.reduce((sum, v) => {
        const vs = new Date(v.start_date); const ve = new Date(v.end_date);
        const os = Math.max(vs.getTime(), ys.getTime());
        const oe = Math.min(ve.getTime(), ye.getTime());
        const days = oe >= os ? (Math.floor((oe - os) / msDay) + 1) : 0;
        return sum + days;
      }, 0);
      const ticks = Array.from({ length: 12 }, (_, i) => `<div class="tick" style="left: ${(i/12)*100}%;"></div>`).join('');
      const bands = Array.from({ length: 12 }, (_, i) => `<div class="month-band" style="left: ${(i/12)*100}%; width: ${(1/12)*100}%;"></div>`).join('');
      const labels = Array.from({ length: 12 }, (_, i) => { const left = ((i + 0.5) / 12) * 100; const text = new Date(year, i, 1).toLocaleString(undefined, { month: 'short' }); return `<div class="month-label" style="left: ${left}%">${text}</div>`; }).join('');
      const segments = plans.map((v, idx) => { const left = Math.max(0, pct(v.start_date)); const width = Math.max(0, pct(v.end_date) - pct(v.start_date)); const color = planColors[idx % planColors.length]; return `<div class="highlight planned" style="left: ${left}%; width: ${width}%; background: ${color}"></div>`; }).join('');
      const bar = `<div class="year-bar day-grid">${bands}${ticks}${segments}${labels}</div>`;
      const legend = plans.map((v, idx) => { const vs = new Date(v.start_date); const ve = new Date(v.end_date); const os = Math.max(vs.getTime(), ys.getTime()); const oe = Math.min(ve.getTime(), ye.getTime()); const days = oe >= os ? (Math.floor((oe - os) / (1000*60*60*24)) + 1) : 0; return `<span style="display:inline-flex;align-items:center;gap:6px;font-size:11px"><span style="width:10px;height:10px;border-radius:2px;background:${planColors[idx % planColors.length]}"></span>${formatDM(v.start_date)}→${formatDM(v.end_date)} (${days} days)</span>`; }).join(' ');
      const daysCell = (selDays && selDays > 0) ? selDays : (plannedDays ? plannedDays : '-');
      const startCell = sVal ? formatDM(sVal) : '-';
      return `<tr><td>${doc.name}</td><td>${startCell}</td><td>${daysCell}</td><td>${bar}<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:6px;align-items:center">${legend}</div></td></tr>`;
    }).join('');
    const tableHtml = `<table class="table vacplans-table">${headerRow}<tbody>${rowsHtml}</tbody></table>`;
    const title = 'Annual Vacation Plans';
    const hospName = (hospitals || []).find(h => String(h.id) === String(opsHospitalId))?.name || 'All';
    const deptName = opsDepartmentName || 'All';
    const baseUrl = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
    const header = `<div class="print-header">
      <img src="${baseUrl}hbhc-logo.png" alt="HBHC Logo" />
      <div>
        <div class="org-name">${title}</div>
        <div class="org-subtitle">Hospital: ${hospName} · Department: ${deptName} · Year: ${year}</div>
      </div>
    </div>`;
    const css = `@page{size:A4;margin:2mm 6mm 6mm 6mm}
    .card{padding:6px;border:1px solid #e2e8f0;border-radius:8px;background:#fff}
    .year-bar{position:relative;width:100%;height:14px;border:1px solid #cbd5e1;background:#ffffff}
    .year-bar .month-band{position:absolute;top:0;bottom:0;background:rgba(0,0,0,0.06)}
    .year-bar .tick{position:absolute;top:-3px;bottom:-3px;width:1px;background:#cbd5e1}
    .year-bar .month-label{position:absolute;top:100%;transform:translateX(-50%);font-size:9px;color:#475569}
    .year-bar .highlight{position:absolute;top:2px;bottom:2px;border-radius:2px}
    .sign-row{display:flex;gap:12px;margin-top:12px}
    .sign{flex:1;border-top:1px solid #94a3b8;padding-top:6px;font-size:11px;color:#334155;text-align:center}`;
    const signatures = `<div class="sign-row"><div class="sign">Head of Department</div><div class="sign">Medical Director</div><div class="sign">Hospital Director</div></div>`;
    const docHtml = `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${title}</title><base href="${baseUrl}"><link rel="stylesheet" href="${baseUrl}styles.css" /><style>${css}</style></head><body class="printing-only"><main class="printable"><section class="card print-only report-content">${header}${tableHtml}${signatures}</section></main></body></html>`;
    const w = window.open('', '_blank'); if (!w) return; w.document.open(); w.document.write(docHtml); w.document.close(); w.focus(); setTimeout(() => { w.print(); w.close(); }, 500);
  };
  return (
    React.createElement(React.Fragment, null,
      React.createElement('div', { className: 'card', style: { marginTop: 8 } },
        React.createElement('div', { className: 'row' },
          React.createElement('label', null,
            React.createElement('i', { className: 'bi bi-hospital' }), 'Hospital'
          ),
          React.createElement('select', { value: opsHospitalId, onChange: e => { setOpsHospitalId(e.target.value); setOpsDepartmentName(''); } },
            React.createElement('option', { value: '' }, 'Select hospital'),
            (hospitals || []).map(h => React.createElement('option', { key: h.id, value: h.id }, h.name))
          )
        ),
        React.createElement('div', { className: 'row' },
          React.createElement('label', null,
            React.createElement('i', { className: 'bi bi-diagram-3' }), 'Department'
          ),
          React.createElement('select', { value: opsDepartmentName, onChange: e => setOpsDepartmentName(e.target.value), disabled: !opsHospitalId },
            React.createElement('option', { value: '' }, 'Select department'),
            (departments || []).filter(d => String(d.hospital_id) === String(opsHospitalId)).map(d => (
              React.createElement('option', { key: d.id, value: d.name }, d.name)
            ))
          )
        ),
        React.createElement('div', { className: 'row' },
          React.createElement('label', null,
            React.createElement('i', { className: 'bi bi-calendar3' }), 'Year'
          ),
          React.createElement('select', { value: String(yearView), onChange: e => setYearView(Number(e.target.value)) },
            (() => {
              const now = new Date().getFullYear();
              return Array.from({ length: 5 }, (_, i) => now - 2 + i).map(y => React.createElement('option', { key: y, value: y }, y));
            })()
          )
        ),
        React.createElement('div', { className: 'row smooth', style: { justifyContent: 'flex-end', gap: 6 } },
          React.createElement('button', { type: 'button', className: 'btn btn-icon-sm', onClick: () => setShowExport(v => !v), 'aria-label': 'Export options', title: 'Export options' },
            React.createElement('i', { className: 'bi bi-download' })
          ),
          React.createElement('button', { type: 'button', className: 'btn btn-icon-sm', onClick: printVacationPlansPage, 'aria-label': 'Print report', title: 'Print report' },
            React.createElement('i', { className: 'bi bi-printer' })
          )
        ),
        showExport && React.createElement('div', { className: 'chips', style: { justifyContent: 'flex-end' } },
          React.createElement('button', { type: 'button', className: 'btn', onClick: exportPDF },
            React.createElement('i', { className: 'bi bi-filetype-pdf' }), 'PDF'
          )
        )
      ),
      showEntryModal && React.createElement('div', { className: 'modal-overlay', onClick: closeEntry },
        React.createElement('div', { className: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'entry-modal-title', onClick: (e) => e.stopPropagation() },
          React.createElement('div', { className: 'modal-header' }, React.createElement('h3', { id: 'entry-modal-title' }, entryPlanId ? 'Edit Vacation' : 'Enter Vacation')),
          React.createElement('div', { className: 'modal-body' },
            React.createElement('div', { className: 'row' }, React.createElement('label', null, 'Start'), React.createElement('input', { ref: startRef, type: 'date', value: entryStart, min: `${year}-01-01`, max: `${year}-12-31`, onChange: e => setEntryStart(e.target.value) })),
            React.createElement('div', { className: 'row' }, React.createElement('label', null, 'End'), React.createElement('input', { type: 'date', value: entryEnd, min: `${year}-01-01`, max: `${year}-12-31`, onChange: e => setEntryEnd(e.target.value) })),
            React.createElement('div', { className: 'chips', style: { justifyContent: 'flex-end' } },
              entryPlanId
                ? React.createElement(React.Fragment, null,
                    React.createElement('button', { type: 'button', className: 'btn btn-approve', onClick: updatePlanFromModal }, 'Update'),
                    React.createElement('button', { type: 'button', className: 'btn btn-deny', onClick: deletePlanFromModal }, 'Delete'),
                    React.createElement('button', { type: 'button', className: 'btn', onClick: closeEntry }, 'Done')
                  )
                : React.createElement(React.Fragment, null,
                    React.createElement('button', { type: 'button', className: 'btn btn-approve', onClick: addPlanFromModal }, 'Add'),
                    React.createElement('button', { type: 'button', className: 'btn btn-deny', onClick: closeEntry }, 'Done')
                  )
            )
          )
        )
      ),
      React.createElement('div', { className: 'row mt-8 text-strong' }, `Hospital: ${hospName} · Department: ${deptName} · Year: ${year}`),
      React.createElement('table', { className: 'table vacplans-table' },
        React.createElement('thead', null,
          React.createElement('tr', null,
            React.createElement('th', null,
              React.createElement('i', { className: 'bi bi-person-vcard' }), 'Doctor'
            ),
            React.createElement('th', null,
              React.createElement('i', { className: 'bi bi-calendar2-week' }), 'Plan (Start)'
            ),
            React.createElement('th', null,
              React.createElement('i', { className: 'bi bi-123' }), 'Days'
            ),
            React.createElement('th', null,
              React.createElement('i', { className: 'bi bi-calendar3' }), 'Year'
            )
          )
        ),
        React.createElement('tbody', null,
          safeDeptDoctors.map(doc => {
            const safePlans = Array.isArray(vacationPlans) ? vacationPlans.filter(v => v && typeof v === 'object') : [];
            const plans = safePlans.filter(v => Number(v.doctor_id) === Number(doc.id) && v.status === 'planned');
            const sVal = planInputs[doc.id]?.start || '';
            const eVal = planInputs[doc.id]?.end || '';
            const yS = new Date(year, 0, 1);
            const yE = new Date(year, 11, 31);
            const plansYear = plans.filter(v => !(new Date(v.end_date) < yS || new Date(v.start_date) > yE));
            const yStart = new Date(year, 0, 1);
            const yEnd = new Date(year, 11, 31);
            const msDay = 1000*60*60*24;
            const sDate = sVal ? new Date(sVal) : null;
            const eDate = eVal ? new Date(eVal) : null;
            const selStartMs = (sDate && eDate) ? Math.max(sDate.getTime(), yStart.getTime()) : null;
            const selEndMs = (sDate && eDate) ? Math.min(eDate.getTime(), yEnd.getTime()) : null;
            const selDays = (selStartMs != null && selEndMs != null && selEndMs >= selStartMs) ? (Math.floor((selEndMs - selStartMs) / msDay) + 1) : null;
            const plannedDays = plansYear.reduce((sum, v) => {
              const vs = new Date(v.start_date); const ve = new Date(v.end_date);
              const os = Math.max(vs.getTime(), yStart.getTime());
              const oe = Math.min(ve.getTime(), yEnd.getTime());
              const days = oe >= os ? (Math.floor((oe - os) / msDay) + 1) : 0;
              return sum + days;
            }, 0);
            const tooltipParts = [];
            if (sVal && eVal && selDays > 0) tooltipParts.push(`Selected (in ${year}): ${formatDM(sVal)}→${formatDM(eVal)} (${selDays} days)`);
            if (plansYear.length) tooltipParts.push('Planned: ' + plansYear.map(v => `${formatDM(v.start_date)}→${formatDM(v.end_date)}`).join(', '));
            const tooltipText = tooltipParts.join(' • ');
              return React.createElement('tr', { key: 'plan-row-'+doc.id },
              React.createElement('td', null, doc.name),
              React.createElement('td', null,
                React.createElement(CalendarBubble, { docId: doc.id, value: sVal, onOpenEntry: openEntry })
              ),
              React.createElement('td', null, (selDays && selDays > 0) ? selDays : (plannedDays ? plannedDays : '-')),
              React.createElement('td', null,
                React.createElement(YearBar, { year, plans: plansYear, selection: (sVal && eVal) ? { start: sVal, end: eVal } : null, onClickSegment: (v) => openEditPlan(doc.id, v), planColors, 'data-tooltip': tooltipText }),
                React.createElement('div', { style: { marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' } },
                  (selDays && selDays > 0) && React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10 } },
                    React.createElement('span', { style: { width: 10, height: 10, borderRadius: 2, background: 'rgba(37,99,235,0.85)' } }),
                    `${formatDM(sVal)}→${formatDM(eVal)} (${selDays} days)`
                  ),
                  React.createElement(LegendList, { plans: plansYear, year })
                )
              )
            );
          }),
          safeDeptDoctors.length === 0 && React.createElement('tr', null,
            React.createElement('td', { colSpan: 4, style: { color: 'var(--muted)', textAlign: 'center' } }, selectedDepartment ? 'No doctors found in this department' : 'Select hospital and department')
          )
        )
      ),
      React.createElement('footer', null, toast && React.createElement(Toast, { message: toast.msg, ok: toast.ok }))
    )
  );
}

function Bar({ label, value, max }) { const pct = max > 0 ? Math.round((value / max) * 100) : 0; return (
  <div style={{ marginBottom: 10 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
      <span>{label}</span><span>{value} ({pct}%)</span>
    </div>
    <div className="bar-track">
      <div className="bar-fill" style={{ width: pct + '%' }}></div>
    </div>
  </div> ); }

const KPI = ({ label, value }) => (
  <div className="kpi card">
    <div className="value">{value}</div>
    <div className="label">{label}</div>
  </div>
);

function DashboardPage({ hospitals, departments, doctors, specialties, vacations, duties, shifts }) {
  const [filters, setFilters] = useGlobalFilters();
  const filterHospitalId = filters.hospitalId || '';
  const setFilterHospitalId = (v) => setFilters(prev => ({ ...prev, hospitalId: v }));
  const filterDepartmentName = filters.department || '';
  const setFilterDepartmentName = (v) => setFilters(prev => ({ ...prev, department: v }));
  const month = filters.month || defaultMonth();
  const setMonth = (v) => setFilters(prev => ({ ...prev, month: v }));
  const selectedHospitalId = Number(filterHospitalId) || null;
  const selectedHospitalName = hospitals?.find(h => h.id === selectedHospitalId)?.name || null;
  const [reportType, setReportType] = React.useState('duties');
  const openPrintWindow = (type) => {
    const monthLabel = monthRange ? monthRange.label : '';
    const title = type === 'oncall' ? 'On-call (24H) for Selected Month' : 'Duties for Selected Month';
    const metaHospital = selectedHospitalName ? `Hospital: ${selectedHospitalName}` : 'Hospital: All hospitals';
    const metaDept = filterDepartmentName ? `Department: ${filterDepartmentName}` : 'Department: All';
    const header = `
      <div class="print-header">
        <img src="hbhc-logo.png" alt="Hafr AlBatin Health Cluster" />
        <div class="header-text">
          <div class="org-name">Hafr AlBatin Health Cluster</div>
          <div class="org-subtitle">Empowered by Health Holding Co.</div>
        </div>
      </div>`;
    const meta = `<div class="print-meta"><span>${metaHospital}</span><span>${metaDept}</span><span>${monthLabel ? `Month: ${monthLabel}` : ''}</span></div>`;

    const dutiesMap = {};
    (monthlyDuties || []).forEach(d => { const key = String(d.date); if (!dutiesMap[key]) dutiesMap[key] = []; dutiesMap[key].push(d); });
    const dutiesRows = Object.entries(dutiesMap).sort((a,b)=>a[0].localeCompare(b[0])).map(([date, items]) => {
      const day = new Date(date).toLocaleDateString(undefined, { weekday: 'short' });
      const slots = { morning: [], evening: [], night: [] };
      items.forEach(d => {
        const s = getShiftInfo(d);
        const n = String(s.name || '').toLowerCase();
        const key = n.includes('morning') ? 'morning' : n.includes('evening') ? 'evening' : n.includes('night') ? 'night' : null;
        if (key) {
          const doc = (doctors || []).find(x => Number(x.id) === Number(d.doctor_id));
          const name = compactName(d.doctor_name || (doc ? doc.name : d.doctor_id));
          slots[key].push(name);
        }
      });
      const chipList = (k) => (slots[k].length ? slots[k].map(n => `<span class="chip chip-mini">${compactName(n)}</span>`).join(' - ') : '-');
      return `<tr><td>${date}</td><td>${day}</td><td>${chipList('morning')}</td><td>${chipList('evening')}</td><td>${chipList('night')}</td></tr>`;
    }).join('') || `<tr><td colspan="5" style="text-align:center;color:#666">No duties in selected month</td></tr>`;

    const oncallRows = onCallByDate.map(([date, items]) => {
      const day = new Date(date).toLocaleDateString(undefined, { weekday: 'short' });
      const cells = [0,1,2].map(i => {
        const it = items[i];
        if (!it) return `<td style="color:#666">-</td>`;
        const doc = (doctors || []).find(d => Number(d.id) === Number(it.doctor_id));
        const name = compactName(it.doctor_name || (doc ? doc.name : it.doctor_id));
        const grade = getDoctorGradeById(it.doctor_id);
        const phone = getDoctorPhone(it.doctor_id);
        return `<td><div class="doctor-name">${name}</div><div class="doctor-phone" style="font-size:12px;color:#666">${grade} · ${phone}</div></td>`;
      }).join('');
      return `<tr><td>${date}</td><td>${day}</td>${cells}</tr>`;
    }).join('') || `<tr><td colspan="5" style="text-align:center;color:#666">No on-call in selected month</td></tr>`;

    const table = type === 'oncall'
      ? `<table class="table oncall-monthly-table"><thead><tr><th>Date</th><th>Day</th><th>Doctor 1</th><th>Doctor 2</th><th>Doctor 3</th></tr></thead><tbody>${oncallRows}</tbody></table>`
      : `<table class="table duties-table"><thead><tr><th>Date</th><th>Day</th><th>Morning</th><th>Evening</th><th>Night</th></tr></thead><tbody>${dutiesRows}</tbody></table>`;

    const css = `@page{size:A4;margin:3mm 10mm 10mm 10mm}
    .sign-row{display:flex;gap:12px;margin-top:12px}
    .sign{flex:1;border-top:1px solid #94a3b8;padding-top:6px;font-size:11px;color:#334155;text-align:center}`;
    const signatures = `<div class="sign-row"><div class="sign">Head of Department</div><div class="sign">Medical Director</div><div class="sign">Hospital Director</div></div>`;
    const docHtml = `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${title}</title><link rel="stylesheet" href="styles.css" /><style>${css}</style></head><body class="printing-only print-confidential"><main class="printable"><section class="card print-only report-content">${header}<h4 class="section-title">${title}</h4>${meta}${table}${signatures}</section></main></body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(docHtml);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 300);
  };
  // Dashboard subpages: today | metrics | reports
  const [dashboardActive, setDashboardActive] = React.useState('today');
  React.useEffect(() => {
    const setFromHash = () => {
      const m = (window.location.hash.match(/^#\/dashboard\/(\w+)/) || [])[1];
      if (m === 'today' || m === 'metrics' || m === 'report') {
        setDashboardActive(m);
      } else {
        setDashboardActive('today');
      }
    };
    window.addEventListener('hashchange', setFromHash);
    setFromHash();
    return () => window.removeEventListener('hashchange', setFromHash);
  }, []);
  const dashTabIcons = { today: 'bi-calendar-event', metrics: 'bi-graph-up', report: 'bi-file-earmark-text' };
  const TabButton = ({ id, label }) => (
    <button className={'chip tab-chip' + (dashboardActive === id ? ' selected' : '')} onClick={() => { setDashboardActive(id); window.location.hash = `#/dashboard/${id}`; }}>
      <i className={'bi ' + (dashTabIcons[id] || 'bi-ui-checks')}></i>{label}
    </button>
  );

  const filteredDoctors = React.useMemo(() => {
    const base = (!selectedHospitalId)
      ? doctors
      : doctors.filter(d => (
          d.hospital_id === selectedHospitalId
          || (!!selectedHospitalName && !!d.hospital && d.hospital === selectedHospitalName)
        ));
    if (!filterDepartmentName) return base;
    const nameTrim = String(filterDepartmentName).trim();
    const selectedDepartment = Array.isArray(departments)
      ? (selectedHospitalId
          ? departments.find(d => Number(d.hospital_id) === selectedHospitalId && String(d.name).trim() === nameTrim)
          : departments.find(d => String(d.name).trim() === nameTrim))
      : null;
    const memberIds = selectedDepartment && Array.isArray(selectedDepartment.members)
      ? selectedDepartment.members.map(Number).filter(Number.isFinite)
      : null;
    return base.filter(d => (
      (!!memberIds && memberIds.includes(Number(d.id)))
      || (String(d.department || '').trim() === nameTrim)
    ));
  }, [doctors, departments, selectedHospitalId, selectedHospitalName, filterDepartmentName]);

  const doctorIdSet = new Set(filteredDoctors.map(d => Number(d.id)));
  const filteredVacations = vacations.filter(v => doctorIdSet.has(Number(v.doctor_id)));
  const filteredDuties = duties.filter(dt => doctorIdSet.has(Number(dt.doctor_id)));

  // Calculate available doctors (active and not on approved leave today)
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const isOnLeaveToday = (docId) => filteredVacations.some(v => (
    v.status === 'approved'
    && Number(v.doctor_id) === Number(docId)
    && today >= new Date(v.start_date)
    && today <= new Date(v.end_date)
  ));
  const availableDoctors = filteredDoctors.filter(d => (d.active ? true : false) && !isOnLeaveToday(d.id));
  const totalAvailable = availableDoctors.length;

  const specCounts = {};
  availableDoctors.forEach(d => { const key = d.specialty || 'Unspecified'; specCounts[key] = (specCounts[key] || 0) + 1; });
  const bySpecialty = Object.entries(specCounts).map(([name, count]) => ({ name, count }));
  const maxSpec = Math.max(1, totalAvailable);
  // Vacation days grouped by department (within selected hospital if any)
  const deptList = Array.isArray(departments)
    ? (selectedHospitalId ? departments.filter(d => Number(d.hospital_id) === selectedHospitalId) : departments)
    : [];
  const leaveNowDeptPerc = deptList.map(dep => {
    const memberIds = Array.isArray(dep.members) ? dep.members.map(Number).filter(Number.isFinite) : null;
    const deptDocIds = memberIds
      ? filteredDoctors.filter(d => memberIds.includes(Number(d.id))).map(d => d.id)
      : filteredDoctors.filter(d => String(d.department || '').trim() === String(dep.name).trim()).map(d => d.id);
    const docIdSet = new Set(deptDocIds.map(Number));
    const totalMembers = docIdSet.size;
    const onLeaveCount = filteredVacations.reduce((acc, v) => acc + (
      docIdSet.has(Number(v.doctor_id)) && v.status === 'approved' && v.start_date <= todayISO && v.end_date >= todayISO
        ? 1
        : 0
    ), 0);
    const perc = totalMembers > 0 ? (onLeaveCount / totalMembers) * 100 : 0;
    return { name: dep.name, perc };
  });
  const maxLeaveNowPerc = 100;

  // Today metrics
  const dutiesToday = filteredDuties.filter(d => String(d.date) === String(todayISO));
    const onCallsToday = dutiesToday.filter(isOnCallDuty);
    const dutiesTodayRegular = dutiesToday.filter(d => !isOnCallDuty(d));

  // Monthly ranges and filtered lists for reports
  const monthRange = React.useMemo(() => {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) return null;
    const [yy, mm] = month.split('-').map(Number);
    const start = new Date(yy, mm - 1, 1).toISOString().slice(0, 10);
    const end = new Date(yy, mm, 0).toISOString().slice(0, 10);
    const label = new Date(yy, mm - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    return { start, end, label };
  }, [month]);
  const dutiesInMonth = React.useMemo(() => {
    if (!monthRange) return [];
    return filteredDuties.filter(d => String(d.date) >= monthRange.start && String(d.date) <= monthRange.end);
  }, [filteredDuties, monthRange]);
  const monthlyOnCalls = React.useMemo(() => dutiesInMonth.filter(isOnCallDuty), [dutiesInMonth]);
  const monthlyDuties = React.useMemo(() => dutiesInMonth.filter(d => !isOnCallDuty(d)), [dutiesInMonth]);
  const dutiesByDate = React.useMemo(() => {
    const map = {};
    (monthlyDuties || []).forEach(d => { const key = String(d.date); if (!map[key]) map[key] = []; map[key].push(d); });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [monthlyDuties]);
  const onCallByDate = React.useMemo(() => {
    const map = {};
    (monthlyOnCalls || []).forEach(d => {
      const key = String(d.date);
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [monthlyOnCalls]);
  const reportDiagnostics = React.useMemo(() => {
    const total = dutiesInMonth.length;
    const onCalls = monthlyOnCalls.length;
    const regular = monthlyDuties.length;
    const overlapByKey = {};
    dutiesInMonth.forEach(d => {
      const key = `${d.date}:${d.doctor_id}`;
      overlapByKey[key] = (overlapByKey[key] || 0) + 1;
    });
    const overlapping = Object.values(overlapByKey).filter(n => n > 1).length;
    return { total, onCalls, regular, overlapping };
  }, [dutiesInMonth, monthlyOnCalls, monthlyDuties]);
  const getDoctorPhone = (id) => {
    const doc = (doctors || []).find(doc => Number(doc.id) === Number(id));
    return (doc && doc.phone) ? doc.phone : '-';
  };
  const getDoctorGradeById = (id) => {
    const doc = (doctors || []).find(doc => Number(doc.id) === Number(id));
    return (doc && doc.grade) ? doc.grade : '-';
  };
  const compactName = (name) => {
    const n = String(name || '').trim();
    if (!n) return '';
    const isArabic = /[\u0600-\u06FF]/.test(n);
    const parts = n.split(/\s+/).filter(Boolean);
    if (isArabic) {
      return parts.slice(0, Math.min(2, parts.length)).join(' ');
    }
    if (parts.length === 1) return parts[0];
    const first = parts[0];
    const lastInit = (parts[parts.length - 1] || '').charAt(0).toUpperCase();
    const short = `${first} ${lastInit ? lastInit + '.' : ''}`.trim();
    return short.length > 24 ? short.slice(0, 24) + '…' : short;
  };
  const activeDoctorsInScope = filteredDoctors.filter(d => d.active);
  const dutyTodaySet = new Set(dutiesToday.map(d => Number(d.doctor_id)));
  const vacationTodayCount = activeDoctorsInScope.filter(d => isOnLeaveToday(d.id)).length;
  const workingTodayCount = activeDoctorsInScope.filter(d => !isOnLeaveToday(d.id) && dutyTodaySet.has(Number(d.id))).length;
  // Off Today: any doctor in scope (active or inactive) who is NOT on-call or on duty
  const offTodayCount = filteredDoctors.filter(d => !dutyTodaySet.has(Number(d.id))).length;
  const denomActive = Math.max(1, activeDoctorsInScope.length);
  const denomOff = Math.max(1, filteredDoctors.length);
  const percWorking = Math.round((workingTodayCount / denomActive) * 100);
  const percOff = Math.round((offTodayCount / denomOff) * 100);
  const percVacation = Math.round((vacationTodayCount / denomActive) * 100);

  const getShiftInfo = (duty) => {
    const code = String(duty.shift_code || '').toUpperCase();
    let shift = null;
    if (duty.shift_id != null) {
      shift = (shifts || []).find(s => Number(s.id) === Number(duty.shift_id)) || null;
    }
    if (!shift && code) {
      shift = (shifts || []).find(s => String(s.code).toUpperCase() === code) || null;
    }
    const name = shift?.name || (code || 'Duty');
    const start = shift?.start_time || (code === '24H' || code === 'FULL24' ? '00:00' : '');
    const end = shift?.end_time || (code === '24H' || code === 'FULL24' ? '23:59' : '');
    return { name, code: code || '', start, end };
  };

  

  const totalDoctors = filteredDoctors.length;
  const activeDoctors = filteredDoctors.filter(d => d.active).length;
  const approvedVacationDays = Math.round(filteredVacations.reduce((acc, v) => acc + (v.status === 'approved' ? ((new Date(v.end_date) - new Date(v.start_date)) / (1000*60*60*24) + 1) : 0), 0));
  const totalDuties = filteredDuties.length;
  const specialtiesCount = new Set(filteredDoctors.map(d => d.specialty || 'Unspecified')).size;

  return (
      <main className="dashboard-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, padding: 16, justifyContent: 'center', maxWidth: 1200, margin: '0 auto' }}>
        <div className="chips tabs" style={{ marginTop: 0, marginBottom: 8 }}>
          <TabButton id="today" label="Today" />
          <TabButton id="metrics" label="Key Metrics" />
          <TabButton id="report" label="Report" />
        </div>

      <div className="card" style={{ alignSelf: 'start' }}>
        <div className="row smooth">
          <label><i className="bi bi-hospital"></i>Hospital</label>
          <select value={filterHospitalId} onChange={e => setFilterHospitalId(e.target.value)}>
            <option value="">All hospitals</option>
            {(hospitals || []).map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
        <div className="row smooth">
          <label><i className="bi bi-diagram-3"></i>Department</label>
          <select value={filterDepartmentName} onChange={e => setFilterDepartmentName(e.target.value)}>
            <option value="">All departments</option>
            {Array.from(new Set((Array.isArray(departments) ? (selectedHospitalId ? departments.filter(d => Number(d.hospital_id) === selectedHospitalId) : departments) : [])
              .map(d => String(d.name || '').trim()).filter(Boolean)))
              .map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
      </div>

      {dashboardActive === 'today' && (
      <Section title="Today">
        <div className="kpi-grid">
          <KPI label="Duties Today" value={dutiesTodayRegular.length} />
          <KPI label="On-calls Today (24H)" value={onCallsToday.length} />
          <KPI label="Off Today" value={`${offTodayCount} (${percOff}%)`} />
          <KPI label="On Vacation Today" value={`${vacationTodayCount} (${percVacation}%)`} />
        </div>
        <div className="card" style={{ marginTop: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Coverage</div>
              {React.createElement(Bar, { label: 'Working Today', value: percWorking, max: 100 })}
              {React.createElement(Bar, { label: 'On Vacation', value: percVacation, max: 100 })}
            </div>
          </div>
        </div>
      </Section>
      )}

      {dashboardActive === 'metrics' && (
      <Section title="Key Metrics">
        <div className="kpi-grid">
          <KPI label="Total Doctors" value={totalDoctors} />
          <KPI label="Active Doctors" value={activeDoctors} />
          <KPI label="Approved Vacation Days" value={approvedVacationDays} />
          <KPI label="Duties Generated" value={totalDuties} />
          <KPI label="Specialties" value={specialtiesCount} />
        </div>
        <div className="card" style={{ marginTop: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Top 5 Duties</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {Array.from((() => { const m = new Map(); (monthlyDuties || []).forEach(d => { const id = Number(d.doctor_id); m.set(id, (m.get(id) || 0) + 1); }); return m; })().entries()).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id,count],i) => (
                  React.createElement('li', { key: 'td-'+id, style: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border)' } },
                    React.createElement('span', null, `${i+1}. ${compactName(((doctors || []).find(x => Number(x.id) === Number(id))||{}).name || String(id))}`),
                    React.createElement('span', { className: 'chip chip-mini' }, count)
                  )
                ))}
                {((monthlyDuties || []).length === 0) && React.createElement('li', { style: { color: 'var(--muted)' } }, 'No data')}
              </ul>
            </div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Top 5 On-call</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {Array.from((() => { const m = new Map(); (monthlyOnCalls || []).forEach(d => { const id = Number(d.doctor_id); m.set(id, (m.get(id) || 0) + 1); }); return m; })().entries()).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id,count],i) => (
                  React.createElement('li', { key: 'to-'+id, style: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border)' } },
                    React.createElement('span', null, `${i+1}. ${compactName(((doctors || []).find(x => Number(x.id) === Number(id))||{}).name || String(id))}`),
                    React.createElement('span', { className: 'chip chip-mini' }, count)
                  )
                ))}
                {((monthlyOnCalls || []).length === 0) && React.createElement('li', { style: { color: 'var(--muted)' } }, 'No data')}
              </ul>
            </div>
          </div>
        </div>
        <div className="card" style={{ marginTop: 8 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Duty Distribution (Month)</div>
            {React.createElement(Bar, { label: 'Morning', value: (monthlyDuties || []).filter(d => String(getShiftInfo(d).name || '').toLowerCase().includes('morning')).length, max: Math.max(1, (monthlyDuties || []).length) })}
            {React.createElement(Bar, { label: 'Evening', value: (monthlyDuties || []).filter(d => String(getShiftInfo(d).name || '').toLowerCase().includes('evening')).length, max: Math.max(1, (monthlyDuties || []).length) })}
            {React.createElement(Bar, { label: 'Night', value: (monthlyDuties || []).filter(d => String(getShiftInfo(d).name || '').toLowerCase().includes('night')).length, max: Math.max(1, (monthlyDuties || []).length) })}
          </div>
        </div>
      </Section>
      )}

      

      {dashboardActive === 'report' && (
      <div style={{ gridColumn: '1 / -1' }}>
      <Section title="Monthly Reports">
        <div className="row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" className={'chip tab-chip' + (reportType === 'duties' ? ' selected' : '')} onClick={() => setReportType('duties')}>
            <i className="bi bi-clipboard-check"></i>Duties
          </button>
          <button type="button" className={'chip tab-chip' + (reportType === 'oncall' ? ' selected' : '')} onClick={() => setReportType('oncall')}>
            <i className="bi bi-telephone"></i>On-call
          </button>
        </div>
        <div className="row" style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
          <div className="row"><label><i className="bi bi-hospital"></i>Hospital</label>
            <select value={filterHospitalId} onChange={e => { setFilterHospitalId(e.target.value); setFilterDepartmentName(''); }}>
              <option value="">Select hospital</option>
              {(hospitals || []).map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          <div className="row"><label><i className="bi bi-diagram-3"></i>Department</label>
            <select value={filterDepartmentName} onChange={e => setFilterDepartmentName(e.target.value)} disabled={!filterHospitalId}>
              <option value="">Select department</option>
              {(departments || []).filter(d => String(d.hospital_id) === String(filterHospitalId)).map(d => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="row"><label><i className="bi bi-calendar3"></i>Month</label>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <div className="print-meta">
            <span>{selectedHospitalName ? `Hospital: ${selectedHospitalName}` : 'Hospital: All hospitals'} · {filterDepartmentName ? `Speciality: ${filterDepartmentName}` : 'Speciality: All'}</span>
            <span>{monthRange ? `Month: ${monthRange.label}` : ''}</span>
          </div>
        </div>

        {reportType === 'duties' && (
          <div className="card print-only report-content" style={{ marginTop: 8 }}>
            <h4 className="section-title">Duties for Selected Month</h4>
            <div className="print-header">
              <img src="hbhc-logo.png" alt="Hafr AlBatin Health Cluster" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              <div className="header-text">
                <div className="org-name">Hafr AlBatin Health Cluster</div>
                <div className="org-subtitle">Empowered by Health Holding Co.</div>
              </div>
            </div>
            <table className="table duties-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Day</th>
                  <th>Morning</th>
                  <th>Evening</th>
                  <th>Night</th>
                </tr>
              </thead>
              <tbody>
                {dutiesByDate.map(([date, items]) => {
                  const day = new Date(date).toLocaleDateString(undefined, { weekday: 'short' });
                  const slots = { morning: [], evening: [], night: [] };
                  items.forEach(d => {
                    const s = getShiftInfo(d);
                    const n = String(s.name || '').toLowerCase();
                    const key = n.includes('morning') ? 'morning' : n.includes('evening') ? 'evening' : n.includes('night') ? 'night' : null;
                    if (key) {
                      const doc = (doctors || []).find(doc => Number(doc.id) === Number(d.doctor_id));
                      const nameFull = d.doctor_name || (doc ? doc.name : d.doctor_id);
                      const nameShort = compactName(nameFull);
                      slots[key].push(nameShort);
                    }
                  });
                  const renderChips = (arr) => (arr.length ? arr.map((nm, i) => (
                    React.createElement(React.Fragment, { key: 'nm-'+i },
                      React.createElement('span', { className: 'chip chip-mini' }, nm),
                      i < arr.length - 1 ? React.createElement('span', { className: 'sep' }, ' - ') : null
                    )
                  )) : React.createElement('span', { style: { color: 'var(--muted)' } }, '-'));
                  return (
                    <tr key={'duty-date-'+date}>
                      <td>{date}</td>
                      <td>{day}</td>
                      <td>{renderChips(slots.morning)}</td>
                      <td>{renderChips(slots.evening)}</td>
                      <td>{renderChips(slots.night)}</td>
                    </tr>
                  );
                })}
                {dutiesByDate.length === 0 && (
                  <tr><td colSpan="5" style={{ color: 'var(--muted)', textAlign: 'center' }}>No duties in selected month</td></tr>
                )}
              </tbody>
            </table>
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-view" onClick={() => openPrintWindow('duties')}><i className="bi bi-printer"></i>Print</button>
            </div>
          </div>
        )}

        {reportType === 'oncall' && (
          <div className="card print-only report-content" style={{ marginTop: 8 }}>
            <div className="print-header">
              <img src="hbhc-logo.png" alt="Hafr AlBatin Health Cluster" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              <div className="header-text">
                <div className="org-name">Hafr AlBatin Health Cluster</div>
                <div className="org-subtitle">Empowered by Health Holding Co.</div>
              </div>
            </div>
            <h4 className="section-title">On-call (24H) for Selected Month</h4>
            <div className="print-meta" style={{ marginTop: 4 }}>
              <span>{selectedHospitalName ? `Hospital: ${selectedHospitalName}` : 'Hospital: All hospitals'}</span>
              <span>{filterDepartmentName ? `Department: ${filterDepartmentName}` : 'Department: All'}</span>
            </div>
            <table className="table oncall-monthly-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Day</th>
                  <th>Doctor 1</th>
                  <th>Doctor 2</th>
                  <th>Doctor 3</th>
                </tr>
              </thead>
              <tbody>
                {onCallByDate.map(([date, items]) => {
                  const day = new Date(date).toLocaleDateString(undefined, { weekday: 'short' });
                  const cells = [0,1,2].map(i => {
                    const it = items[i];
                    if (!it) return (
                      <td key={'cell-empty-'+date+'-'+i} style={{ color: 'var(--muted)' }}>-</td>
                    );
                    const doc = (doctors || []).find(d => Number(d.id) === Number(it.doctor_id));
                    const name = it.doctor_name || (doc ? doc.name : it.doctor_id);
                    const grade = getDoctorGradeById(it.doctor_id);
                    const phone = getDoctorPhone(it.doctor_id);
                    return (
                      <td key={'cell-'+date+'-'+i}>
                        <div className="doctor-name">{name}</div>
                        <div className="doctor-phone" style={{ fontSize: 12, color: 'var(--muted)' }}>{grade} · {phone}</div>
                      </td>
                    );
                  });
                  return (
                    <tr key={'oncall-date-'+date}>
                      <td>{date}</td>
                      <td>{day}</td>
                      {cells}
                    </tr>
                  );
                })}
                {onCallByDate.length === 0 && (
                  <tr><td colSpan="5" style={{ color: 'var(--muted)', textAlign: 'center' }}>No on-call in selected month</td></tr>
                )}
              </tbody>
            </table>
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-view" onClick={() => openPrintWindow('oncall')}><i className="bi bi-printer"></i>Print</button>
            </div>
          </div>
        )}
      </Section>
      </div>
      )}






    </main>
  );
}

function Router({ route, setRoute, children }) { React.useEffect(() => { const onHash = () => setRoute(window.location.hash || '#/'); window.addEventListener('hashchange', onHash); onHash(); return () => window.removeEventListener('hashchange', onHash); }, [setRoute]); return children; }

function HomeCard({ title, desc, href }) {
  const icon = href.includes('data-entry') ? 'bi-database' : href.includes('operations') ? 'bi-calendar4-week' : href.includes('dashboard') ? 'bi-bar-chart' : 'bi-ui-checks';
  return (
    <a href={href} className="home-link">
      <div className="card home-tile"><div>
        <h2><i className={'bi ' + icon}></i>{title}</h2>
      </div></div>
    </a>
  );
}

function HomePage() { return (
  <main className="home-grid">
    <HomeCard title="Data Entry" desc="Hospitals, specialties, shifts, doctors" href="#/data-entry" />
    <HomeCard title="Schedules & Vacations" desc="Manage leave and generate rosters" href="#/operations" />
    <HomeCard title="Dashboard" desc="Visualize staffing, leave, and load" href="#/dashboard" />
    <HomeCard title="Diagnostics" desc="Performance & Accessibility" href="#/diagnostics" />
  </main>
); }

function App() {
  ensureSeeds();
  const [route, setRoute] = React.useState('#/operations');
  const [hospitals, setHospitals] = React.useState(store.read('hospitals', []));
  const [specialties, setSpecialties] = React.useState(store.read('specialties', []));
  const [departments, setDepartments] = React.useState(store.read('departments', []));
  const [doctors, setDoctors] = React.useState(store.read('doctors', []));
  const [shifts, setShifts] = React.useState(store.read('shifts', []));
  const [vacations, setVacations] = React.useState(store.read('vacations', []));
  const [vacationPlans, setVacationPlans] = React.useState(store.read('vacation_plans', []));
  const [duties, setDuties] = React.useState(store.read('duties', []));
  React.useEffect(() => { store.write('hospitals', hospitals); }, [hospitals]);
  React.useEffect(() => { store.write('specialties', specialties); }, [specialties]);
  React.useEffect(() => { store.write('departments', departments); }, [departments]);
  React.useEffect(() => { store.write('vacation_plans', vacationPlans); }, [vacationPlans]);
  React.useEffect(() => {
    (async () => {
      if ((Array.isArray(hospitals) ? hospitals.length : 0) === 0) {
        const data = await loadDataKey('hospitals');
        if (Array.isArray(data) && data.length) { setHospitals(data); store.write('hospitals', data); }
      }
      if ((Array.isArray(specialties) ? specialties.length : 0) === 0) {
        const data = await loadDataKey('specialties');
        if (Array.isArray(data) && data.length) { setSpecialties(data); store.write('specialties', data); }
      }
      if ((Array.isArray(departments) ? departments.length : 0) === 0) {
        const data = await loadDataKey('departments');
        if (Array.isArray(data) && data.length) { setDepartments(data); store.write('departments', data); }
      }
      if ((Array.isArray(doctors) ? doctors.length : 0) === 0) {
        const data = await loadDataKey('doctors');
        if (Array.isArray(data) && data.length) { setDoctors(data); store.write('doctors', data); }
      }
      if ((Array.isArray(vacations) ? vacations.length : 0) === 0) {
        const data = await loadDataKey('vacations');
        if (Array.isArray(data) && data.length) { setVacations(data); store.write('vacations', data); }
      }
      if ((Array.isArray(vacationPlans) ? vacationPlans.length : 0) === 0) {
        const data = await loadDataKey('vacation_plans');
        if (Array.isArray(data) && data.length) { setVacationPlans(data); store.write('vacation_plans', data); }
      }
      if ((Array.isArray(duties) ? duties.length : 0) === 0) {
        const data = await loadDataKey('duties');
        if (Array.isArray(data) && data.length) { setDuties(data); store.write('duties', data); }
      }
    })();
  }, []);
  React.useEffect(() => {
    const subs = [];
    const pushSub = (unsub) => { if (typeof unsub === 'function') subs.push(unsub); };
    firebaseService.applyingRemote = true;
    pushSub(firebaseService.subscribe('hospitals', v => { if (Array.isArray(v)) { setHospitals(v); store.write('hospitals', v); } }));
    pushSub(firebaseService.subscribe('specialties', v => { if (Array.isArray(v)) { setSpecialties(v); store.write('specialties', v); } }));
    pushSub(firebaseService.subscribe('departments', v => { if (Array.isArray(v)) { setDepartments(v); store.write('departments', v); } }));
    pushSub(firebaseService.subscribe('doctors', v => { if (Array.isArray(v)) { setDoctors(v); store.write('doctors', v); } }));
    pushSub(firebaseService.subscribe('shifts', v => { if (Array.isArray(v)) { setShifts(v); store.write('shifts', v); } }));
    pushSub(firebaseService.subscribe('vacations', v => { if (Array.isArray(v)) { setVacations(v); store.write('vacations', v); } }));
    pushSub(firebaseService.subscribe('vacation_plans', v => { if (Array.isArray(v)) { setVacationPlans(v); store.write('vacation_plans', v); } }));
    pushSub(firebaseService.subscribe('duties', v => { if (Array.isArray(v)) { setDuties(v); store.write('duties', v); } }));
    firebaseService.applyingRemote = false;
    return () => { subs.forEach(fn => { try { fn(); } catch {} }); };
  }, []);
  
  return (
      <Router route={route} setRoute={setRoute}>
        {route === '#/' && <HomePage />}
        {(route === '#/admin' || route === '#/data-entry') && <AdminPage hospitals={hospitals} setHospitals={setHospitals} specialties={specialties} setSpecialties={setSpecialties} departments={departments} setDepartments={setDepartments} shifts={shifts} setShifts={setShifts} doctors={doctors} setDoctors={setDoctors} />}
        {/^#\/assign\/(\d+)$/.test(route) && (
          <DepartmentAssignPage
            departmentId={Number((route.match(/^#\/assign\/(\d+)$/) || [])[1])}
            departments={departments}
            setDepartments={setDepartments}
            doctors={doctors}
            hospitals={hospitals}
            setDoctors={setDoctors}
          />
        )}
        {/^#\/hospital\/(\d+)$/.test(route) && (
          <HospitalPage
            hospitalId={Number((route.match(/^#\/hospital\/(\d+)$/) || [])[1])}
            hospitals={hospitals}
            departments={departments}
            doctors={doctors}
            setDoctors={setDoctors}
            specialties={specialties}
          />
        )}
        {route === '#/operations' && <OperationsPage hospitals={hospitals} departments={departments} doctors={doctors} shifts={shifts} vacations={vacations} setVacations={setVacations} vacationPlans={vacationPlans} setVacationPlans={setVacationPlans} duties={duties} setDuties={setDuties} />}
        {/^#\/dashboard(\/.*)?$/.test(route) && <DashboardPage hospitals={hospitals} departments={departments} doctors={doctors} specialties={specialties} vacations={vacations} duties={duties} shifts={shifts} />}
        {route === '#/diagnostics' && <DiagnosticsPage hospitals={hospitals} departments={departments} doctors={doctors} specialties={specialties} vacations={vacations} duties={duties} shifts={shifts} />}
      </Router>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
