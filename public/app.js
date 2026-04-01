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
  let data;
  try {
    data = await fetchJson("/api/v1/living-word/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        responseMode,
        correctionMode: Boolean(livingWordCorrectionEl.checked),
        minSupportVerses: 3,
        contextGuard: Boolean(livingWordContextGuardEl.checked),
        strictCitationEnforcement: Boolean(livingWordStrictCitationsEl.checked)
      })
    });
  } catch (error) {
    livingWordBoundaryEl.textContent = "Strict mode can fail when not enough citations are found.";
    livingWordOutputEl.textContent = "Response blocked by strict citation enforcement.";
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
