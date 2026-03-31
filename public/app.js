const verseListEl = document.getElementById("verseList");
const verseRefEl = document.getElementById("verseRef");
const verseTextEl = document.getElementById("verseText");
const crossRefsEl = document.getElementById("crossRefs");
const commentaryTextEl = document.getElementById("commentaryText");
const timelineListEl = document.getElementById("timelineList");
const originalLangEl = document.getElementById("originalLang");
const originalTextEl = document.getElementById("originalText");
const strongListEl = document.getElementById("strongList");
const unlockBtnEl = document.getElementById("unlockBtn");
const layerStackEl = document.getElementById("layerStack");
const relatedListEl = document.getElementById("relatedList");
const modeGuidanceEl = document.getElementById("modeGuidance");
const modeSelectEl = document.getElementById("modeSelect");
const latticeSignalsEl = document.getElementById("latticeSignals");
const searchInputEl = document.getElementById("searchInput");
const runPatternBtnEl = document.getElementById("runPatternBtn");
const patternScopeTypeEl = document.getElementById("patternScopeType");
const patternScopeRefEl = document.getElementById("patternScopeRef");
const patternFindingsEl = document.getElementById("patternFindings");
const accordanceImportInputEl = document.getElementById("accordanceImportInput");
const importAccordanceBtnEl = document.getElementById("importAccordanceBtn");
const refreshLibraryBtnEl = document.getElementById("refreshLibraryBtn");
const importModeSelectEl = document.getElementById("importModeSelect");
const accordanceStatusEl = document.getElementById("accordanceStatus");
const bibleListingsListEl = document.getElementById("bibleListingsList");
const packageModulesListEl = document.getElementById("packageModulesList");
const historicalResourcesListEl = document.getElementById("historicalResourcesList");
const parallelVersion1El = document.getElementById("parallelVersion1");
const parallelVersion2El = document.getElementById("parallelVersion2");
const parallelVersion3El = document.getElementById("parallelVersion3");
const parallelVersion4El = document.getElementById("parallelVersion4");
const loadParallelBtnEl = document.getElementById("loadParallelBtn");
const parallelGridEl = document.getElementById("parallelGrid");
const runCrossVersionBtnEl = document.getElementById("runCrossVersionBtn");
const crossVersionSummaryEl = document.getElementById("crossVersionSummary");
const crossVersionSharedEl = document.getElementById("crossVersionShared");
const crossVersionTextListEl = document.getElementById("crossVersionTextList");
const chapterParallelRefEl = document.getElementById("chapterParallelRef");
const loadChapterParallelBtnEl = document.getElementById("loadChapterParallelBtn");
const chapterParallelGridEl = document.getElementById("chapterParallelGrid");
const accordanceFileInputEl = document.getElementById("accordanceFileInput");
const accordanceDropzoneEl = document.getElementById("accordanceDropzone");
const refreshHistoryBtnEl = document.getElementById("refreshHistoryBtn");
const openHistoryListEl = document.getElementById("openHistoryList");

let verses = [];
let selectedVerseId = null;
let availableVersions = [];

function clearChildren(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function renderChips(container, values) {
  clearChildren(container);

  values.forEach((value) => {
    const span = document.createElement("span");
    span.className = "chip";
    span.textContent = value;
    container.appendChild(span);
  });
}

function renderVerseList(items) {
  clearChildren(verseListEl);

  items.forEach((verse) => {
    const li = document.createElement("li");
    li.className = `verse-item ${verse.id === selectedVerseId ? "active" : ""}`;

    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `<strong>${verse.reference}</strong><br/><span>${verse.text}</span>`;
    button.addEventListener("click", () => selectVerse(verse.id));

    li.appendChild(button);
    verseListEl.appendChild(li);
  });
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

async function loadVerseList() {
  const data = await fetchJson("/api/v1/scripture");
  verses = data.verses;
  renderVerseList(verses);

  if (verses.length > 0) {
    selectVerse(verses[0].id);
  }
}

function renderVersePayload(verse) {
  verseRefEl.textContent = verse.reference;
  verseTextEl.textContent = verse.text;
  commentaryTextEl.textContent = verse.commentary;
  originalLangEl.textContent = `Language: ${verse.original.language}`;
  originalTextEl.textContent = verse.original.text;

  renderChips(crossRefsEl, verse.crossReferences);

  clearChildren(timelineListEl);
  verse.contextTimeline.forEach((point) => {
    const li = document.createElement("li");
    li.textContent = point;
    timelineListEl.appendChild(li);
  });

  clearChildren(strongListEl);
  verse.original.strongs.forEach((entry) => {
    const li = document.createElement("li");
    li.className = "strong-item";
    li.textContent = `${entry.number} | ${entry.lemma} | ${entry.definition}`;
    strongListEl.appendChild(li);
  });

  renderChips(latticeSignalsEl, [...verse.themes, ...verse.people, ...verse.events]);
}

async function selectVerse(verseId) {
  selectedVerseId = verseId;
  renderVerseList(filteredVerses(searchInputEl.value));

  const data = await fetchJson(`/api/v1/scripture/${encodeURIComponent(verseId)}`);
  renderVersePayload(data.verse);

  clearChildren(layerStackEl);
  clearChildren(relatedListEl);
  modeGuidanceEl.textContent = "Press Unlock to expand layered interpretation.";
  loadHistoricalResourcesForSelectedVerse().catch(() => {
    clearChildren(historicalResourcesListEl);
  });
  loadParallelView().catch(() => {
    clearChildren(parallelGridEl);
  });
  loadChapterParallelView().catch(() => {
    clearChildren(chapterParallelGridEl);
  });
}

function createLayerCard(label, text, confidence) {
  const card = document.createElement("article");
  card.className = "layer-card";

  const heading = document.createElement("h5");
  heading.textContent = `${label} (${Math.round(confidence * 100)}%)`;

  const body = document.createElement("p");
  body.textContent = text;

  card.appendChild(heading);
  card.appendChild(body);

  return card;
}

async function unlockSelectedVerse() {
  if (!selectedVerseId) {
    modeGuidanceEl.textContent = "Select a verse first.";
    return;
  }

  const payload = {
    verseId: selectedVerseId,
    mode: modeSelectEl.value,
    includeGraph: true
  };

  const data = await fetchJson("/api/v1/scripture/unlock", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  modeGuidanceEl.textContent = data.modeGuidance;
  clearChildren(layerStackEl);

  layerStackEl.appendChild(createLayerCard("Literal", data.layers.literal, data.confidence.literal));
  layerStackEl.appendChild(createLayerCard("Historical", data.layers.historical, data.confidence.historical));
  layerStackEl.appendChild(createLayerCard("Prophetic", data.layers.prophetic, data.confidence.prophetic));
  layerStackEl.appendChild(createLayerCard("Symbolic", data.layers.symbolic, data.confidence.symbolic));

  const connections = document.createElement("article");
  connections.className = "layer-card";
  connections.innerHTML = `<h5>Connections</h5><p>${data.layers.connections.join(" | ")}</p>`;
  layerStackEl.appendChild(connections);

  clearChildren(relatedListEl);
  data.relatedVerses.forEach((verse) => {
    const li = document.createElement("li");
    li.className = "related-item";

    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `<strong>${verse.reference}</strong><br/><span>${verse.text}</span>`;
    button.addEventListener("click", () => selectVerse(verse.id));

    li.appendChild(button);
    relatedListEl.appendChild(li);
  });
}

function filteredVerses(query) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return verses;
  }

  return verses.filter((verse) => {
    return (
      verse.reference.toLowerCase().includes(normalized) ||
      verse.text.toLowerCase().includes(normalized)
    );
  });
}

function defaultScopeRef(scopeType) {
  const currentVerse = verses.find((item) => item.id === selectedVerseId);

  if (!currentVerse) {
    return "";
  }

  if (scopeType === "verse") {
    return currentVerse.id;
  }

  if (scopeType === "chapter") {
    const chapterAndBook = currentVerse.reference.split(":")[0];
    const space = chapterAndBook.lastIndexOf(" ");
    const book = chapterAndBook.slice(0, space);
    const chapter = chapterAndBook.slice(space + 1);
    return `${book}:${chapter}`;
  }

  if (scopeType === "book") {
    const chapterAndBook = currentVerse.reference.split(":")[0];
    const space = chapterAndBook.lastIndexOf(" ");
    return chapterAndBook.slice(0, space);
  }

  return "";
}

function renderPatternFindings(findings) {
  clearChildren(patternFindingsEl);

  if (!findings || findings.length === 0) {
    const li = document.createElement("li");
    li.className = "pattern-item";
    li.textContent = "No high-confidence patterns found for this scope.";
    patternFindingsEl.appendChild(li);
    return;
  }

  findings.forEach((item) => {
    const li = document.createElement("li");
    li.className = "pattern-item";
    li.innerHTML = `
      <h5>${item.patternType} (${Math.round((item.confidence || 0) * 100)}%)</h5>
      <p>${item.finding}</p>
      <p class="meta">Evidence: ${(item.evidence || []).join(" | ")}</p>
    `;
    patternFindingsEl.appendChild(li);
  });
}

async function runPatternAnalysis() {
  const scopeType = patternScopeTypeEl.value;
  const scopeRef = patternScopeRefEl.value.trim() || defaultScopeRef(scopeType);

  const data = await fetchJson("/api/v1/patterns/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      scopeType,
      scopeRef,
      patternTypes: ["phrase_repeat", "numeric", "chiastic", "parallel"]
    })
  });

  renderPatternFindings(data.findings);
}

function versionSelectors() {
  return [parallelVersion1El, parallelVersion2El, parallelVersion3El, parallelVersion4El];
}

function selectedVersionCodes() {
  return versionSelectors().map((el) => el.value).filter(Boolean);
}

function selectedChapterRef() {
  const typed = chapterParallelRefEl.value.trim();
  if (typed) {
    return typed;
  }

  const currentVerse = verses.find((item) => item.id === selectedVerseId);
  if (!currentVerse) {
    return "Genesis:1";
  }

  const chapterAndBook = currentVerse.reference.split(":")[0];
  const space = chapterAndBook.lastIndexOf(" ");
  const book = chapterAndBook.slice(0, space);
  const chapter = chapterAndBook.slice(space + 1);
  return `${book}:${chapter}`;
}

function populateVersionSelectors(versions) {
  availableVersions = versions || [];
  const defaults = ["KJV", "ASV", "WEB", "YLT"];

  versionSelectors().forEach((selectEl, index) => {
    clearChildren(selectEl);

    availableVersions.forEach((version) => {
      const option = document.createElement("option");
      option.value = version.code;
      option.textContent = `${version.code} - ${version.name}`;
      if (defaults[index] === version.code) {
        option.selected = true;
      }
      selectEl.appendChild(option);
    });
  });
}

async function loadAvailableVersions() {
  const data = await fetchJson("/api/v1/versions");
  populateVersionSelectors(data.versions || []);
}

async function loadParallelView() {
  if (!selectedVerseId) {
    return;
  }

  const versions = selectedVersionCodes().slice(0, 4);
  const query = encodeURIComponent(versions.join(","));
  const data = await fetchJson(`/api/v1/scripture/parallel/${encodeURIComponent(selectedVerseId)}?versions=${query}`);

  clearChildren(parallelGridEl);
  data.panels.forEach((panel) => {
    const card = document.createElement("article");
    card.className = "parallel-card";
    card.innerHTML = `
      <h5>${panel.version} | ${panel.name}</h5>
      <p>${panel.text}</p>
    `;
    parallelGridEl.appendChild(card);
  });
}

async function loadChapterParallelView() {
  const versions = selectedVersionCodes().slice(0, 4);
  const versionQuery = encodeURIComponent(versions.join(","));
  const chapterRef = selectedChapterRef();
  const chapterQuery = encodeURIComponent(chapterRef);

  const data = await fetchJson(
    `/api/v1/scripture/parallel-chapter?chapterRef=${chapterQuery}&versions=${versionQuery}`
  );

  chapterParallelRefEl.value = data.chapterRef;
  clearChildren(chapterParallelGridEl);

  data.panels.forEach((panel) => {
    const card = document.createElement("article");
    card.className = "chapter-parallel-card";

    const versesHtml = panel.verses
      .map((entry) => {
        return `<p class="chapter-verse"><strong>${entry.reference}</strong><br/>${entry.text}</p>`;
      })
      .join("");

    card.innerHTML = `<h5>${panel.version} | ${panel.name}</h5>${versesHtml}`;
    chapterParallelGridEl.appendChild(card);
  });
}

async function runCrossVersionComparison() {
  if (!selectedVerseId) {
    crossVersionSummaryEl.textContent = "Select a verse first.";
    return;
  }

  const versions = selectedVersionCodes().slice(0, 4);
  const query = encodeURIComponent(versions.join(","));
  const data = await fetchJson(
    `/api/v1/scripture/cross-version/${encodeURIComponent(selectedVerseId)}?versions=${query}`
  );

  crossVersionSummaryEl.textContent = `${data.reference} compared across: ${data.comparedVersions.join(", ")}`;
  renderChips(crossVersionSharedEl, data.sharedLexicalCore || []);

  renderLibraryList(crossVersionTextListEl, data.versionTexts || [], (item) => {
    return `<h5>${item.version}</h5><p>${item.text}</p>`;
  });
}

function renderLibraryList(container, items, formatter) {
  clearChildren(container);

  if (!items || items.length === 0) {
    const li = document.createElement("li");
    li.className = "pattern-item";
    li.textContent = "No imported items yet.";
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

async function loadLibraryOverviewAndPackages() {
  const [overview, packages] = await Promise.all([
    fetchJson("/api/v1/library/overview"),
    fetchJson("/api/v1/library/packages")
  ]);

  const importedAt = overview.lastImportedAt
    ? new Date(overview.lastImportedAt).toLocaleString()
    : "never";

  accordanceStatusEl.textContent = `Library status: ${overview.counts.bibleListings} listings, ${overview.counts.modules} modules, ${overview.counts.historicResources} historical resources. Last import: ${importedAt}.`;

  renderLibraryList(bibleListingsListEl, packages.bibleListings, (item) => {
    return `<h5>${item.name}</h5><p class="meta">${item.abbreviation || "N/A"} | ${item.language} | ${item.testament}</p>`;
  });

  renderLibraryList(packageModulesListEl, packages.modules, (item) => {
    return `<h5>${item.name}</h5><p class="meta">${item.category} | package: ${item.package}</p>`;
  });
}

async function loadHistoricalResourcesForSelectedVerse() {
  if (!selectedVerseId) {
    return;
  }

  const data = await fetchJson(`/api/v1/library/historical/${encodeURIComponent(selectedVerseId)}`);
  renderLibraryList(historicalResourcesListEl, data.resources, (item) => {
    return `<h5>${item.title}</h5><p>${item.summary || "No summary provided."}</p><p class="meta">${item.period} | refs: ${(item.references || []).join(" | ")}</p>`;
  });
}

async function importAccordanceExport() {
  const raw = accordanceImportInputEl.value.trim();
  if (!raw) {
    accordanceStatusEl.textContent = "Library status: provide JSON payload first.";
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    accordanceStatusEl.textContent = "Library status: invalid JSON payload.";
    return;
  }

  await fetchJson("/api/v1/integrations/accordance/import", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...parsed,
      mode: importModeSelectEl.value
    })
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
  renderLibraryList(openHistoryListEl, data.resources || [], (item) => {
    return `<h5>${item.title}</h5><p class="meta">${item.author} | ${item.source}</p><p><a href="${item.url}" target="_blank" rel="noopener noreferrer">Open Source Link</a></p>`;
  });
}

searchInputEl.addEventListener("input", (event) => {
  const items = filteredVerses(event.target.value);
  renderVerseList(items);
});

unlockBtnEl.addEventListener("click", () => {
  unlockSelectedVerse().catch(() => {
    modeGuidanceEl.textContent = "Unlock failed. Try again.";
  });
});

runPatternBtnEl.addEventListener("click", () => {
  runPatternAnalysis().catch(() => {
    renderPatternFindings([]);
  });
});

patternScopeTypeEl.addEventListener("change", () => {
  patternScopeRefEl.value = defaultScopeRef(patternScopeTypeEl.value);
});

importAccordanceBtnEl.addEventListener("click", () => {
  importAccordanceExport().catch(() => {
    accordanceStatusEl.textContent = "Library status: import failed.";
  });
});

refreshLibraryBtnEl.addEventListener("click", () => {
  loadLibraryOverviewAndPackages()
    .then(() => loadHistoricalResourcesForSelectedVerse())
    .catch(() => {
      accordanceStatusEl.textContent = "Library status: refresh failed.";
    });
});

loadParallelBtnEl.addEventListener("click", () => {
  loadParallelView().catch(() => {
    clearChildren(parallelGridEl);
  });
});

loadChapterParallelBtnEl.addEventListener("click", () => {
  loadChapterParallelView().catch(() => {
    clearChildren(chapterParallelGridEl);
  });
});

runCrossVersionBtnEl.addEventListener("click", () => {
  runCrossVersionComparison().catch(() => {
    crossVersionSummaryEl.textContent = "Cross-version comparison failed.";
  });
});

versionSelectors().forEach((selectEl) => {
  selectEl.addEventListener("change", () => {
    loadParallelView().catch(() => {
      clearChildren(parallelGridEl);
    });
    loadChapterParallelView().catch(() => {
      clearChildren(chapterParallelGridEl);
    });
  });
});

accordanceFileInputEl.addEventListener("change", (event) => {
  const file = event.target.files && event.target.files[0];
  importAccordanceFromFile(file).catch(() => {
    accordanceStatusEl.textContent = "Library status: file import failed.";
  });
});

accordanceDropzoneEl.addEventListener("dragover", (event) => {
  event.preventDefault();
  accordanceDropzoneEl.classList.add("active");
});

accordanceDropzoneEl.addEventListener("dragleave", () => {
  accordanceDropzoneEl.classList.remove("active");
});

accordanceDropzoneEl.addEventListener("drop", (event) => {
  event.preventDefault();
  accordanceDropzoneEl.classList.remove("active");
  const file = event.dataTransfer.files && event.dataTransfer.files[0];
  importAccordanceFromFile(file).catch(() => {
    accordanceStatusEl.textContent = "Library status: dropped file import failed.";
  });
});

refreshHistoryBtnEl.addEventListener("click", () => {
  loadOpenSourceHistory().catch(() => {
    renderLibraryList(openHistoryListEl, [], () => "");
  });
});

loadVerseList().catch(() => {
  verseRefEl.textContent = "Load error";
  verseTextEl.textContent = "Could not load Scripture data.";
});

patternScopeRefEl.value = "Genesis:1";

loadLibraryOverviewAndPackages()
  .then(() => loadHistoricalResourcesForSelectedVerse())
  .catch(() => {
    accordanceStatusEl.textContent = "Library status: initial load failed.";
  });

loadAvailableVersions()
  .then(() => Promise.all([loadParallelView(), loadChapterParallelView()]))
  .catch(() => {
    clearChildren(parallelGridEl);
    clearChildren(chapterParallelGridEl);
  });

loadOpenSourceHistory().catch(() => {
  renderLibraryList(openHistoryListEl, [], () => "");
});
