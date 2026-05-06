import { initPage, showToast } from '/src/app/shared.js';

const KEY = 'osts-pet-log-v2';
const TOTAL_PETS = 68;
const $ = id => document.getElementById(id);
let editingId = null;
let clogImage = '';
let activeFilter = 'all';
let currentDropType = 'kc';

window.setDropType = function (type) {
    currentDropType = type;
    const kcBtn = $('drop-type-kc');
    const lvlBtn = $('drop-type-lvl');
    if (!kcBtn || !lvlBtn) return;
    if (type === 'kc') {
        kcBtn.style.background = 'var(--gold)'; kcBtn.style.color = '#000';
        lvlBtn.style.background = 'var(--surface2)'; lvlBtn.style.color = 'var(--muted)';
        $('pet-kc').placeholder = 'e.g. 128 KC';
    } else {
        lvlBtn.style.background = 'var(--gold)'; lvlBtn.style.color = '#000';
        kcBtn.style.background = 'var(--surface2)'; kcBtn.style.color = 'var(--muted)';
        $('pet-kc').placeholder = 'e.g. Level 75';
    }
};

const PET_DB = {
    Boss: [{ n: "Abyssal orphan", s: "Abyssal Sire", i: "https://oldschool.runescape.wiki/images/Abyssal_orphan.png" }, { n: "Baby mole", s: "Giant Mole", i: "https://oldschool.runescape.wiki/images/Baby_mole.png" }, { n: "Baron", s: "Duke Sucellus", i: "https://oldschool.runescape.wiki/images/Baron.png" }, { n: "Bran", s: "Royal Titans", i: "https://oldschool.runescape.wiki/images/Bran.png" }, { n: "Beef", s: "Brutus", i: "https://oldschool.runescape.wiki/images/Beef.png" }, { n: "Butch", s: "Vardorvis", i: "https://oldschool.runescape.wiki/images/Butch.png" }, { n: "Callisto cub", s: "Callisto", i: "https://oldschool.runescape.wiki/images/Callisto_cub.png" }, { n: "Dom", s: "Doom of Mokhaiotl", i: "https://oldschool.runescape.wiki/images/Dom.png" }, { n: "Gull", s: "Shellbane Gryphon", i: "https://oldschool.runescape.wiki/images/Gull.png" }, { n: "Hellpuppy", s: "Cerberus", i: "https://oldschool.runescape.wiki/images/Hellpuppy.png" }, { n: "Huberte", s: "The Hueycoatl", i: "https://oldschool.runescape.wiki/images/Huberte.png" }, { n: "Ikkle hydra", s: "Alchemical Hydra", i: "https://oldschool.runescape.wiki/images/Ikkle_hydra.png" }, { n: "Jal-nib-rek", s: "TzKal-Zuk", i: "https://oldschool.runescape.wiki/images/Jal-nib-rek.png" }, { n: "Kalphite princess", s: "Kalphite Queen", i: "https://oldschool.runescape.wiki/images/Kalphite_princess.png" }, { n: "Lil' zik", s: "Theatre of Blood", i: "https://oldschool.runescape.wiki/images/Lil%27_zik.png" }, { n: "Lil'viathan", s: "The Leviathan", i: "https://oldschool.runescape.wiki/images/Lil%27viathan.png" }, { n: "Little nightmare", s: "Nightmare", i: "https://oldschool.runescape.wiki/images/Little_nightmare.png" }, { n: "Moxi", s: "Amoxliatl", i: "https://oldschool.runescape.wiki/images/Moxi.png" }, { n: "Muphin", s: "Phantom Muspah", i: "https://oldschool.runescape.wiki/images/Muphin.png" }, { n: "Nexling", s: "Nex", i: "https://oldschool.runescape.wiki/images/Nexling.png" }, { n: "Nid", s: "Araxxor", i: "https://oldschool.runescape.wiki/images/Nid.png" }, { n: "Noon", s: "Grotesque Guardians", i: "https://oldschool.runescape.wiki/images/Noon.png" }, { n: "Olmlet", s: "Chambers of Xeric", i: "https://oldschool.runescape.wiki/images/Olmlet.png" }, { n: "Pet chaos elemental", s: "Chaos Elemental", i: "https://oldschool.runescape.wiki/images/Pet_chaos_elemental.png" }, { n: "Pet dagannoth prime", s: "Dagannoth Prime", i: "https://oldschool.runescape.wiki/images/Pet_dagannoth_prime.png" }, { n: "Pet dagannoth rex", s: "Dagannoth Rex", i: "https://oldschool.runescape.wiki/images/Pet_dagannoth_rex.png" }, { n: "Pet dagannoth supreme", s: "Dagannoth Supreme", i: "https://oldschool.runescape.wiki/images/Pet_dagannoth_supreme.png" }, { n: "Pet dark core", s: "Corporeal Beast", i: "https://oldschool.runescape.wiki/images/Pet_dark_core.png" }, { n: "Pet general graardor", s: "General Graardor", i: "https://oldschool.runescape.wiki/images/Pet_general_graardor.png" }, { n: "Pet k'ril tsutsaroth", s: "K'ril Tsutsaroth", i: "https://oldschool.runescape.wiki/images/Pet_k%27ril_tsutsaroth.png" }, { n: "Pet kraken", s: "Kraken", i: "https://oldschool.runescape.wiki/images/Pet_kraken.png" }, { n: "Pet kree'arra", s: "Kree'arra", i: "https://oldschool.runescape.wiki/images/Pet_kree%27arra.png" }, { n: "Pet smoke devil", s: "Thermonuclear smoke devil", i: "https://oldschool.runescape.wiki/images/Pet_smoke_devil.png" }, { n: "Pet snakeling", s: "Zulrah", i: "https://oldschool.runescape.wiki/images/Pet_snakeling.png" }, { n: "Pet zilyana", s: "Commander Zilyana", i: "https://oldschool.runescape.wiki/images/Pet_zilyana.png" }, { n: "Phoenix", s: "Wintertodt", i: "https://oldschool.runescape.wiki/images/Phoenix.png" }, { n: "Prince black dragon", s: "King Black Dragon", i: "https://oldschool.runescape.wiki/images/Prince_black_dragon.png" }, { n: "Scorpia's offspring", s: "Scorpia", i: "https://oldschool.runescape.wiki/images/Scorpia%27s_offspring.png" }, { n: "Scurry", s: "Scurrius", i: "https://oldschool.runescape.wiki/images/Scurry.png" }, { n: "Skotos", s: "Skotizo", i: "https://oldschool.runescape.wiki/images/Skotos.png" }, { n: "Smolcano", s: "Zalcano", i: "https://oldschool.runescape.wiki/images/Smolcano.png" }, { n: "Smol heredit", s: "Sol Heredit", i: "https://oldschool.runescape.wiki/images/Smol_heredit.png" }, { n: "Sraracha", s: "Sarachnis", i: "https://oldschool.runescape.wiki/images/Sraracha.png" }, { n: "Tiny tempor", s: "Tempoross", i: "https://oldschool.runescape.wiki/images/Tiny_tempor.png" }, { n: "Tumeken's guardian", s: "Tombs of Amascut", i: "https://oldschool.runescape.wiki/images/Tumeken%27s_guardian.png" }, { n: "Tzrek-jad", s: "TzTok-Jad", i: "https://oldschool.runescape.wiki/images/Tzrek-jad.png" }, { n: "Venenatis spiderling", s: "Venenatis", i: "https://oldschool.runescape.wiki/images/Venenatis_spiderling.png" }, { n: "Vet'ion jr.", s: "Vet'ion", i: "https://oldschool.runescape.wiki/images/Vet%27ion_jr..png" }, { n: "Vorki", s: "Vorkath", i: "https://oldschool.runescape.wiki/images/Vorki.png" }, { n: "Wisp", s: "The Whisperer", i: "https://oldschool.runescape.wiki/images/Wisp.png" }, { n: "Yami", s: "Yama", i: "https://oldschool.runescape.wiki/images/Yami.png" }, { n: "Youngllef", s: "Corrupted Gauntlet", i: "https://oldschool.runescape.wiki/images/Youngllef.png" }],
    Skilling: [{ n: "Baby chinchompa", s: "Hunter", i: "https://oldschool.runescape.wiki/images/Baby_chinchompa.png" }, { n: "Beaver", s: "Woodcutting", i: "https://oldschool.runescape.wiki/images/Beaver.png" }, { n: "Giant squirrel", s: "Agility", i: "https://oldschool.runescape.wiki/images/Giant_squirrel.png" }, { n: "Heron", s: "Fishing", i: "https://oldschool.runescape.wiki/images/Heron.png" }, { n: "Rift guardian", s: "Runecraft", i: "https://oldschool.runescape.wiki/images/Rift_guardian.png" }, { n: "Rock golem", s: "Mining", i: "https://oldschool.runescape.wiki/images/Rock_golem.png" }, { n: "Rocky", s: "Thieving", i: "https://oldschool.runescape.wiki/images/Rocky.png" }, { n: "Soup", s: "Sailing", i: "https://oldschool.runescape.wiki/images/Soup.png" }, { n: "Tangleroot", s: "Farming", i: "https://oldschool.runescape.wiki/images/Tangleroot.png" }],
    Other: [{ n: "Abyssal protector", s: "Guardians of the Rift", i: "https://oldschool.runescape.wiki/images/Abyssal_protector.png" }, { n: "Bloodhound", s: "Clue Scrolls (Master)", i: "https://oldschool.runescape.wiki/images/Bloodhound.png" }, { n: "Chompy chick", s: "Chompy bird hunting", i: "https://oldschool.runescape.wiki/images/Chompy_chick.png" }, { n: "Herbi", s: "Herbiboar", i: "https://oldschool.runescape.wiki/images/Herbi.png" }, { n: "Lil' creator", s: "Soul Wars", i: "https://oldschool.runescape.wiki/images/Lil%27_creator.png" }, { n: "Pet penance queen", s: "Barbarian Assault", i: "https://oldschool.runescape.wiki/images/Pet_penance_queen.png" }, { n: "Quetzin", s: "Hunter's Guild Rumours", i: "https://oldschool.runescape.wiki/images/Quetzin.png" }]
};

function getPets() { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
function savePetsToStorage(pets) { localStorage.setItem(KEY, JSON.stringify(pets)); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function getPetData(petName) {
    for (const cat in PET_DB) {
        const found = PET_DB[cat].find(p => p.n === petName);
        if (found) return { category: cat, name: found.n, source: found.s, image: found.i };
    }
    return null;
}

window.populatePets = function populatePets(category) {
    const sel = $('pet-select');
    const container = $('pet-select-container');
    if (!category) {
        sel.innerHTML = '<option value="">Choose a pet...</option>';
        container.style.display = 'none';
        return;
    }
    const pets = PET_DB[category] || [];
    sel.innerHTML = '<option value="">Choose a pet...</option>' + pets.map(p => `<option value="${p.n}">${p.n}</option>`).join('');
    container.style.display = 'block';
}

window.handleImageUpload = function handleImageUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
            // Compress to max 600px wide JPEG to keep localStorage usage low
            const MAX = 600;
            const scale = Math.min(1, MAX / img.width);
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            clogImage = canvas.toDataURL('image/jpeg', 0.75);
            $('pet-clog-preview').src = clogImage;
            $('pet-clog-preview').style.display = 'block';
            $('pet-clog-placeholder').style.display = 'none';
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
}

function renderStats() {
    const pets = getPets();
    const total = pets.length;
    const unique = new Set(pets.map(p => p.petName)).size;
    const totalKC = pets.reduce((s, p) => s + (Number(p.kc) || 0), 0);
    const avgKC = total ? Math.round(totalKC / total) : 0;
    const completion = Math.round(unique / TOTAL_PETS * 100);

    const luckiest = pets.reduce((min, p) => {
        const v = Number(p.kc) || 0;
        return (v > 0 && v < min) ? v : min;
    }, Infinity);
    $('pl-total-pets').textContent = total;
    $('pl-total-unique').textContent = unique;
    $('pl-total-kc').textContent = total ? (totalKC / total).toFixed(0) : '—';
    $('pl-avg-kc').textContent = luckiest < Infinity ? luckiest.toLocaleString() : '-';
    $('pl-completion').textContent = completion + '%';
}

function renderFilters() {
    const filters = [{ label: 'All', value: 'all' }, ...Object.keys(PET_DB).map(c => ({ label: c, value: c }))];
    $('pl-filters').innerHTML = filters.map(f =>
        `<button class="filter-chip ${f.value === 'all' ? 'active' : ''}" onclick="setFilter('${f.value}')">${f.label}</button>`
    ).join('');
}

window.setFilter = function (filter) {
    activeFilter = filter;
    document.querySelectorAll('.filter-chip').forEach(x => x.classList.remove('active'));
    event.target.classList.add('active');
    applyFilter();
};

function applyFilter() {
    document.querySelectorAll('.pet-card').forEach(card => {
        const cardCategory = card.dataset.category;
        card.style.display = (activeFilter === 'all' || activeFilter === cardCategory) ? 'block' : 'none';
    });
}

function renderPets() {
    const pets = getPets();
    const grid = $('pl-grid');
    const empty = $('pl-empty');

    if (!pets.length) {
        grid.innerHTML = '';
        grid.style.display = 'none';
        empty.style.display = 'block';
        return;
    }

    grid.style.display = 'grid';
    empty.style.display = 'none';

    grid.innerHTML = pets.map(p => {
        const petData = getPetData(p.petName);
        const petImg = petData ? petData.image : '';
        const petBadge = petImg ? `<div class="pet-clog-badge"><img src="${petImg}" alt="${p.petName}"></div>` : '';

        return `<div class="pet-card" data-id="${p.id}" data-category="${p.category}" onclick="openPetModal('${p.id}')">
          <div class="pet-img-wrap">
            ${petImg
                ? `<img class="pet-img" src="${petImg}" alt="${p.petName}" loading="lazy">`
                : `<span style="color:var(--muted);font-size:28px;">🐾</span>`}
          </div>
          <div class="pet-info">
            <div class="pet-name">${p.petName}</div>
          </div>
        </div>`;
    }).join('');

    applyFilter();
}

// VIEW mode — show pet details with CLOG image
window.openPetModal = function (id) {
    if (id) {
        // Show view panel for existing pets
        const p = getPets().find(x => x.id === id);
        if (!p) return;
        editingId = id;
        const petData = getPetData(p.petName);

        $('pv-name').textContent = p.petName;
        $('pv-source').textContent = p.source || '';
        $('pv-category').textContent = p.category || '';
        const dropLabel = (p.dropType === 'lvl') ? 'Level at drop' : 'KC at drop';
        document.querySelector('#pv-kc')?.closest('.pet-detail-row')?.querySelector('.k')?.textContent !== undefined && (document.querySelector('.pet-detail-row .k') ? null : null);
        $('pv-kc').textContent = p.kc ? Number(p.kc).toLocaleString() : '—';
        $('pv-kc-label').textContent = dropLabel;
        $('pv-date').textContent = p.dateObtained || '—';

        // Pet icon
        if (petData?.image) {
            $('pv-icon').src = petData.image;
            $('pv-icon').style.display = 'block';
        } else {
            $('pv-icon').style.display = 'none';
        }

        // CLOG image
        const imgWrap = $('pv-img-wrap');
        const storedImg = p.clogImage || '';
        if (storedImg && storedImg.length > 10) {
            imgWrap.innerHTML = `
            <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Collection Log Screenshot</div>
            <img class="pet-view-img" src="${storedImg}" alt="Collection Log">`;
        } else {
            imgWrap.innerHTML = `
            <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Collection Log Screenshot</div>
            <div class="pet-view-img-placeholder"><span>📷</span><span>No screenshot uploaded</span></div>`;
        }

        // Notes
        if (p.notes) {
            $('pv-notes').textContent = p.notes;
            $('pv-notes').style.display = 'block';
        } else {
            $('pv-notes').style.display = 'none';
        }

        $('pet-view-overlay').classList.add('show');
    } else {
        // ADD mode — show creation form
        openEditForm(null);
    }
};

function openEditForm(id) {
    editingId = id || null;
    $('pet-form').reset();
    clogImage = '';
    $('pet-clog-preview').style.display = 'none';
    $('pet-clog-placeholder').style.display = 'flex';
    $('pet-modal-title').textContent = id ? 'Edit Pet' : 'Add Pet';
    $('pet-delete-btn').style.display = id ? 'block' : 'none';
    $('pet-select-container').style.display = 'none';
    $('pet-category-select').disabled = false;
    $('pet-select').disabled = false;

    if (id) {
        const p = getPets().find(x => x.id === id);
        if (!p) return;
        $('pet-category-select').value = p.category || '';
        populatePets(p.category);
        $('pet-select').value = p.petName || '';
        $('pet-kc').value = p.kc || '';
        setDropType(p.dropType || (p.category === 'Skilling' ? 'lvl' : 'kc'));
        $('pet-date').value = p.dateObtained || '';
        $('pet-notes').value = p.notes || '';
        if (p.clogImage) {
            clogImage = p.clogImage;
            $('pet-clog-preview').src = clogImage;
            $('pet-clog-preview').style.display = 'block';
            $('pet-clog-placeholder').style.display = 'none';
        }
    }

    $('pet-modal-overlay').classList.add('show');
}

function closeModal() {
    $('pet-modal-overlay').classList.remove('show');
    editingId = null;
    clogImage = '';
}

window.savePet = function (e) {
    if (e) e.preventDefault();

    const petName = $('pet-select').value;
    if (!petName) {
        showToast('Please select a pet');
        return false;
    }

    const petData = getPetData(petName);
    if (!petData) {
        showToast('Pet data not found');
        return false;
    }

    const pet = {
        id: editingId || genId(),
        petName: petName,
        category: petData.category,
        source: petData.source,
        clogImage: clogImage,
        dateObtained: $('pet-date').value,
        kc: Number($('pet-kc').value) || 0,
        notes: $('pet-notes').value.trim(),
        updatedAt: new Date().toISOString()
    };

    const pets = getPets();
    const i = pets.findIndex(x => x.id === pet.id);
    if (i > -1) pets[i] = pet;
    else pets.unshift(pet);

    savePetsToStorage(pets);
    renderPets();
    renderStats();
    closeModal();
    $('pet-view-overlay').classList.remove('show');
    showToast(editingId ? 'Pet updated!' : 'Pet added!');

    return false;
};

let _deleteConfirming = false;
let _deleteTimer = null;
window.deletePet = function () {
    if (!editingId) return false;
    const btn = $('pet-delete-btn');
    if (!_deleteConfirming) {
        _deleteConfirming = true;
        btn.textContent = 'Confirm?';
        btn.style.background = 'var(--red)';
        btn.style.borderColor = 'var(--red)';
        btn.style.color = '#fff';
        _deleteTimer = setTimeout(() => {
            _deleteConfirming = false;
            btn.textContent = 'Delete';
            btn.style.background = '';
            btn.style.borderColor = '';
            btn.style.color = '';
        }, 3000);
        return false;
    }
    clearTimeout(_deleteTimer);
    _deleteConfirming = false;
    const pets = getPets().filter(x => x.id !== editingId);
    savePetsToStorage(pets);
    renderPets();
    renderStats();
    closeModal();
    showToast('Pet deleted');
    return false;
};

// Initialize
initPage('more');

renderFilters();
renderPets();
renderStats();

// Event listeners
$('pv-close-btn').addEventListener('click', () => {
    $('pet-view-overlay').classList.remove('show');
    editingId = null;
});
$('pv-edit-btn').addEventListener('click', () => {
    $('pet-view-overlay').classList.remove('show');
    openEditForm(editingId);
});
$('pet-view-overlay').addEventListener('click', e => {
    if (e.target === $('pet-view-overlay')) {
        $('pet-view-overlay').classList.remove('show');
        editingId = null;
    }
});
$('fab-add-pet').addEventListener('click', () => openPetModal());
$('pl-add-first')?.addEventListener('click', () => openPetModal());
$('pet-modal-close').addEventListener('click', closeModal);
$('pet-cancel').addEventListener('click', closeModal);
$('pet-modal-overlay').addEventListener('click', (e) => {
    if (e.target === $('pet-modal-overlay')) closeModal();
});