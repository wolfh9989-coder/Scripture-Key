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

let verses = [];
let selectedVerseId = null;

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

searchInputEl.addEventListener("input", (event) => {
  const items = filteredVerses(event.target.value);
  renderVerseList(items);
});

unlockBtnEl.addEventListener("click", () => {
  unlockSelectedVerse().catch(() => {
    modeGuidanceEl.textContent = "Unlock failed. Try again.";
  });
});

loadVerseList().catch(() => {
  verseRefEl.textContent = "Load error";
  verseTextEl.textContent = "Could not load Scripture data.";
});
