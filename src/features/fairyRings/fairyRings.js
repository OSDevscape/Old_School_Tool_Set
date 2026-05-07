    import { initPage, storage, showToast } from '/src/app/shared.js';
    
    initPage('more');
    
    // ── Fairy ring data ──────────────────────────────────────────────────────────
    // [code, destination, region, wikiSlug]
    const RINGS = [
      // ── A ──
      ['AIQ', 'Mudskipper Point', 'Asgarnia'],
      ['AIR', 'South-east of Ardougne (empty island)', 'Islands'],
      ['AIS', 'Auburn Valley', 'Varlamore'],
      ['AJP', 'Avium Savannah', 'Varlamore'],
      ['AJQ', 'Cave south of Dorgesh-Kaan', 'Dungeons'],
      ['AJR', 'Slayer cave SE of Rellekka', 'Kandarin'],
      ['AJS', 'Penguins near Miscellania', 'Islands'],
      ['AKP', 'Necropolis', 'Kharidian Desert'],
      ['AKQ', 'Piscatoris Hunter area', 'Kandarin'],
      ['AKR', 'Hosidius Vinery', 'Great Kourend'],
      ['AKS', 'Feldip Hunter area', 'Feldip Hills'],
      ['ALP', 'Lighthouse', 'Islands'],
      ['ALQ', 'Haunted Woods east of Canifis', 'Morytania'],
      ['ALR', 'Abyssal Area', 'Other Realms'],
      ['ALS', "McGrubor's Wood", 'Kandarin'],
      // ── B ──
      ['BIP', 'South-west of Mort Myre (empty island)', 'Islands'],
      ['BIQ', 'Near Kalphite Hive', 'Kharidian Desert'],
      ['BIS', 'Ardougne Zoo', 'Kandarin'],
      ['BJP', 'Isle of Souls', 'Islands'],
      ['BJR', 'Realm of the Fisher King', 'Other Realms'],
      ['BJS', 'Near Zul-Andra', 'Islands'],
      ['BKP', 'Chompy Marsh, south of Castle Wars', 'Feldip Hills'],
      ['BKQ', 'Enchanted Valley', 'Other Realms'],
      ['BKR', 'Mort Myre Swamp, south of Canifis', 'Morytania'],
      ['BKS', 'Zanaris', 'Other Realms'],
      ['BLP', 'TzHaar area', 'Karamja'],
      ['BLQ', "Yu'biusk", 'Other Realms'],
      ['BLR', "Legends' Guild", 'Kandarin'],
      ['BLS', 'South of Mount Quidamortem', 'Kebos Lowlands'],
      // ── C ──
      ['CIP', 'Miscellania', 'Fremennik'],
      ['CIQ', 'North-west of Yanille', 'Kandarin'],
      ['CIR', 'South of Mount Karuulm', 'Kebos Lowlands'],
      ['CIS', 'Arceuus Library', 'Great Kourend'],
      ['CJQ', 'The Great Conch', 'Other Realms'],
      ['CJR', 'Sinclair Mansion (east)', 'Kandarin'],
      ['CKP', "Cosmic entity's plane", 'Other Realms'],
      ['CKQ', 'Aldarin', 'Varlamore'],
      ['CKR', 'South of Tai Bwo Wannai Village', 'Karamja'],
      ['CKS', 'Canifis', 'Morytania'],
      ['CLP', 'Draynor island', 'Islands'],
      ['CLR', 'Ape Atoll', 'Islands'],
      ['CLS', "Hazelmere's house", 'Islands'],
      // ── D ──
      ['DIP', 'Abyssal Nexus (Abyssal Sire)', 'Other Realms'],
      ['DIQ', 'Player-owned house (superior garden)', 'POH'],
      ['DIR', "Gorak's Plane", 'Other Realms'],
      ['DIS', "Wizards' Tower", 'Misthalin'],
      ['DJP', 'Tower of Life', 'Kandarin'],
      ['DJR', 'Chasm of Fire', 'Great Kourend'],
      ['DKP', 'Gnome glider, Karamja', 'Karamja'],
      ['DKR', 'Edgeville', 'Misthalin'],
      ['DKS', 'Polar Hunter area / Keldagrim entrance', 'Fremennik'],
      ['DLP', 'Grimstone Dungeon', 'Other Realms'],
      ['DLQ', 'North of Nardah', 'Kharidian Desert'],
      ['DLR', 'Poison Waste south of Isafdar', 'Tirannwn'],
      ['DLS', 'Myreque hideout under The Hollows', 'Morytania'],
    ];
    
    // Region → accent colour
    const REGION_COLORS = {
      'Asgarnia': '#c0a060',
      'Dungeons': '#7f8c8d',
      'Feldip Hills': '#e74c3c',
      'Fremennik': '#3498db',
      'Great Kourend': '#8e44ad',
      'Islands': '#1abc9c',
      'Karamja': '#27ae60',
      'Kandarin': '#2980b9',
      'Kebos Lowlands': '#d35400',
      'Kharidian Desert': '#e67e22',
      'Misthalin': '#c5a028',
      'Morytania': '#9b59b6',
      'Other Realms': '#8e44ad',
      'POH': '#bdc3c7',
      'Tirannwn': '#16a085',
      'Varlamore': '#e91e63',
    };
    
    const NOTES_KEY = 'osts_fairy_notes_v1';
    const PINS_KEY = 'osts_fairy_pins_v1';
    
    // ── State ────────────────────────────────────────────────────────────────────
    let activeFilter = 'All';
    let searchQuery = '';
    let activeCode = null;
    let pins = storage.get(PINS_KEY, []);
    
    function savePins() { storage.set(PINS_KEY, pins); }
    
    function isPinned(code) { return pins.includes(code); }
    
    function togglePin(code) {
      pins = isPinned(code) ? pins.filter(p => p !== code) : [code, ...pins];
      savePins();
      render();
    }
    
    // ── Notes CRUD ───────────────────────────────────────────────────────────────
    function getNotes() { return storage.get(NOTES_KEY, {}); }
    
    function getNote(code) { return getNotes()[code] || ''; }
    
    function saveNote(code, text) {
      const n = getNotes();
      n[code] = text;
      storage.set(NOTES_KEY, n);
    }
    
    function deleteNote(code) {
      const n = getNotes();
      delete n[code];
      storage.set(NOTES_KEY, n);
    }
    
    function hasNote(code) { return !!getNote(code).trim(); }
    
    // ── Regions list ─────────────────────────────────────────────────────────────
    const ALL_REGIONS = ['All', ...new Set(RINGS.map(r => r[2])).values()].sort((a, b) => a === 'All' ? -1 : a.localeCompare(b));
    
    // ── Render filter chips ───────────────────────────────────────────────────────
    function renderFilters() {
      const wrap = document.getElementById('fr-filters');
      wrap.innerHTML = ALL_REGIONS.map(r =>
        `<button class="fr-filter${r === activeFilter ? ' active' : ''}" data-region="${r}">${r}</button>`
      ).join('');
      wrap.querySelectorAll('.fr-filter').forEach(btn => {
        btn.addEventListener('click', () => {
          activeFilter = btn.dataset.region;
          renderFilters();
          renderPinned();
          renderGrid();
        });
      });
    }
    
    // ── Card HTML builder ─────────────────────────────────────────────────────────
    function ringCardHtml(code, dest, region) {
      const color = REGION_COLORS[region] || 'var(--gold)';
      const noted = hasNote(code);
      const pinned = isPinned(code);
      const noteText = getNote(code);
      const notePreview = noteText.trim() ?
        `<div class="fr-note-preview">${noteText.trim().slice(0, 80)}${noteText.trim().length > 80 ? '…' : ''}</div>` :
        '';
      return `
  <div class="fr-card${noted ? ' has-note' : ''}${pinned ? ' is-pinned' : ''}" data-code="${code}" style="--fr-color:${color}">
    <button class="fr-pin-btn${pinned ? ' active' : ''}" data-pin="${code}" aria-label="Pin ${code}">📌</button>
    <button class="fr-note-btn${noted ? ' active' : ''}" data-note="${code}" aria-label="Note for ${code}">📝</button>
    <div class="fr-code">${code}</div>
    <div class="fr-dest">${dest}</div>
    <span class="fr-region">${region}</span>
    ${notePreview}
  </div>`;
    }
    
    // ── Bind card buttons ─────────────────────────────────────────────────────────
    function bindCardEvents(container) {
      container.querySelectorAll('[data-pin]').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          togglePin(btn.dataset.pin);
        });
      });
      container.querySelectorAll('[data-note]').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const ring = RINGS.find(r => r[0] === btn.dataset.note);
          if (ring) openNoteSheet(ring[0], ring[1], ring[2]);
        });
      });
    }
    
    // ── Main render ───────────────────────────────────────────────────────────────
    function render() {
      renderFilters();
      renderPinned();
      renderGrid();
    }
    
    // ── Render pinned section ─────────────────────────────────────────────────────
    function renderPinned() {
      const root = document.getElementById('fr-pinned');
      const validPins = pins.filter(code => RINGS.find(r => r[0] === code));
      
      if (!validPins.length) { root.innerHTML = ''; return; }
      
      root.innerHTML = `
    <div class="data-label">Pinned</div>
    <div class="fr-grid" style="margin-bottom:14px">
      ${validPins.map(code => {
        const ring = RINGS.find(r => r[0] === code);
        return ring ? ringCardHtml(ring[0], ring[1], ring[2]) : '';
      }).join('')}
    </div>`;
      
      bindCardEvents(root);
    }
    
    // ── Render all rings grid ─────────────────────────────────────────────────────
    function renderGrid() {
      const grid = document.getElementById('fr-grid');
      const q = searchQuery.toLowerCase();
      
      const filtered = RINGS.filter(([code, dest, region]) => {
        const matchFilter = activeFilter === 'All' || region === activeFilter;
        const matchSearch = !q || code.toLowerCase().includes(q) || dest.toLowerCase().includes(q) || region.toLowerCase().includes(q);
        return matchFilter && matchSearch;
      });
      
      document.getElementById('fr-count').textContent =
        filtered.length === RINGS.length ? `${RINGS.length} rings total` : `${filtered.length} of ${RINGS.length} rings`;
      
      if (!filtered.length) {
        grid.innerHTML = '<div class="fr-empty">No rings match your search.</div>';
        return;
      }
      
      grid.innerHTML = filtered.map(([code, dest, region]) => ringCardHtml(code, dest, region)).join('');
      bindCardEvents(grid);
    }
    
    // ── Note sheet ───────────────────────────────────────────────────────────────
    function openNoteSheet(code, dest, region) {
      activeCode = code;
      const color = REGION_COLORS[region] || 'var(--gold)';
      
      document.getElementById('note-code-badge').textContent = code;
      document.getElementById('note-code-badge').style.color = color;
      document.getElementById('note-dest').textContent = dest;
      document.getElementById('note-region').textContent = region;
      document.getElementById('note-textarea').value = getNote(code);
      document.getElementById('note-delete').disabled = !hasNote(code);
      
      document.getElementById('note-overlay').classList.add('show');
      requestAnimationFrame(() => document.getElementById('note-sheet').classList.add('show'));
      
      // Focus textarea after animation
      setTimeout(() => document.getElementById('note-textarea').focus(), 320);
    }
    
    function closeNoteSheet() {
      document.getElementById('note-sheet').classList.remove('show');
      document.getElementById('note-overlay').classList.remove('show');
      activeCode = null;
    }
    
    document.getElementById('note-close').addEventListener('click', closeNoteSheet);
    document.getElementById('note-overlay').addEventListener('click', closeNoteSheet);
    
    document.getElementById('note-save').addEventListener('click', () => {
      if (!activeCode) return;
      const text = document.getElementById('note-textarea').value.trim();
      if (text) {
        saveNote(activeCode, text);
        showToast('📝 Note saved');
      } else {
        deleteNote(activeCode);
        showToast('🗑 Note cleared');
      }
      closeNoteSheet();
      render();
    });
    
    document.getElementById('note-delete').addEventListener('click', () => {
      if (!activeCode) return;
      deleteNote(activeCode);
      showToast('🗑 Note deleted');
      closeNoteSheet();
      render();
    });
    
    // Enable delete button when textarea changes
    document.getElementById('note-textarea').addEventListener('input', () => {
      document.getElementById('note-delete').disabled = false;
    });
    
    // ── Drag to close note sheet ──────────────────────────────────────────────────
    (function makeDraggable() {
      const sheet = document.getElementById('note-sheet');
      const handle = document.getElementById('note-handle');
      const header = sheet.querySelector('.note-header');
      const dragZone = handle || header;
      
      let startY = 0,
        dragY = 0,
        active = false;
      
      dragZone.addEventListener('touchstart', e => {
        startY = e.touches[0].clientY;
        dragY = 0;
        active = true;
        sheet.style.transition = 'none';
      }, { passive: true });
      
      window.addEventListener('touchmove', e => {
        if (!active) return;
        dragY = Math.max(0, e.touches[0].clientY - startY);
        sheet.style.transform = `translateY(${dragY}px)`;
      }, { passive: true });
      
      window.addEventListener('touchend', () => {
        if (!active) return;
        active = false;
        sheet.style.transition = '';
        if (dragY > 100) {
          closeNoteSheet();
        } else {
          sheet.style.transform = 'translateY(0)';
        }
        dragY = 0;
      });
    })();
    
    // ── Search ───────────────────────────────────────────────────────────────────
    document.getElementById('fr-search').addEventListener('input', e => {
      searchQuery = e.target.value;
      renderPinned();
      renderGrid();
    });
    
    // ── Settings tools ────────────────────────────────────────────────────────────
    document.getElementById('clear-pins-btn').addEventListener('click', () => {
      pins = [];
      savePins();
      render();
      showToast('📌 All pins cleared');
    });
    
    // ── Boot ─────────────────────────────────────────────────────────────────────
    render();