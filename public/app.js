const verseRefEl = document.getElementById("verseRef");
const verseTextContainerEl = document.getElementById("verseTextContainer");
const crossRefsEl = document.getElementById("crossRefs");
const commentaryTextEl = document.getElementById("commentaryText");
const timelineListEl = document.getElementById("timelineList");
const originalLangEl = document.getElementById("originalLang");
const originalTextEl = document.getElementById("originalText");
const strongListEl = document.getElementById("strongList");
const modeGuidanceEl = document.getElementById("modeGuidance");
const unlockBtnEl = document.getElementById("unlockBtn");
const layerStackEl = document.getElementById("layerStack");
const relatedListEl = document.getElementById("relatedList");
const latticeSignalsEl = document.getElementById("latticeSignals");
const searchInputEl = document.getElementById("searchInput");

const globalSearchInputEl = document.getElementById("globalSearchInput");
const globalSearchBtnEl = document.getElementById("globalSearchBtn");
const globalSearchResultsEl = document.getElementById("globalSearchResults");
const contextualToolsEl = document.getElementById("contextualTools");

const modeSelectEl = document.getElementById("modeSelect");
const ribbonVersionEl = document.getElementById("ribbonVersion");
const ribbonCanonEl = document.getElementById("ribbonCanon");
const ribbonHistoryEl = document.getElementById("ribbonHistory");
const ribbonConcordanceEl = document.getElementById("ribbonConcordance");
const ribbonTimelineEl = document.getElementById("ribbonTimeline");

const bookExplorerResultsEl = document.getElementById("bookExplorerResults");
const canonTraditionSelectEl = document.getElementById("canonTraditionSelect");
const bookModeStandardBtnEl = document.getElementById("bookModeStandardBtn");
const bookModeCanonBtnEl = document.getElementById("bookModeCanonBtn");
const bookModeTimelineBtnEl = document.getElementById("bookModeTimelineBtn");
const trailsListEl = document.getElementById("trailsList");

const runPatternBtnEl = document.getElementById("runPatternBtn");
const patternScopeTypeEl = document.getElementById("patternScopeType");
const patternScopeRefEl = document.getElementById("patternScopeRef");
const patternFindingsEl = document.getElementById("patternFindings");
const livingWordInputEl = document.getElementById("livingWordInput");
const livingWordModeEl = document.getElementById("livingWordMode");
const livingWordCorrectionEl = document.getElementById("livingWordCorrection");
const livingWordContextGuardEl = document.getElementById("livingWordContextGuard");
const livingWordStrictCitationsEl = document.getElementById("livingWordStrictCitations");
const livingWordMinCitationsEl = document.getElementById("livingWordMinCitations");
const runLivingWordBtnEl = document.getElementById("runLivingWordBtn");
const livingWordVerseOnlyBtnEl = document.getElementById("livingWordVerseOnlyBtn");
const livingWordPatternBtnEl = document.getElementById("livingWordPatternBtn");
const livingWordBoundaryEl = document.getElementById("livingWordBoundary");
const livingWordOutputEl = document.getElementById("livingWordOutput");
const livingWordCitationsEl = document.getElementById("livingWordCitations");
const livingWordSupportListEl = document.getElementById("livingWordSupportList");

const parallelVersion1El = document.getElementById("parallelVersion1");
const parallelVersion2El = document.getElementById("parallelVersion2");
const parallelVersion3El = document.getElementById("parallelVersion3");
const parallelVersion4El = document.getElementById("parallelVersion4");
const loadParallelBtnEl = document.getElementById("loadParallelBtn");
const chapterParallelRefEl = document.getElementById("chapterParallelRef");
const loadChapterParallelBtnEl = document.getElementById("loadChapterParallelBtn");
const parallelGridEl = document.getElementById("parallelGrid");
const chapterParallelGridEl = document.getElementById("chapterParallelGrid");
const runCrossVersionBtnEl = document.getElementById("runCrossVersionBtn");
const crossVersionSummaryEl = document.getElementById("crossVersionSummary");
const crossVersionSharedEl = document.getElementById("crossVersionShared");
const crossVersionTextListEl = document.getElementById("crossVersionTextList");

const accordanceImportInputEl = document.getElementById("accordanceImportInput");
const accordanceFileInputEl = document.getElementById("accordanceFileInput");
const accordanceDropzoneEl = document.getElementById("accordanceDropzone");
const importAccordanceBtnEl = document.getElementById("importAccordanceBtn");
const refreshLibraryBtnEl = document.getElementById("refreshLibraryBtn");
const importModeSelectEl = document.getElementById("importModeSelect");
const accordanceStatusEl = document.getElementById("accordanceStatus");
const bibleListingsListEl = document.getElementById("bibleListingsList");
const packageModulesListEl = document.getElementById("packageModulesList");
const historicalResourcesListEl = document.getElementById("historicalResourcesList");

const refreshHistoryBtnEl = document.getElementById("refreshHistoryBtn");
const openHistoryListEl = document.getElementById("openHistoryList");

const noteTagsInputEl = document.getElementById("noteTagsInput");
const noteTextInputEl = document.getElementById("noteTextInput");
const saveNoteBtnEl = document.getElementById("saveNoteBtn");
const notesListEl = document.getElementById("notesList");
const hoverCardEl = document.getElementById("hoverCard");

let verses = [];
let selectedVerseId = null;
let selectedBookMode = "standard";

const hoverLexicon = {
  covenant: "Covenant: a binding relational framework between God and His people.",
  blood: "Blood: commonly linked to life, atonement, and covenant marking.",
  kingdom: "Kingdom: God's reign and redemptive rule across Scripture.",
  grace: "Grace: unmerited favor and transformative divine action.",
  shepherd: "Shepherd imagery: leadership, care, and covenant protection.",
  word: "Word/Logos: divine self-expression and revelation."
};

const guidedTrails = [
  "From Passover to Messiah",
  "The Temple Through Scripture",
  "The Kingdom Theme",
  "The Seed Promise",
  "Priesthood and Sacrifice",
  "Babylon Through the Bible",
  "Resurrection Pattern",
  "Women in Scripture",
  "Covenant Chain"
];

function clearChildren(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

function renderChips(container, values) {
  clearChildren(container);
  values.forEach((value) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = value;
    container.appendChild(chip);
  });
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

function versionSelectors() {
  return [parallelVersion1El, parallelVersion2El, parallelVersion3El, parallelVersion4El];
}

function selectedVersionCodes() {
  return versionSelectors().map((el) => el.value).filter(Boolean).slice(0, 4);
}

function selectedChapterRef() {
  const typed = chapterParallelRefEl.value.trim();
  if (typed) {
    return typed;
  }
  const verse = verses.find((item) => item.id === selectedVerseId);
  if (!verse) {
    return "Genesis:1";
  }
  const chapterAndBook = verse.reference.split(":")[0];
  const splitAt = chapterAndBook.lastIndexOf(" ");
  return `${chapterAndBook.slice(0, splitAt)}:${chapterAndBook.slice(splitAt + 1)}`;
}

function filteredVerses(query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    return verses;
  }
  return verses.filter((verse) => {
    return verse.reference.toLowerCase().includes(q) || verse.text.toLowerCase().includes(q);
  });
}

function renderVerseTokens(text) {
  clearChildren(verseTextContainerEl);
  const words = String(text || "").split(" ");
  words.forEach((word, index) => {
    const token = document.createElement("span");
    token.className = "hover-token";
    token.textContent = `${word}${index === words.length - 1 ? "" : " "}`;
    token.dataset.word = word.replace(/[^a-zA-Z]/g, "").toLowerCase();
    verseTextContainerEl.appendChild(token);
  });
}

function renderList(container, items, formatter, emptyText = "No data available.") {
  clearChildren(container);
  if (!items || items.length === 0) {
    const li = document.createElement("li");
    li.className = "pattern-item";
    li.textContent = emptyText;
    container.appendChild(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "pattern-item";
    li.innerHTML = formatter(item);
    container.appendChild(li);
  });
}

function defaultScopeRef(scopeType) {
  const verse = verses.find((item) => item.id === selectedVerseId);
  if (!verse) {
    return "";
  }

  if (scopeType === "verse") {
    return verse.id;
  }

  const chapterAndBook = verse.reference.split(":")[0];
  const splitAt = chapterAndBook.lastIndexOf(" ");
  const book = chapterAndBook.slice(0, splitAt);
  const chapter = chapterAndBook.slice(splitAt + 1);
  if (scopeType === "chapter") {
    return `${book}:${chapter}`;
  }
  if (scopeType === "book") {
    return book;
  }
  return "";
}

async function loadSystemCatalog() {
  const data = await fetchJson("/api/v1/system/catalog");

  clearChildren(modeSelectEl);
  data.studyModes.forEach((mode) => {
    const option = document.createElement("option");
    option.value = mode;
    option.textContent = mode;
    if (mode === "study") {
      option.selected = true;
    }
    modeSelectEl.appendChild(option);
  });

  clearChildren(ribbonCanonEl);
  clearChildren(canonTraditionSelectEl);
  data.canonTraditions.forEach((canon) => {
    const topOption = document.createElement("option");
    topOption.value = canon;
    topOption.textContent = canon;
    ribbonCanonEl.appendChild(topOption);

    const explorerOption = document.createElement("option");
    explorerOption.value = canon;
    explorerOption.textContent = canon;
    canonTraditionSelectEl.appendChild(explorerOption);
  });

  clearChildren(ribbonHistoryEl);
  data.historyLenses.forEach((lens) => {
    const option = document.createElement("option");
    option.value = lens;
    option.textContent = lens;
    ribbonHistoryEl.appendChild(option);
  });

  clearChildren(ribbonConcordanceEl);
  data.concordanceTypes.forEach((type) => {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type;
    ribbonConcordanceEl.appendChild(option);
  });

  clearChildren(ribbonTimelineEl);
  data.timelineTypes.forEach((type) => {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type;
    ribbonTimelineEl.appendChild(option);
  });
}

async function loadVersions() {
  const data = await fetchJson("/api/v1/versions");
  clearChildren(ribbonVersionEl);
  versionSelectors().forEach((el) => clearChildren(el));

  const defaults = ["KJV", "ASV", "WEB", "YLT"];
  data.versions.forEach((version) => {
    const headerOption = document.createElement("option");
    headerOption.value = version.code;
    headerOption.textContent = `${version.code} ${version.name}`;
    ribbonVersionEl.appendChild(headerOption);

    versionSelectors().forEach((selectEl, index) => {
      const option = document.createElement("option");
      option.value = version.code;
      option.textContent = `${version.code} ${version.name}`;
      if (defaults[index] === version.code) {
        option.selected = true;
      }
      selectEl.appendChild(option);
    });
  });
}

async function loadVerseList() {
  const data = await fetchJson("/api/v1/scripture");
  verses = data.verses;
  if (verses.length > 0) {
    await selectVerse(verses[0].id);
  }
}

async function loadBookExplorer() {
  const mode = selectedBookMode;
  const canonTradition = canonTraditionSelectEl.value || "protestant";
  const query = `mode=${encodeURIComponent(mode)}&canonTradition=${encodeURIComponent(canonTradition)}`;
  const data = await fetchJson(`/api/v1/books?${query}`);

  clearChildren(bookExplorerResultsEl);

  if (mode === "timeline") {
    Object.entries(data.groups || {}).forEach(([group, books]) => {
      const heading = document.createElement("h4");
      heading.textContent = group;
      bookExplorerResultsEl.appendChild(heading);
      books.forEach((book) => appendBookButton(book.book));
    });
    return;
  }

  if (mode === "canon") {
    (data.books || []).forEach((book) => appendBookButton(book.book));
    return;
  }

  Object.entries(data.groups || {}).forEach(([group, books]) => {
    const heading = document.createElement("h4");
    heading.textContent = group;
    bookExplorerResultsEl.appendChild(heading);
    books.forEach((book) => appendBookButton(book.book));
  });
}

function appendBookButton(bookName) {
  const button = document.createElement("button");
  button.className = "book-pill";
  button.textContent = bookName;
  button.addEventListener("click", () => {
    const found = verses.find((verse) => verse.reference.toLowerCase().startsWith(bookName.toLowerCase()));
    if (found) {
      selectVerse(found.id).catch(() => {});
    } else {
      modeGuidanceEl.textContent = `${bookName} selected. Add/import full text to read this book in detail.`;
    }
  });
  bookExplorerResultsEl.appendChild(button);
}

function renderGuidedTrails() {
  renderList(trailsListEl, guidedTrails, (item) => `<strong>${item}</strong>`);
}

async function selectVerse(verseId) {
  selectedVerseId = verseId;
  const data = await fetchJson(`/api/v1/scripture/${encodeURIComponent(verseId)}`);
  const verse = data.verse;

  verseRefEl.textContent = verse.reference;
  renderVerseTokens(verse.text);
  commentaryTextEl.textContent = verse.commentary;
  originalLangEl.textContent = `Language: ${verse.original.language}`;
  originalTextEl.textContent = verse.original.text;
  renderChips(crossRefsEl, verse.crossReferences || []);

  clearChildren(timelineListEl);
  (verse.contextTimeline || []).forEach((point) => {
    const li = document.createElement("li");
    li.textContent = point;
    timelineListEl.appendChild(li);
  });

  renderList(strongListEl, verse.original.strongs || [], (entry) => {
    return `<strong>${entry.number}</strong><br/>${entry.lemma} - ${entry.definition}`;
  });

  renderChips(latticeSignalsEl, [...verse.themes, ...verse.people, ...verse.events]);
  modeGuidanceEl.textContent = "Verse loaded. Use Unlock for layered study.";

  await Promise.all([
    loadContextRibbon(verse.id),
    loadParallelView(),
    loadChapterParallelView(),
    loadHistoricalResourcesForSelectedVerse()
  ]);
}

async function loadContextRibbon(verseId) {
  const data = await fetchJson(`/api/v1/context/ribbon/${encodeURIComponent(verseId)}`);
  renderChips(contextualToolsEl, data.tools || []);
}

async function unlockSelectedVerse() {
  if (!selectedVerseId) {
    return;
  }
  const data = await fetchJson("/api/v1/scripture/unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      verseId: selectedVerseId,
      mode: modeSelectEl.value,
      includeGraph: true
    })
  });

  modeGuidanceEl.textContent = data.modeGuidance;
  clearChildren(layerStackEl);

  [
    ["Literal", data.layers.literal, data.confidence.literal],
    ["Historical", data.layers.historical, data.confidence.historical],
    ["Prophetic", data.layers.prophetic, data.confidence.prophetic],
    ["Symbolic", data.layers.symbolic, data.confidence.symbolic]
  ].forEach(([label, text, confidence]) => {
    const card = document.createElement("article");
    card.className = "layer-card";
    card.innerHTML = `<h5>${label} (${Math.round(confidence * 100)}%)</h5><p>${text}</p>`;
    layerStackEl.appendChild(card);
  });

  renderList(relatedListEl, data.relatedVerses || [], (verse) => {
    return `<button type="button" class="book-pill" data-verse-id="${verse.id}"><strong>${verse.reference}</strong><br/>${verse.text}</button>`;
  });

  relatedListEl.querySelectorAll("button[data-verse-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectVerse(button.dataset.verseId).catch(() => {});
    });
  });
}

async function runPatternAnalysis() {
  const scopeType = patternScopeTypeEl.value;
  const scopeRef = patternScopeRefEl.value.trim() || defaultScopeRef(scopeType);
  const data = await fetchJson("/api/v1/patterns/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scopeType,
      scopeRef,
      patternTypes: ["phrase_repeat", "numeric", "chiastic", "parallel"]
    })
  });

  renderList(patternFindingsEl, data.findings || [], (item) => {
    return `<strong>${item.patternType}</strong><br/>${item.finding}<p class="meta">Evidence: ${(item.evidence || []).join(" | ")}</p>`;
  }, "No high-confidence patterns found for this scope.");
}

async function runLivingWordInterface(forcedMode) {
  const query = livingWordInputEl.value.trim();
  if (!query) {
    livingWordOutputEl.textContent = "Enter a question first.";
    return;
  }

  const responseMode = forcedMode || livingWordModeEl.value;
  const minSupportVerses = Math.max(2, Math.min(10, Number(livingWordMinCitationsEl.value) || 3));
  let data;
  try {
    data = await fetchJson("/api/v1/living-word/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        responseMode,
        correctionMode: Boolean(livingWordCorrectionEl.checked),
        minSupportVerses,
        contextGuard: Boolean(livingWordContextGuardEl.checked),
        strictCitationEnforcement: Boolean(livingWordStrictCitationsEl.checked)
      })
    });
  } catch (error) {
    livingWordBoundaryEl.textContent = "Strict mode can fail when not enough citations are found.";
    livingWordOutputEl.textContent = `Response blocked by strict citation enforcement (required minimum: ${minSupportVerses}).`;
    renderChips(livingWordCitationsEl, []);
    renderList(livingWordSupportListEl, [], () => "", "No support verses returned.");
    return;
  }

  livingWordBoundaryEl.textContent = data.designBoundary;
  livingWordOutputEl.textContent = data.responseText;
  renderChips(livingWordCitationsEl, data.citations || []);
  renderList(livingWordSupportListEl, data.supportVerses || [], (item) => {
    return `<strong>${item.reference}</strong><br/>${item.text}<p class="meta">themes: ${(item.themes || []).join(", ")}</p>`;
  }, "No support verses returned.");
}

async function loadParallelView() {
  if (!selectedVerseId) {
    return;
  }
  const versions = selectedVersionCodes();
  const query = encodeURIComponent(versions.join(","));
  const data = await fetchJson(`/api/v1/scripture/parallel/${encodeURIComponent(selectedVerseId)}?versions=${query}`);

  clearChildren(parallelGridEl);
  (data.panels || []).forEach((panel) => {
    const card = document.createElement("article");
    card.className = "parallel-card";
    card.innerHTML = `<h5>${panel.version} | ${panel.name}</h5><p>${panel.text}</p>`;
    parallelGridEl.appendChild(card);
  });
}

async function loadChapterParallelView() {
  const versions = selectedVersionCodes();
  const query = encodeURIComponent(versions.join(","));
  const chapterRef = encodeURIComponent(selectedChapterRef());
  const data = await fetchJson(`/api/v1/scripture/parallel-chapter?chapterRef=${chapterRef}&versions=${query}`);

  chapterParallelRefEl.value = data.chapterRef;
  clearChildren(chapterParallelGridEl);

  (data.panels || []).forEach((panel) => {
    const card = document.createElement("article");
    card.className = "chapter-parallel-card";
    const versesHtml = (panel.verses || [])
      .map((entry) => `<p class="chapter-verse"><strong>${entry.reference}</strong><br/>${entry.text}</p>`)
      .join("");
    card.innerHTML = `<h5>${panel.version} | ${panel.name}</h5>${versesHtml}`;
    chapterParallelGridEl.appendChild(card);
  });
}

async function runCrossVersionComparison() {
  if (!selectedVerseId) {
    return;
  }
  const versions = selectedVersionCodes();
  const query = encodeURIComponent(versions.join(","));
  const data = await fetchJson(`/api/v1/scripture/cross-version/${encodeURIComponent(selectedVerseId)}?versions=${query}`);

  crossVersionSummaryEl.textContent = `${data.reference} compared across ${data.comparedVersions.join(", ")}`;
  renderChips(crossVersionSharedEl, data.sharedLexicalCore || []);
  renderList(crossVersionTextListEl, data.versionTexts || [], (item) => `<strong>${item.version}</strong><br/>${item.text}`);
}

async function runAdvancedSearch() {
  const q = globalSearchInputEl.value.trim();
  const data = await fetchJson(`/api/v1/search/advanced?q=${encodeURIComponent(q)}`);

  clearChildren(globalSearchResultsEl);

  const addGroup = (title, values, itemFormatter) => {
    if (!values || values.length === 0) {
      return;
    }
    const group = document.createElement("div");
    group.className = "search-item";
    const lines = values.slice(0, 6).map(itemFormatter).join("<br/>");
    group.innerHTML = `<strong>${title}</strong><br/>${lines}`;
    globalSearchResultsEl.appendChild(group);
  };

  addGroup("Verses", data.verses, (item) => `${item.reference}`);
  addGroup("Books", data.books, (item) => item.book);
  addGroup("People", data.people, (item) => item);
  addGroup("Places", data.places, (item) => item);
  addGroup("Themes", data.themes, (item) => item);
  addGroup("Prophecy Links", data.prophecyLinks, (item) => item);
  addGroup("Hebrew/Greek", data.originalWords, (item) => item);
}

async function loadLibraryOverviewAndPackages() {
  const [overview, packages] = await Promise.all([
    fetchJson("/api/v1/library/overview"),
    fetchJson("/api/v1/library/packages")
  ]);
  const importedAt = overview.lastImportedAt ? new Date(overview.lastImportedAt).toLocaleString() : "never";
  accordanceStatusEl.textContent = `Library: ${overview.counts.bibleListings} listings, ${overview.counts.modules} modules, ${overview.counts.historicResources} history resources. Last import: ${importedAt}.`;

  renderList(bibleListingsListEl, packages.bibleListings || [], (item) => {
    return `<strong>${item.name}</strong><p class="meta">${item.abbreviation || "N/A"} | ${item.language} | ${item.testament}</p>`;
  }, "No bible listings imported yet.");

  renderList(packageModulesListEl, packages.modules || [], (item) => {
    return `<strong>${item.name}</strong><p class="meta">${item.category} | package: ${item.package}</p>`;
  }, "No modules imported yet.");
}

async function loadHistoricalResourcesForSelectedVerse() {
  if (!selectedVerseId) {
    return;
  }
  const data = await fetchJson(`/api/v1/library/historical/${encodeURIComponent(selectedVerseId)}`);
  renderList(historicalResourcesListEl, data.resources || [], (item) => {
    return `<strong>${item.title}</strong><br/>${item.summary || "No summary."}<p class="meta">${item.period}</p>`;
  }, "No history resources linked to this verse.");
}

async function importAccordanceExport() {
  const raw = accordanceImportInputEl.value.trim();
  if (!raw) {
    accordanceStatusEl.textContent = "Provide Accordance JSON first.";
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    accordanceStatusEl.textContent = "Invalid JSON payload.";
    return;
  }

  await fetchJson("/api/v1/integrations/accordance/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...parsed, mode: importModeSelectEl.value })
  });

  await loadLibraryOverviewAndPackages();
  await loadHistoricalResourcesForSelectedVerse();
}

async function importAccordanceFromFile(file) {
  if (!file) {
    return;
  }
  const text = await file.text();
  accordanceImportInputEl.value = text;
  await importAccordanceExport();
}

async function loadOpenSourceHistory() {
  const data = await fetchJson("/api/v1/library/open-source-history");
  renderList(openHistoryListEl, data.resources || [], (item) => {
    return `<strong>${item.title}</strong><p class="meta">${item.author} | ${item.source}</p><a href="${item.url}" target="_blank" rel="noopener noreferrer">Open source link</a>`;
  }, "No open-source history sources available.");
}

function loadNotes() {
  const raw = localStorage.getItem("scripture-key-notes");
  return raw ? JSON.parse(raw) : [];
}

function saveNotes(notes) {
  localStorage.setItem("scripture-key-notes", JSON.stringify(notes));
}

function renderNotes() {
  const notes = loadNotes();
  renderList(notesListEl, notes.slice().reverse(), (note) => {
    return `<strong>${note.reference}</strong><p class="meta">${note.tags || "no tags"}</p>${note.text}`;
  }, "No notes saved yet.");
}

function addNoteForCurrentVerse() {
  if (!selectedVerseId) {
    return;
  }
  const verse = verses.find((item) => item.id === selectedVerseId);
  if (!verse || !noteTextInputEl.value.trim()) {
    return;
  }
  const notes = loadNotes();
  notes.push({
    id: `${Date.now()}`,
    verseId: verse.id,
    reference: verse.reference,
    tags: noteTagsInputEl.value.trim(),
    text: noteTextInputEl.value.trim(),
    createdAt: new Date().toISOString()
  });
  saveNotes(notes);
  noteTextInputEl.value = "";
  renderNotes();
}

function bindEvents() {
  unlockBtnEl.addEventListener("click", () => unlockSelectedVerse().catch(() => {}));

  searchInputEl.addEventListener("input", () => {
    const filtered = filteredVerses(searchInputEl.value);
    if (filtered.length > 0) {
      selectVerse(filtered[0].id).catch(() => {});
    }
  });

  globalSearchBtnEl.addEventListener("click", () => runAdvancedSearch().catch(() => {}));
  globalSearchInputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      runAdvancedSearch().catch(() => {});
    }
  });

  runPatternBtnEl.addEventListener("click", () => runPatternAnalysis().catch(() => {}));
  runLivingWordBtnEl.addEventListener("click", () => runLivingWordInterface().catch(() => {}));
  livingWordVerseOnlyBtnEl.addEventListener("click", () => {
    runLivingWordInterface("pure_scripture").catch(() => {});
  });
  livingWordPatternBtnEl.addEventListener("click", () => {
    runPatternAnalysis().catch(() => {});
  });
  patternScopeTypeEl.addEventListener("change", () => {
    patternScopeRefEl.value = defaultScopeRef(patternScopeTypeEl.value);
  });

  loadParallelBtnEl.addEventListener("click", () => loadParallelView().catch(() => {}));
  loadChapterParallelBtnEl.addEventListener("click", () => loadChapterParallelView().catch(() => {}));
  runCrossVersionBtnEl.addEventListener("click", () => runCrossVersionComparison().catch(() => {}));
  versionSelectors().forEach((el) => el.addEventListener("change", () => {
    loadParallelView().catch(() => {});
    loadChapterParallelView().catch(() => {});
  }));

  importAccordanceBtnEl.addEventListener("click", () => importAccordanceExport().catch(() => {}));
  refreshLibraryBtnEl.addEventListener("click", () => loadLibraryOverviewAndPackages().catch(() => {}));
  accordanceFileInputEl.addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    importAccordanceFromFile(file).catch(() => {});
  });
  accordanceDropzoneEl.addEventListener("dragover", (event) => {
    event.preventDefault();
    accordanceDropzoneEl.classList.add("active");
  });
  accordanceDropzoneEl.addEventListener("dragleave", () => accordanceDropzoneEl.classList.remove("active"));
  accordanceDropzoneEl.addEventListener("drop", (event) => {
    event.preventDefault();
    accordanceDropzoneEl.classList.remove("active");
    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    importAccordanceFromFile(file).catch(() => {});
  });

  refreshHistoryBtnEl.addEventListener("click", () => loadOpenSourceHistory().catch(() => {}));

  bookModeStandardBtnEl.addEventListener("click", () => {
    selectedBookMode = "standard";
    loadBookExplorer().catch(() => {});
  });
  bookModeCanonBtnEl.addEventListener("click", () => {
    selectedBookMode = "canon";
    loadBookExplorer().catch(() => {});
  });
  bookModeTimelineBtnEl.addEventListener("click", () => {
    selectedBookMode = "timeline";
    loadBookExplorer().catch(() => {});
  });
  canonTraditionSelectEl.addEventListener("change", () => {
    if (selectedBookMode === "canon") {
      loadBookExplorer().catch(() => {});
    }
  });

  saveNoteBtnEl.addEventListener("click", addNoteForCurrentVerse);

  verseTextContainerEl.addEventListener("mousemove", (event) => {
    const target = event.target;
    if (!target.classList.contains("hover-token")) {
      hoverCardEl.style.display = "none";
      return;
    }

    const key = target.dataset.word;
    const text = hoverLexicon[key];
    if (!text) {
      hoverCardEl.style.display = "none";
      return;
    }

    hoverCardEl.style.display = "block";
    hoverCardEl.style.left = `${event.clientX + 12}px`;
    hoverCardEl.style.top = `${event.clientY + 12}px`;
    hoverCardEl.textContent = text;
  });

  verseTextContainerEl.addEventListener("mouseleave", () => {
    hoverCardEl.style.display = "none";
  });
}

async function init() {
  bindEvents();
  renderGuidedTrails();
  renderNotes();
  patternScopeRefEl.value = "Genesis:1";

  await Promise.all([
    loadSystemCatalog(),
    loadVersions(),
    loadLibraryOverviewAndPackages(),
    loadOpenSourceHistory()
  ]);

  await loadBookExplorer();
  await loadVerseList();
}

init().catch(() => {
  modeGuidanceEl.textContent = "Initialization failed. Check API and reload.";
});

// ══════════════════════════════════════════════════════════════════════
// DISCOVERY ENGINE
// ══════════════════════════════════════════════════════════════════════

// ── Element refs ──────────────────────────────────────────────────────
const firstMentionInputEl = document.getElementById("firstMentionInput");
const runFirstMentionBtnEl = document.getElementById("runFirstMentionBtn");
const firstMentionResultEl = document.getElementById("firstMentionResult");

const themeEvolInputEl = document.getElementById("themeEvolInput");
const runThemeEvolBtnEl = document.getElementById("runThemeEvolBtn");
const themeEvolResultEl = document.getElementById("themeEvolResult");

const loadAllProphecyBtnEl = document.getElementById("loadAllProphecyBtn");
const checkFulfillmentBtnEl = document.getElementById("checkFulfillmentBtn");
const prophecyResultEl = document.getElementById("prophecyResult");

const doctrineSelectEl = document.getElementById("doctrineSelect");
const loadDoctrineBtnEl = document.getElementById("loadDoctrineBtn");
const doctrineResultEl = document.getElementById("doctrineResult");

const findParallelBtnEl = document.getElementById("findParallelBtn");
const parallelPassageResultEl = document.getElementById("parallelPassageResult");

const interpretationSelectEl = document.getElementById("interpretationSelect");
const loadInterpretationBtnEl = document.getElementById("loadInterpretationBtn");
const interpretationResultEl = document.getElementById("interpretationResult");

const contradictionInputEl = document.getElementById("contradictionInput");
const resolveContradictionBtnEl = document.getElementById("resolveContradictionBtn");
const contradictionResultEl = document.getElementById("contradictionResult");

const networkSeedInputEl = document.getElementById("networkSeedInput");
const runNetworkBtnEl = document.getElementById("runNetworkBtn");
const networkCanvasEl = document.getElementById("scriptureNetworkCanvas");
const networkLegendEl = document.getElementById("networkLegend");

const prophecyQuickListEl = document.getElementById("prophecyQuickList");
const doctrineQuickSelectEl = document.getElementById("doctrineQuickSelect");
const doctrineQuickLoadBtnEl = document.getElementById("doctrineQuickLoadBtn");
const doctrineQuickResultEl = document.getElementById("doctrineQuickResult");

const buildSermonBtnEl = document.getElementById("buildSermonBtn");
const sermonThemeInputEl = document.getElementById("sermonThemeInput");
const sermonOutlineResultEl = document.getElementById("sermonOutlineResult");

const checkContextIntegrityBtnEl = document.getElementById("checkContextIntegrityBtn");
const contextIntegrityResultEl = document.getElementById("contextIntegrityResult");

// ── Tab switching ─────────────────────────────────────────────────────
document.querySelectorAll(".disc-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".disc-tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".disc-panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    const panelEl = document.getElementById(`disc-panel-${tab.dataset.tab}`);
    if (panelEl) panelEl.classList.add("active");
  });
});

// ── First Mention Engine ──────────────────────────────────────────────
async function runFirstMention() {
  const term = firstMentionInputEl.value.trim();
  if (!term) return;
  clearChildren(firstMentionResultEl);
  let data;
  try {
    data = await fetchJson(`/api/v1/first-mention?term=${encodeURIComponent(term)}`);
  } catch {
    firstMentionResultEl.textContent = `No mentions of "${term}" found in the current dataset.`;
    return;
  }

  const header = document.createElement("div");
  header.className = "first-mention-header";
  header.innerHTML = `
    <strong>"${data.term}"</strong> first appears at <strong>${data.firstMention.reference}</strong><br/>
    <span class="era-badge">${data.firstMention.era}</span>
    <p class="disc-text">${data.firstMention.text}</p>
    <p class="disc-note">${data.note}</p>
    <p class="disc-note">Total occurrences in dataset: <strong>${data.totalOccurrences}</strong></p>
  `;
  firstMentionResultEl.appendChild(header);

  const subhead = document.createElement("h4");
  subhead.textContent = "Development Arc";
  subhead.style.cssText = "margin:10px 0 6px; color:var(--accent)";
  firstMentionResultEl.appendChild(subhead);

  (data.developments || []).forEach((dev) => {
    const card = document.createElement("div");
    card.className = "disc-card";
    card.innerHTML = `
      <span class="era-badge">${dev.era}</span>
      <div class="disc-text"><strong>${dev.primaryVerse}</strong> (${dev.occurrences} verse${dev.occurrences !== 1 ? "s" : ""})</div>
      <div class="disc-note">${dev.note}</div>
      <div class="chips" style="margin-top:5px">${(dev.themes || []).map((t) => `<span class="chip">${t}</span>`).join("")}</div>
    `;
    firstMentionResultEl.appendChild(card);
  });
}

// ── Theme Evolution Timeline ──────────────────────────────────────────
async function runThemeEvolution() {
  const theme = themeEvolInputEl.value.trim();
  if (!theme) return;
  clearChildren(themeEvolResultEl);
  let data;
  try {
    data = await fetchJson(`/api/v1/theme-evolution?theme=${encodeURIComponent(theme)}`);
  } catch {
    themeEvolResultEl.textContent = `No theme matches for "${theme}" found.`;
    return;
  }

  if (data.evolutionSummary) {
    const summary = document.createElement("div");
    summary.className = "disc-card";
    summary.innerHTML = `<div class="disc-text" style="color:var(--accent-gold)">${data.evolutionSummary}</div>`;
    themeEvolResultEl.appendChild(summary);
  }

  if (data.doctrineArc && data.doctrineArc.length > 0) {
    const arcHead = document.createElement("h4");
    arcHead.textContent = "Doctrine Development Arc";
    arcHead.style.cssText = "margin:10px 0 5px; color:var(--accent);";
    themeEvolResultEl.appendChild(arcHead);

    const arcEl = document.createElement("div");
    arcEl.className = "era-timeline";
    data.doctrineArc.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "era-row";
      row.innerHTML = `
        <div class="era-name">${entry.era}</div>
        <div class="era-note">${entry.note}</div>
        ${entry.reference ? `<div class="disc-note">${entry.reference}: ${entry.text || ""}</div>` : ""}
      `;
      arcEl.appendChild(row);
    });
    themeEvolResultEl.appendChild(arcEl);
  }

  const devHead = document.createElement("h4");
  devHead.textContent = "Dataset Occurrences by Era";
  devHead.style.cssText = "margin:10px 0 5px; color:var(--accent);";
  themeEvolResultEl.appendChild(devHead);

  (data.developments || []).forEach((dev) => {
    const card = document.createElement("div");
    card.className = "disc-card";
    card.innerHTML = `
      <span class="era-badge">${dev.era}</span>
      <div class="disc-text"><strong>${dev.primaryVerse}</strong> — ${dev.occurrences} verse${dev.occurrences !== 1 ? "s" : ""}</div>
      <div class="disc-note">${dev.note}</div>
    `;
    themeEvolResultEl.appendChild(card);
  });
}

// ── Prophecy → Fulfillment Engine ────────────────────────────────────
function renderProphecyPairs(pairs, container) {
  clearChildren(container);
  if (!pairs || pairs.length === 0) {
    container.textContent = "No prophecy pairs found.";
    return;
  }
  pairs.forEach((pair) => {
    const block = document.createElement("div");
    block.className = "prophecy-pair";
    block.innerHTML = `
      <p class="pair-title">${pair.shortTitle}</p>
      <span class="fulfillment-badge ${pair.fulfillmentStatus}">${pair.fulfillmentStatus}</span>
      <div style="margin-top:8px">
        <div class="pair-label">Prophecy · ${pair.prophecyReference}</div>
        <p class="pair-text">"${pair.prophecyText}"</p>
        <div class="pair-label">Fulfillment · ${pair.fulfillmentReference}</div>
        <p class="pair-text">"${pair.fulfillmentText}"</p>
      </div>
      ${pair.partialFulfillment ? `<p class="disc-note"><strong>Partial:</strong> ${pair.partialFulfillment}</p>` : ""}
      ${pair.futureImplication ? `<p class="disc-note"><strong>Future:</strong> ${pair.futureImplication}</p>` : ""}
      ${pair.notes ? `<p class="disc-note">${pair.notes}</p>` : ""}
    `;
    container.appendChild(block);
  });
}

async function loadAllProphecy() {
  clearChildren(prophecyResultEl);
  const data = await fetchJson("/api/v1/prophecy/all");
  renderProphecyPairs(data.pairs, prophecyResultEl);
}

async function checkCurrentVerseFulfillment() {
  if (!selectedVerseId) {
    prophecyResultEl.textContent = "Select a verse first.";
    return;
  }
  clearChildren(prophecyResultEl);
  let data;
  try {
    data = await fetchJson(`/api/v1/prophecy/${encodeURIComponent(selectedVerseId)}`);
  } catch {
    prophecyResultEl.textContent = "No prophecy/fulfillment link found for the current verse.";
    return;
  }
  renderProphecyPairs(data.links, prophecyResultEl);
}

// ── Doctrine Mapping System ───────────────────────────────────────────
async function loadDoctrineList() {
  const data = await fetchJson("/api/v1/doctrine/list");
  [doctrineSelectEl, doctrineQuickSelectEl].forEach((sel) => {
    clearChildren(sel);
    data.doctrines.forEach((doc) => {
      const opt = document.createElement("option");
      opt.value = doc.key;
      opt.textContent = doc.name;
      sel.appendChild(opt);
    });
  });
}

function renderDoctrineData(data, container) {
  clearChildren(container);

  const defCard = document.createElement("div");
  defCard.className = "disc-card";
  defCard.innerHTML = `<h4>${data.name}</h4><p class="disc-text">${data.definition}</p>`;
  container.appendChild(defCard);

  if (data.timeline && data.timeline.length > 0) {
    const arcHead = document.createElement("h4");
    arcHead.textContent = "Development Arc";
    arcHead.style.cssText = "margin:10px 0 5px; color:var(--accent)";
    container.appendChild(arcHead);

    const arcEl = document.createElement("div");
    arcEl.className = "era-timeline doctrine-section";
    data.timeline.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "era-row";
      row.innerHTML = `
        <div class="era-name">${entry.era}</div>
        <div class="era-note">${entry.note}</div>
        ${entry.reference && entry.text ? `<div class="disc-note" style="margin-top:3px"><em>${entry.reference}</em> — "${entry.text}"</div>` : ""}
      `;
      arcEl.appendChild(row);
    });
    container.appendChild(arcEl);
  }

  const keyHead = document.createElement("h4");
  keyHead.textContent = "Key Verses";
  keyHead.style.cssText = "margin:10px 0 5px; color:var(--accent)";
  container.appendChild(keyHead);
  const keyChips = document.createElement("div");
  keyChips.className = "chips";
  (data.keyVerses || []).forEach((id) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = id;
    chip.style.cursor = "pointer";
    chip.addEventListener("click", () => {
      selectVerse(id).catch(() => {});
    });
    keyChips.appendChild(chip);
  });
  container.appendChild(keyChips);

  if (data.debatedPassages && data.debatedPassages.length > 0) {
    const debateHead = document.createElement("h4");
    debateHead.textContent = "Debated Passages";
    debateHead.style.cssText = "margin:10px 0 5px; color:#fca888";
    container.appendChild(debateHead);
    const debChips = document.createElement("div");
    debChips.className = "chips";
    data.debatedPassages.forEach((id) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.style.borderColor = "#fca888";
      chip.style.color = "#fca888";
      chip.textContent = id;
      chip.style.cursor = "pointer";
      chip.addEventListener("click", () => selectVerse(id).catch(() => {}));
      debChips.appendChild(chip);
    });
    container.appendChild(debChips);
  }
}

async function loadDoctrine(selectEl, resultEl) {
  const name = selectEl.value;
  if (!name) return;
  let data;
  try {
    data = await fetchJson(`/api/v1/doctrine?name=${encodeURIComponent(name)}`);
  } catch {
    resultEl.textContent = "Doctrine not found.";
    return;
  }
  renderDoctrineData(data, resultEl);
}

// ── Parallel Passage Detector ─────────────────────────────────────────
async function findParallelPassages() {
  if (!selectedVerseId) {
    parallelPassageResultEl.textContent = "Select a verse first.";
    return;
  }
  clearChildren(parallelPassageResultEl);
  let data;
  try {
    data = await fetchJson(`/api/v1/parallel-passages/${encodeURIComponent(selectedVerseId)}`);
  } catch {
    parallelPassageResultEl.textContent = "No parallel passages found for the current verse.";
    return;
  }

  (data.parallels || []).forEach((parallel) => {
    const card = document.createElement("div");
    card.className = "disc-card";
    card.innerHTML = `
      <div class="era-badge">${parallel.theme}</div>
      <div class="disc-text" style="margin-top:5px">
        <strong class="prophecy-quick-item" style="cursor:pointer" data-id="${parallel.parallelVerseId}">${parallel.parallelReference}</strong>
      </div>
      ${parallel.parallelText ? `<p class="disc-text">"${parallel.parallelText}"</p>` : ""}
      <div class="disc-note">${parallel.note}</div>
    `;
    card.querySelector("[data-id]").addEventListener("click", () => {
      selectVerse(parallel.parallelVerseId).catch(() => {});
    });
    parallelPassageResultEl.appendChild(card);
  });
}

// ── Interpretation Comparison ─────────────────────────────────────────
async function loadInterpretationTopics() {
  const data = await fetchJson("/api/v1/interpretations");
  clearChildren(interpretationSelectEl);
  (data.topics || []).forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item.key;
    opt.textContent = item.topic;
    interpretationSelectEl.appendChild(opt);
  });
}

async function loadInterpretation() {
  const topic = interpretationSelectEl.value;
  if (!topic) return;
  clearChildren(interpretationResultEl);
  let data;
  try {
    data = await fetchJson(`/api/v1/interpretations?topic=${encodeURIComponent(topic)}`);
  } catch {
    interpretationResultEl.textContent = "Interpretation data not found.";
    return;
  }

  const qCard = document.createElement("div");
  qCard.className = "disc-card";
  qCard.innerHTML = `<h4>${data.topic}</h4><p class="disc-note">${data.question}</p>`;
  interpretationResultEl.appendChild(qCard);

  (data.views || []).forEach((view) => {
    const block = document.createElement("div");
    block.className = "interpretation-view";
    const verseChips = (view.verseObjects || [])
      .map((v) => `<span class="chip" style="cursor:pointer" data-id="${v.id}">${v.reference}</span>`)
      .join("");
    block.innerHTML = `
      <div class="view-tradition">${view.tradition}</div>
      <div class="view-summary">${view.summary}</div>
      ${verseChips ? `<div class="chips" style="margin-top:6px">${verseChips}</div>` : ""}
      <div class="view-agreement">Agreement: ${view.agreementPoint}</div>
    `;
    block.querySelectorAll("[data-id]").forEach((chip) => {
      chip.addEventListener("click", () => selectVerse(chip.dataset.id).catch(() => {}));
    });
    interpretationResultEl.appendChild(block);
  });
}

// ── Contradiction Resolver ────────────────────────────────────────────
async function resolveContradiction() {
  const passage = contradictionInputEl.value.trim();
  if (!passage) return;
  clearChildren(contradictionResultEl);
  let data;
  try {
    data = await fetchJson("/api/v1/contradiction-resolver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passage })
    });
  } catch {
    contradictionResultEl.textContent = "Error contacting server.";
    return;
  }

  if (!data.found && data.suggestion) {
    const suggest = document.createElement("div");
    suggest.className = "disc-card";
    suggest.innerHTML = `<div class="disc-note">${data.suggestion}</div>`;
    contradictionResultEl.appendChild(suggest);

    if (data.available) {
      const avail = document.createElement("div");
      avail.className = "disc-card";
      avail.innerHTML = `<h4>Available</h4>` +
        (data.available || []).map((a) => `<div class="disc-note" style="cursor:pointer" class="prophecy-quick-item">${a.question}</div>`).join("");
      contradictionResultEl.appendChild(avail);
    }

    if (data.example) renderContradictionItem(data.example, contradictionResultEl);
    return;
  }

  renderContradictionItem(data, contradictionResultEl);
}

function renderContradictionItem(item, container) {
  const block = document.createElement("div");
  block.className = "contradiction-block";
  const verseChips = (item.verseObjects || [])
    .map((v) => `<span class="chip" style="cursor:pointer" data-id="${v.id}">${v.reference}</span>`)
    .join("");
  block.innerHTML = `
    <p class="cont-q">${item.question}</p>
    ${verseChips ? `<div class="chips" style="margin-bottom:8px">${verseChips}</div>` : ""}
    <div class="cont-resolution">${item.resolution}</div>
    <div class="cont-agreement">Scriptural Agreement: ${item.agreementPoint}</div>
  `;
  block.querySelectorAll("[data-id]").forEach((chip) => {
    chip.addEventListener("click", () => selectVerse(chip.dataset.id).catch(() => {}));
  });
  container.appendChild(block);
}

// ── Visual Scripture Network ──────────────────────────────────────────
let networkData = null;

function eraColor(era) {
  const colors = {
    "Creation & Patriarchs": "#f5c77b",
    "Torah & Law": "#7bdff5",
    "Wisdom Literature": "#c87bf5",
    "Major Prophets": "#f57b7b",
    "Minor Prophets": "#f5a07b",
    "Gospels": "#7bf5a0",
    "Apostolic Letters": "#7bbff5",
    "General Epistles": "#a0a0f5",
    "Apocalyptic": "#f57bc0",
    "Early Church": "#b0f57b"
  };
  return colors[era] || "#73c9ff";
}

async function runVisualNetwork() {
  const seed = networkSeedInputEl.value.trim();
  clearChildren(networkLegendEl);
  let data;
  try {
    data = await fetchJson(`/api/v1/visual-network?seed=${encodeURIComponent(seed)}`);
  } catch {
    networkLegendEl.textContent = "Failed to load network data.";
    return;
  }
  networkData = data;
  drawNetwork(data);

  const eras = [...new Set((data.nodes || []).map((n) => n.era))];
  eras.forEach((era) => {
    const dot = document.createElement("span");
    dot.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${eraColor(era)};margin-right:4px"></span>${era}`;
    networkLegendEl.appendChild(dot);
  });
}

function drawNetwork(data) {
  if (!networkCanvasEl) return;
  const ctx = networkCanvasEl.getContext("2d");
  const W = networkCanvasEl.width;
  const H = networkCanvasEl.height;
  ctx.clearRect(0, 0, W, H);

  const nodes = data.nodes || [];
  const edges = data.edges || [];
  if (nodes.length === 0) return;

  const positions = {};
  const cx = W / 2;
  const cy = H / 2;
  const radius = Math.min(W, H) * 0.38;

  nodes.forEach((node, i) => {
    const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
    const r = node.isSeed ? radius * 0.5 : radius;
    positions[node.id] = {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      node
    };
  });

  ctx.lineWidth = 0.7;
  edges.forEach((edge) => {
    const from = positions[edge.from];
    const to = positions[edge.to];
    if (!from || !to) return;
    ctx.strokeStyle = edge.type === "PARALLEL" ? "rgba(245,199,123,0.45)" : "rgba(115,201,255,0.22)";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  });

  nodes.forEach((node) => {
    const pos = positions[node.id];
    if (!pos) return;
    const color = eraColor(node.era);
    const r = node.isSeed ? 9 : 6;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 0.5;
    ctx.stroke();

    ctx.fillStyle = "rgba(236,246,255,0.9)";
    ctx.font = `${node.isSeed ? "9px" : "8px"} Orbitron, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(node.label, pos.x, pos.y - r - 3);
  });
}

// ── Context Integrity ─────────────────────────────────────────────────
async function checkContextIntegrity() {
  if (!selectedVerseId) {
    contextIntegrityResultEl.textContent = "Select a verse first.";
    return;
  }
  clearChildren(contextIntegrityResultEl);
  let data;
  try {
    data = await fetchJson(`/api/v1/context-integrity/${encodeURIComponent(selectedVerseId)}`);
  } catch {
    contextIntegrityResultEl.textContent = "Could not load context integrity data.";
    return;
  }

  if (data.contextWarning) {
    const warn = document.createElement("div");
    warn.className = "context-warning-box";
    warn.innerHTML = `⚠️ ${data.contextWarning}`;
    contextIntegrityResultEl.appendChild(warn);
  } else {
    const safe = document.createElement("div");
    safe.className = "context-safe-box";
    safe.textContent = `✓ ${data.reference} — no common misquotation pattern detected.`;
    contextIntegrityResultEl.appendChild(safe);
  }

  if (data.bookPurpose) {
    const purp = document.createElement("div");
    purp.className = "disc-card";
    purp.innerHTML = `<h4>Book Purpose</h4><p class="disc-text">${data.bookPurpose}</p>`;
    contextIntegrityResultEl.appendChild(purp);
  }

  if (data.surroundingContext && data.surroundingContext.length > 0) {
    const ctxHead = document.createElement("h4");
    ctxHead.textContent = "Surrounding Context";
    ctxHead.style.cssText = "margin:10px 0 5px; color:var(--accent)";
    contextIntegrityResultEl.appendChild(ctxHead);

    data.surroundingContext.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "disc-card";
      row.innerHTML = `<strong>${entry.reference}</strong><p class="disc-text">"${entry.text}"</p>`;
      if (entry.reference === data.reference) {
        row.style.borderColor = "var(--accent)";
      }
      contextIntegrityResultEl.appendChild(row);
    });
  }
}

// ── Prophecy Quick List (left sidebar) ───────────────────────────────
async function loadProphecyQuickList() {
  let data;
  try {
    data = await fetchJson("/api/v1/prophecy/all");
  } catch {
    return;
  }
  renderList(prophecyQuickListEl, (data.pairs || []).slice(0, 6), (pair) => {
    return `<span class="prophecy-quick-item" data-prop="${pair.prophecyVerseId}" data-ful="${pair.fulfillmentVerseId}">${pair.shortTitle}</span>`;
  }, "No prophecy pairs.");
  prophecyQuickListEl.querySelectorAll(".prophecy-quick-item[data-prop]").forEach((item) => {
    item.addEventListener("click", () => {
      selectVerse(item.dataset.prop).catch(() => {});
    });
  });
}

// ── Sermon Builder ────────────────────────────────────────────────────
async function buildSermonOutline() {
  const theme = sermonThemeInputEl.value.trim();
  if (!theme) return;
  clearChildren(sermonOutlineResultEl);

  let data;
  try {
    data = await fetchJson(`/api/v1/theme-evolution?theme=${encodeURIComponent(theme)}`);
  } catch {
    sermonOutlineResultEl.textContent = `No data found for theme "${theme}".`;
    return;
  }

  const container = document.createElement("div");
  container.className = "sermon-outline";
  container.innerHTML = `<h4>Outline: "${data.term}"</h4>`;

  const intro = document.createElement("div");
  intro.className = "sermon-point";
  intro.innerHTML = `<strong>I. Introduction — First Occurrence</strong><br/>${data.firstMention.reference}: "${data.firstMention.text}"`;
  container.appendChild(intro);

  (data.developments || []).slice(0, 4).forEach((dev, i) => {
    const point = document.createElement("div");
    point.className = "sermon-point";
    point.innerHTML = `<strong>${["II.", "III.", "IV.", "V."][i] || `${i + 2}.`} ${dev.era}</strong><br/>${dev.note}<br/><em>${dev.primaryVerse}</em>`;
    container.appendChild(point);
  });

  const conc = document.createElement("div");
  conc.className = "sermon-point";
  conc.innerHTML = `<strong>Conclusion — Canonical Arc</strong><br/>${data.evolutionSummary || "This theme moves progressively through Scripture, building toward its final expression."}`;
  container.appendChild(conc);

  sermonOutlineResultEl.appendChild(container);
}

// ── Bind all new events ───────────────────────────────────────────────
function bindDiscoveryEvents() {
  runFirstMentionBtnEl.addEventListener("click", () => runFirstMention().catch(() => {}));
  firstMentionInputEl.addEventListener("keydown", (e) => { if (e.key === "Enter") runFirstMention().catch(() => {}); });

  runThemeEvolBtnEl.addEventListener("click", () => runThemeEvolution().catch(() => {}));
  themeEvolInputEl.addEventListener("keydown", (e) => { if (e.key === "Enter") runThemeEvolution().catch(() => {}); });

  loadAllProphecyBtnEl.addEventListener("click", () => loadAllProphecy().catch(() => {}));
  checkFulfillmentBtnEl.addEventListener("click", () => checkCurrentVerseFulfillment().catch(() => {}));

  loadDoctrineBtnEl.addEventListener("click", () => loadDoctrine(doctrineSelectEl, doctrineResultEl).catch(() => {}));
  doctrineQuickLoadBtnEl.addEventListener("click", () => loadDoctrine(doctrineQuickSelectEl, doctrineQuickResultEl).catch(() => {}));

  findParallelBtnEl.addEventListener("click", () => findParallelPassages().catch(() => {}));

  loadInterpretationBtnEl.addEventListener("click", () => loadInterpretation().catch(() => {}));

  resolveContradictionBtnEl.addEventListener("click", () => resolveContradiction().catch(() => {}));
  contradictionInputEl.addEventListener("keydown", (e) => { if (e.key === "Enter") resolveContradiction().catch(() => {}); });

  runNetworkBtnEl.addEventListener("click", () => runVisualNetwork().catch(() => {}));
  networkSeedInputEl.addEventListener("keydown", (e) => { if (e.key === "Enter") runVisualNetwork().catch(() => {}); });

  checkContextIntegrityBtnEl.addEventListener("click", () => checkContextIntegrity().catch(() => {}));
  buildSermonBtnEl.addEventListener("click", () => buildSermonOutline().catch(() => {}));
  sermonThemeInputEl.addEventListener("keydown", (e) => { if (e.key === "Enter") buildSermonOutline().catch(() => {}); });
}

async function initDiscoveryEngine() {
  bindDiscoveryEvents();
  await Promise.all([
    loadDoctrineList(),
    loadInterpretationTopics(),
    loadProphecyQuickList()
  ]);
}

initDiscoveryEngine().catch(() => {});
