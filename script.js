const searchInput = document.getElementById('searchInput');
const accreditationFilter = document.getElementById('accreditationFilter');
const sortSelect = document.getElementById('sortSelect');
const journalList = document.getElementById('journalList');
const journalTableWrap = document.getElementById('journalTableWrap');
const journalTableBody = document.getElementById('journalTableBody');
const pageSizeSelect = document.getElementById('pageSizeSelect');
const pageMeta = document.getElementById('pageMeta');
const pagination = document.getElementById('pagination');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const cardViewBtn = document.getElementById('cardViewBtn');
const tableViewBtn = document.getElementById('tableViewBtn');
const emptyState = document.getElementById('emptyState');
const totalCount = document.getElementById('totalCount');
const nationalCount = document.getElementById('nationalCount');
const internationalCount = document.getElementById('internationalCount');
const totalStatBtn = document.getElementById('totalStatBtn');
const nationalStatBtn = document.getElementById('nationalStatBtn');
const internationalStatBtn = document.getElementById('internationalStatBtn');
const scopeLabel = document.getElementById('scopeLabel');

let journals = [];
let filteredJournals = [];
let currentPage = 1;
let currentView = 'card';
let pageSize = pageSizeSelect.value === 'all' ? Number.POSITIVE_INFINITY : Number(pageSizeSelect.value);
let heroScope = 'all';
let userSelectedView = false;
const mobileViewMedia = window.matchMedia('(max-width: 767px)');
const ratingStorageKey = 'journalRatings-v1';
let journalRatings = {};

function loadRatings() {
    try {
        const saved = localStorage.getItem(ratingStorageKey);
        journalRatings = saved ? JSON.parse(saved) : {};
    } catch (error) {
        journalRatings = {};
    }
}

function saveRatings() {
    try {
        localStorage.setItem(ratingStorageKey, JSON.stringify(journalRatings));
    } catch (error) {
        console.error('Failed to save ratings:', error);
    }
}

function getJournalRating(item) {
    const savedRating = journalRatings[item.journal];
    if (typeof savedRating === 'number') {
        return savedRating;
    }
    return item.baseRating;
}

function setJournalRating(item, ratingValue) {
    journalRatings[item.journal] = ratingValue;
    saveRatings();

    if (sortSelect.value === 'rating-asc' || sortSelect.value === 'rating-desc') {
        filterAndSort();
        return;
    }

    renderPage();
}

function syncViewButtons() {
    cardViewBtn.classList.toggle('is-active', currentView === 'card');
    tableViewBtn.classList.toggle('is-active', currentView === 'table');
}

function extractLink(linkHtml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(linkHtml, 'text/html');
    const anchor = doc.querySelector('a');

    if (!anchor) {
        return { href: '#', text: 'Visit Journal' };
    }

    return {
        href: anchor.getAttribute('href') || '#',
        text: anchor.textContent.trim() || 'Visit Journal',
    };
}

function parseApcValue(apc) {
    const match = apc.replace(/,/g, '').match(/[0-9]+(?:\.[0-9]+)?/);
    return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
}

function parseRatingValue(value) {
    const numeric = Number(value);
    if (Number.isNaN(numeric) || numeric < 0) {
        return 0;
    }
    if (numeric > 5) {
        return 5;
    }
    return Math.round(numeric);
}

function accreditationColorClass(accreditation) {
    const a = (accreditation || '').toLowerCase().trim();
    if (a === 'sinta 1') return 'accr-sinta-1';
    if (a === 'sinta 2') return 'accr-sinta-2';
    if (a === 'sinta 3') return 'accr-sinta-3';
    if (a === 'sinta 4') return 'accr-sinta-4';
    if (a === 'sinta 5') return 'accr-sinta-5';
    if (a === 'sinta 6') return 'accr-sinta-6';
    if (/scopus.*q1|q1.*scopus/.test(a)) return 'accr-q1';
    if (/scopus.*q2|q2.*scopus/.test(a)) return 'accr-q2';
    if (/scopus.*q3|q3.*scopus/.test(a)) return 'accr-q3';
    if (/scopus.*q4|q4.*scopus/.test(a)) return 'accr-q4';
    return 'accr-default';
}

function isNationalJournal(item) {
    return /sinta/i.test(item.accreditation);
}

function isInternationalJournal(item) {
    return /scopus/i.test(item.accreditation);
}

function normalizeRows(rows) {
    return rows.map((row) => {
        const link = extractLink(row[4]);
        return {
            journal: row[0],
            frequency: row[1],
            accreditation: row[2],
            accreditationExp: row[3],
            link,
            apc: row[5],
            apcValue: parseApcValue(row[5]),
            cover: row[6] || null,
            baseRating: parseRatingValue(row[7] || 0),
        };
    });
}

function createRatingControl(item) {
    const wrapper = document.createElement('div');
    wrapper.className = 'rating';

    const stars = document.createElement('div');
    stars.className = 'rating-stars';
    stars.setAttribute('role', 'group');
    stars.setAttribute('aria-label', `Rate ${item.journal}`);

    const activeRating = getJournalRating(item);

    for (let i = 1; i <= 5; i += 1) {
        const starButton = document.createElement('button');
        starButton.type = 'button';
        starButton.className = 'rating-star';
        starButton.setAttribute('aria-label', `Set ${item.journal} rating to ${i}`);
        starButton.innerHTML = i <= activeRating ? '&#9733;' : '&#9734;';
        starButton.addEventListener('click', () => {
            setJournalRating(item, i);
        });
        stars.appendChild(starButton);
    }

    const text = document.createElement('p');
    text.className = 'rating-text';
    text.textContent = `${activeRating}/5`;

    wrapper.append(stars, text);
    return wrapper;
}

function populateAccreditationFilter(items) {
    const uniqueAccreditations = [...new Set(items.map((item) => item.accreditation))].sort((a, b) => a.localeCompare(b));

    uniqueAccreditations.forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        accreditationFilter.appendChild(option);
    });
}

function updateHeroStats(items) {
    const nationalAccreditations = items.filter(isNationalJournal).length;
    const internationalAccreditations = items.filter(isInternationalJournal).length;

    totalCount.textContent = items.length;
    nationalCount.textContent = nationalAccreditations;
    internationalCount.textContent = internationalAccreditations;
}

function syncHeroScopeButtons() {
    totalStatBtn.classList.toggle('is-active', heroScope === 'all');
    nationalStatBtn.classList.toggle('is-active', heroScope === 'national');
    internationalStatBtn.classList.toggle('is-active', heroScope === 'international');

    totalStatBtn.setAttribute('aria-pressed', String(heroScope === 'all'));
    nationalStatBtn.setAttribute('aria-pressed', String(heroScope === 'national'));
    internationalStatBtn.setAttribute('aria-pressed', String(heroScope === 'international'));

    if (heroScope === 'national') {
        scopeLabel.textContent = 'Scope: National Journals (Sinta)';
    } else if (heroScope === 'international') {
        scopeLabel.textContent = 'Scope: International Journals (Scopus)';
    } else {
        scopeLabel.textContent = 'Scope: All Journals';
    }
}

function createCard(item) {
    const article = document.createElement('article');
    article.className = 'journal-card';

    const coverContainer = document.createElement('div');
    coverContainer.className = 'card-cover';

    const fallback = document.createElement('span');
    fallback.className = 'cover-fallback';
    fallback.textContent = 'No Cover';
    coverContainer.appendChild(fallback);

    if (item.cover) {
        const img = document.createElement('img');
        img.src = item.cover;
        img.alt = `${item.journal} cover`;
        img.loading = 'lazy';
        img.addEventListener('load', () => {
            fallback.hidden = true;
        });
        img.addEventListener('error', () => {
            coverContainer.classList.add('no-cover');
            img.remove();
        });
        coverContainer.appendChild(img);
    } else {
        coverContainer.classList.add('no-cover');
    }

    const content = document.createElement('div');
    content.className = 'card-content';

    const title = document.createElement('h2');
    title.textContent = item.journal;

    const meta = document.createElement('p');
    meta.className = 'meta';
    meta.textContent = item.frequency;

    const badges = document.createElement('div');
    badges.className = 'badges';

    const accreditationBadge = document.createElement('span');
    accreditationBadge.className = `badge accreditation ${accreditationColorClass(item.accreditation)}`;
    accreditationBadge.textContent = item.accreditation;

    const expBadge = document.createElement('span');
    expBadge.className = 'badge expiry';
    expBadge.textContent = item.accreditationExp;

    badges.append(accreditationBadge, expBadge);

    const footer = document.createElement('div');
    footer.className = 'card-footer';

    const apc = document.createElement('p');
    apc.className = 'apc';
    apc.innerHTML = `<span>APC</span> ${item.apc}`;

    const link = document.createElement('a');
    link.href = item.link.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = item.link.text;
    link.className = 'journal-link';

    const ratingControl = createRatingControl(item);

    footer.append(apc, link);
    content.append(title, meta, badges, ratingControl, footer);
    article.append(coverContainer, content);

    return article;
}

function createTableRow(item) {
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${item.journal}</td>
        <td>${item.frequency}</td>
        <td><span class="badge accreditation ${accreditationColorClass(item.accreditation)}">${item.accreditation}</span></td>
        <td>${item.accreditationExp}</td>
        <td>${item.apc}</td>
        <td class="table-rating-cell"></td>
        <td><a href="${item.link.href}" target="_blank" rel="noopener noreferrer">${item.link.text}</a></td>
    `;
    row.querySelector('.table-rating-cell').appendChild(createRatingControl(item));
    return row;
}

function setView(viewName) {
    currentView = viewName;
    syncViewButtons();
    renderPage();
}

function syncDefaultViewByViewport() {
    if (userSelectedView) {
        return;
    }

    const responsiveView = mobileViewMedia.matches ? 'table' : 'card';
    if (responsiveView !== currentView) {
        currentView = responsiveView;
        syncViewButtons();
        renderPage();
    }
}

function updatePagination(totalItems) {
    const showAllRows = !Number.isFinite(pageSize);
    const totalPages = showAllRows ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));
    currentPage = Math.min(currentPage, totalPages);
    pageMeta.textContent = showAllRows ? `Showing all ${totalItems} journals` : `Page ${currentPage} of ${totalPages}`;
    prevPageBtn.disabled = showAllRows || currentPage <= 1;
    nextPageBtn.disabled = showAllRows || currentPage >= totalPages;
    pagination.hidden = totalItems === 0;

    const pageButtonsContainer = document.getElementById('pageButtons');
    pageButtonsContainer.innerHTML = '';
    if (showAllRows) {
        return;
    }

    const maxVisibleButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisibleButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxVisibleButtons - 1);
    if (endPage - startPage + 1 < maxVisibleButtons) {
        startPage = Math.max(1, endPage - maxVisibleButtons + 1);
    }

    if (startPage > 1) {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'page-ellipsis';
        ellipsis.textContent = '...';
        pageButtonsContainer.appendChild(ellipsis);
    }

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'page-number';
        btn.textContent = i;
        if (i === currentPage) {
            btn.classList.add('is-active');
        }
        btn.addEventListener('click', () => {
            currentPage = i;
            updatePagination(totalItems);
            renderPage();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        pageButtonsContainer.appendChild(btn);
    }

    if (endPage < totalPages) {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'page-ellipsis';
        ellipsis.textContent = '...';
        pageButtonsContainer.appendChild(ellipsis);
    }
}

function renderPage() {
    const showAllRows = !Number.isFinite(pageSize);
    const start = showAllRows ? 0 : (currentPage - 1) * pageSize;
    const pageItems = showAllRows ? filteredJournals : filteredJournals.slice(start, start + pageSize);

    journalList.hidden = currentView !== 'card';
    journalTableWrap.hidden = currentView !== 'table';
    journalList.innerHTML = '';
    journalTableBody.innerHTML = '';

    if (pageItems.length === 0) {
        emptyState.hidden = false;
        pagination.hidden = true;
        return;
    }

    emptyState.hidden = true;

    if (currentView === 'card') {
        const cardFragment = document.createDocumentFragment();
        pageItems.forEach((item) => cardFragment.appendChild(createCard(item)));
        journalList.appendChild(cardFragment);
    } else {
        const rowFragment = document.createDocumentFragment();
        pageItems.forEach((item) => rowFragment.appendChild(createTableRow(item)));
        journalTableBody.appendChild(rowFragment);
    }
}

function filterAndSort() {
    const keyword = searchInput.value.trim().toLowerCase();
    const accreditation = accreditationFilter.value;
    const sort = sortSelect.value;

    let filtered = journals.filter((item) => {
        const byHeroScope =
            heroScope === 'all' ||
            (heroScope === 'national' && isNationalJournal(item)) ||
            (heroScope === 'international' && isInternationalJournal(item));
        const byAccreditation = accreditation === 'all' || item.accreditation === accreditation;
        const haystack = `${item.journal} ${item.frequency} ${item.accreditation} ${item.accreditationExp} ${item.link.text}`.toLowerCase();
        const byKeyword = keyword.length === 0 || haystack.includes(keyword);
        return byHeroScope && byAccreditation && byKeyword;
    });

    filtered = filtered.sort((a, b) => {
        if (sort === 'name-asc') {
            return a.journal.localeCompare(b.journal);
        }
        if (sort === 'name-desc') {
            return b.journal.localeCompare(a.journal);
        }
        if (sort === 'apc-asc') {
            return a.apcValue - b.apcValue;
        }
        if (sort === 'apc-desc') {
            return b.apcValue - a.apcValue;
        }
        if (sort === 'rating-asc') {
            return getJournalRating(a) - getJournalRating(b);
        }
        return getJournalRating(b) - getJournalRating(a);
    });

    filteredJournals = filtered;
    currentPage = 1;
    updatePagination(filteredJournals.length);
    renderPage();
}

async function initialize() {
    try {
        if (window.location.protocol === 'file:') {
            emptyState.hidden = false;
            emptyState.innerHTML = 'Local file mode blocks data loading in browsers. Start a local server and open <code>http://localhost:8000</code>. Example command: <code>python3 -m http.server 8000</code>.';
            pagination.hidden = true;
            return;
        }

        const response = await fetch('dataset.json');
        const result = await response.json();
        journals = normalizeRows(result.data || []);
        loadRatings();

        updateHeroStats(journals);
        populateAccreditationFilter(journals);
        currentView = mobileViewMedia.matches ? 'table' : 'card';
        syncViewButtons();
        filterAndSort();
    } catch (error) {
        emptyState.hidden = false;
        emptyState.textContent = 'Failed to load journal data. Please refresh the page.';
        console.error('Failed to load journals:', error);
    }
}

searchInput.addEventListener('input', filterAndSort);
accreditationFilter.addEventListener('change', filterAndSort);
sortSelect.addEventListener('change', filterAndSort);
pageSizeSelect.addEventListener('change', () => {
    pageSize = pageSizeSelect.value === 'all' ? Number.POSITIVE_INFINITY : Number(pageSizeSelect.value);
    currentPage = 1;
    updatePagination(filteredJournals.length);
    renderPage();
});

totalStatBtn.addEventListener('click', () => {
    heroScope = 'all';
    syncHeroScopeButtons();
    filterAndSort();
});

nationalStatBtn.addEventListener('click', () => {
    heroScope = 'national';
    syncHeroScopeButtons();
    filterAndSort();
});

internationalStatBtn.addEventListener('click', () => {
    heroScope = 'international';
    syncHeroScopeButtons();
    filterAndSort();
});

prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage -= 1;
        updatePagination(filteredJournals.length);
        renderPage();
    }
});

nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(filteredJournals.length / pageSize));
    if (currentPage < totalPages) {
        currentPage += 1;
        updatePagination(filteredJournals.length);
        renderPage();
    }
});

cardViewBtn.addEventListener('click', () => {
    userSelectedView = true;
    setView('card');
});
tableViewBtn.addEventListener('click', () => {
    userSelectedView = true;
    setView('table');
});

if (typeof mobileViewMedia.addEventListener === 'function') {
    mobileViewMedia.addEventListener('change', syncDefaultViewByViewport);
} else if (typeof mobileViewMedia.addListener === 'function') {
    mobileViewMedia.addListener(syncDefaultViewByViewport);
}

syncHeroScopeButtons();

initialize();
