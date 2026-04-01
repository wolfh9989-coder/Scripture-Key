const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const dataPath = path.join(__dirname, "data", "scripture-phase1.json");
const scriptureData = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
const accordanceBridgePath = path.join(__dirname, "data", "accordance-bridge.json");
const versionsPath = path.join(__dirname, "data", "bible-versions.json");
const versionData = JSON.parse(fs.readFileSync(versionsPath, "utf-8"));

function loadAccordanceBridgeData() {
  try {
    const raw = fs.readFileSync(accordanceBridgePath, "utf-8");
    const parsed = JSON.parse(raw);

    return {
      provider: "Accordance",
      lastImportedAt: parsed.lastImportedAt || null,
      bibleListings: Array.isArray(parsed.bibleListings) ? parsed.bibleListings : [],
      modules: Array.isArray(parsed.modules) ? parsed.modules : [],
      historicResources: Array.isArray(parsed.historicResources) ? parsed.historicResources : []
    };
  } catch (error) {
    return {
      provider: "Accordance",
      lastImportedAt: null,
      bibleListings: [],
      modules: [],
      historicResources: []
    };
  }
}

function saveAccordanceBridgeData(payload) {
  const safePayload = {
    provider: "Accordance",
    lastImportedAt: payload.lastImportedAt || null,
    bibleListings: Array.isArray(payload.bibleListings) ? payload.bibleListings : [],
    modules: Array.isArray(payload.modules) ? payload.modules : [],
    historicResources: Array.isArray(payload.historicResources) ? payload.historicResources : [],
    notes: [
      "This file stores user-imported metadata and resources exported by the account owner.",
      "Do not include copyrighted package content unless licensed for personal use and redistribution."
    ]
  };

  fs.writeFileSync(accordanceBridgePath, JSON.stringify(safePayload, null, 2), "utf-8");
}

let accordanceBridgeData = loadAccordanceBridgeData();

function normalizedString(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function mergeByKey(existing, incoming, keyFn) {
  const map = new Map();

  existing.forEach((item) => {
    map.set(keyFn(item), item);
  });

  incoming.forEach((item) => {
    map.set(keyFn(item), item);
  });

  return Array.from(map.values());
}

function getVersionMetadata(code) {
  return versionData.versions.find((item) => item.code === code);
}

function getVerseTextForVersion(verseId, versionCode, fallbackText) {
  const verseVersions = versionData.texts[verseId] || {};
  return verseVersions[versionCode] || fallbackText;
}

function buildParallelVersePayload(verseId, requestedVersions) {
  const verse = getVerseById(verseId);
  if (!verse) {
    return null;
  }

  const selectedVersions = requestedVersions
    .filter((code) => getVersionMetadata(code))
    .slice(0, 4);

  const versionsToUse = selectedVersions.length > 0 ? selectedVersions : ["KJV", "ASV", "WEB", "YLT"];

  return {
    verseId: verse.id,
    reference: verse.reference,
    panels: versionsToUse.map((code) => {
      const meta = getVersionMetadata(code);
      return {
        version: code,
        name: meta ? meta.name : code,
        text: getVerseTextForVersion(verse.id, code, verse.text),
        crossReferences: verse.crossReferences
      };
    })
  };
}

function tokenizeForComparison(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function buildVersionCrossReference(verseId, versions) {
  const verse = getVerseById(verseId);
  if (!verse) {
    return null;
  }

  const sanitized = versions.filter((code) => getVersionMetadata(code)).slice(0, 4);
  const versionsToUse = sanitized.length > 0 ? sanitized : ["KJV", "ASV", "WEB", "YLT"];

  const texts = versionsToUse.map((code) => ({
    version: code,
    text: getVerseTextForVersion(verse.id, code, verse.text)
  }));

  const tokenSets = texts.map((item) => ({
    version: item.version,
    tokens: new Set(tokenizeForComparison(item.text))
  }));

  const sharedTokens = tokenSets.length
    ? Array.from(tokenSets[0].tokens).filter((token) => tokenSets.every((set) => set.tokens.has(token)))
    : [];

  return {
    verseId: verse.id,
    reference: verse.reference,
    comparedVersions: versionsToUse,
    sharedLexicalCore: sharedTokens.slice(0, 24),
    versionTexts: texts,
    sourceCrossReferences: verse.crossReferences
  };
}

function getChapterVerses(book, chapter) {
  return scriptureData.verses.filter(
    (verse) => normalizedString(verse.book) === normalizedString(book) && verse.chapter === chapter
  );
}

function parseChapterReference(reference) {
  const raw = String(reference || "").trim();
  const parts = raw.split(":");
  if (parts.length !== 2) {
    return null;
  }

  const book = parts[0].trim();
  const chapter = Number(parts[1].trim());
  if (!book || Number.isNaN(chapter)) {
    return null;
  }

  return { book, chapter };
}

function getVerseById(verseId) {
  return scriptureData.verses.find((verse) => verse.id === verseId);
}

function getVerseByReference(reference) {
  const normalized = reference.trim().toLowerCase();
  return scriptureData.verses.find((verse) => verse.reference.toLowerCase() === normalized);
}

function findVersesByReferenceFragment(fragment) {
  const normalized = fragment.trim().toLowerCase();
  return scriptureData.verses.filter((verse) => verse.reference.toLowerCase().includes(normalized));
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function collectScopeVerses(scopeType, scopeRef) {
  if (scopeType === "verse") {
    const verse = getVerseById(scopeRef);
    return verse ? [verse] : [];
  }

  if (scopeType === "chapter") {
    const parts = (scopeRef || "").split(":");
    if (parts.length !== 2) {
      return [];
    }

    const book = parts[0].trim().toLowerCase();
    const chapter = Number(parts[1]);

    return scriptureData.verses.filter(
      (verse) => verse.book.toLowerCase() === book && verse.chapter === chapter
    );
  }

  if (scopeType === "book") {
    return scriptureData.verses.filter(
      (verse) => verse.book.toLowerCase() === String(scopeRef || "").toLowerCase()
    );
  }

  return scriptureData.verses;
}

function buildPhraseRepeats(verses) {
  const phraseCounts = {};

  verses.forEach((verse) => {
    const words = tokenize(verse.text);
    for (let size = 2; size <= 3; size += 1) {
      for (let i = 0; i <= words.length - size; i += 1) {
        const phrase = words.slice(i, i + size).join(" ");
        if (!phraseCounts[phrase]) {
          phraseCounts[phrase] = { count: 0, references: new Set() };
        }
        phraseCounts[phrase].count += 1;
        phraseCounts[phrase].references.add(verse.reference);
      }
    }
  });

  return Object.entries(phraseCounts)
    .filter(([, value]) => value.references.size > 1)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6)
    .map(([phrase, value]) => ({
      patternType: "phrase_repeat",
      finding: phrase,
      confidence: Math.min(0.95, 0.45 + value.count * 0.05),
      evidence: Array.from(value.references)
    }));
}

function buildNumericMotifs(verses) {
  const targets = [7, 12, 40];

  return targets
    .map((num) => {
      const matcher = new RegExp(`\\b${num}\\b`, "g");
      const hits = verses
        .filter((verse) => matcher.test(verse.text))
        .map((verse) => verse.reference);

      return {
        number: num,
        hits
      };
    })
    .filter((entry) => entry.hits.length > 0)
    .map((entry) => ({
      patternType: "numeric",
      finding: `Numeric motif ${entry.number}`,
      confidence: 0.8,
      evidence: entry.hits
    }));
}

function buildParallelThemes(verses) {
  const themeMap = {};

  verses.forEach((verse) => {
    verse.themes.forEach((theme) => {
      if (!themeMap[theme]) {
        themeMap[theme] = [];
      }
      themeMap[theme].push(verse.reference);
    });
  });

  return Object.entries(themeMap)
    .filter(([, refs]) => refs.length > 1)
    .slice(0, 8)
    .map(([theme, refs]) => ({
      patternType: "parallel",
      finding: `Theme parallel: ${theme}`,
      confidence: 0.77,
      evidence: refs
    }));
}

function buildChiasticCandidates(verses) {
  const candidates = verses
    .map((verse) => {
      const words = tokenize(verse.text).filter((word) => word.length > 3);
      if (words.length < 4) {
        return null;
      }

      const first = words[0];
      const last = words[words.length - 1];

      if (first === last) {
        return {
          patternType: "chiastic",
          finding: `Possible chiastic mirror in ${verse.reference}`,
          confidence: 0.61,
          evidence: [verse.reference]
        };
      }

      return null;
    })
    .filter(Boolean);

  return candidates.slice(0, 4);
}

function compareVerses(leftVerse, rightVerse) {
  const sharedThemes = leftVerse.themes.filter((theme) => rightVerse.themes.includes(theme));
  const sharedPeople = leftVerse.people.filter((person) => rightVerse.people.includes(person));

  return {
    left: mapSummary(leftVerse),
    right: mapSummary(rightVerse),
    similarities: {
      sharedThemes,
      sharedPeople,
      sharedCrossReferences: leftVerse.crossReferences.filter((ref) =>
        rightVerse.crossReferences.includes(ref)
      )
    },
    contrast: {
      leftPrimaryThemes: leftVerse.themes,
      rightPrimaryThemes: rightVerse.themes
    },
    commentary: `Comparison between ${leftVerse.reference} and ${rightVerse.reference} generated for study mode.`
  };
}

function handleBrcisQuery(content, mode) {
  const input = String(content || "").trim();
  const lower = input.toLowerCase();

  const compareMatch = lower.match(/compare\s+(.+?)\s+with\s+(.+)/i);
  if (compareMatch) {
    const leftCandidates = findVersesByReferenceFragment(compareMatch[1]);
    const rightCandidates = findVersesByReferenceFragment(compareMatch[2]);

    if (leftCandidates.length > 0 && rightCandidates.length > 0) {
      const result = compareVerses(leftCandidates[0], rightCandidates[0]);
      return {
        intent: "compare",
        answer: result.commentary,
        mode,
        supportingReferences: [result.left.reference, result.right.reference],
        data: result,
        alternateInterpretations: [
          "Evaluate each verse in its chapter context for fuller nuance.",
          "Track covenant continuity and discontinuity across both texts."
        ]
      };
    }
  }

  if (lower.includes("every time") || lower.includes("show me every")) {
    const faithSet = scriptureData.verses.filter((verse) =>
      verse.themes.some((theme) => ["faith", "trust", "belief"].includes(theme.toLowerCase()))
    );

    return {
      intent: "thematic_search",
      answer: `Found ${faithSet.length} verse candidates connected to faith/trust themes in the current dataset.`,
      mode,
      supportingReferences: faithSet.map((verse) => verse.reference),
      data: faithSet.map(mapSummary),
      alternateInterpretations: [
        "Expand dataset scope for a complete canon-level answer.",
        "Filter by direct sayings of Jesus in gospel passages only."
      ]
    };
  }

  const verseFromDirectRef = getVerseByReference(input);
  if (verseFromDirectRef) {
    return {
      intent: "verse_explain",
      answer: verseFromDirectRef.keyLayers.literal,
      mode,
      supportingReferences: [verseFromDirectRef.reference],
      data: {
        summary: mapSummary(verseFromDirectRef),
        historical: verseFromDirectRef.keyLayers.historical,
        symbolic: verseFromDirectRef.keyLayers.symbolic
      },
      alternateInterpretations: [
        "Review prophetic reading with cross-reference chain.",
        "Use devotional mode for personal reflection framing."
      ]
    };
  }

  return {
    intent: "generic_study",
    answer: "I can compare verses, explain a direct verse reference, or run thematic searches from the current Phase 2 dataset.",
    mode,
    supportingReferences: [],
    data: null,
    alternateInterpretations: []
  };
}

function mapSummary(verse) {
  return {
    id: verse.id,
    reference: verse.reference,
    text: verse.text,
    themes: verse.themes,
    people: verse.people,
    events: verse.events
  };
}

const CANON_TRADITIONS = {
  protestant: [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
    "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
    "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
    "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi", "Matthew", "Mark",
    "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians",
    "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter",
    "1 John", "2 John", "3 John", "Jude", "Revelation"
  ],
  catholic: [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
    "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Tobit", "Judith", "Esther", "1 Maccabees",
    "2 Maccabees", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Wisdom", "Sirach", "Isaiah", "Jeremiah",
    "Lamentations", "Baruch", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk",
    "Zephaniah", "Haggai", "Zechariah", "Malachi", "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians",
    "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy",
    "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
  ],
  orthodox: ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Psalms", "Isaiah", "Daniel", "Matthew", "Luke", "John", "Acts", "Romans", "Revelation"],
  ethiopian: ["Genesis", "Exodus", "Psalms", "Isaiah", "Daniel", "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "Revelation"],
  hebrew: ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Samuel", "Kings", "Isaiah", "Jeremiah", "Ezekiel", "Psalms", "Proverbs"]
};

const TIMELINE_TYPES = [
  "biblical_event_timeline",
  "kings_and_prophets",
  "life_of_messiah",
  "exodus_to_exile",
  "church_timeline",
  "intertestamental",
  "prophecy_fulfillment",
  "canon_and_manuscript",
  "parallel_empires"
];

const HISTORY_LENSES = [
  "biblical_event_history",
  "ancient_near_east",
  "second_temple",
  "roman_era",
  "church_history",
  "manuscript_history",
  "canon_formation",
  "archaeology_material_culture",
  "israel_judah_timeline",
  "intertestamental_history"
];

const CONCORDANCE_TYPES = [
  "strongs",
  "hebrew_root",
  "greek_root",
  "topical",
  "cross_reference",
  "person_place",
  "prophecy",
  "thematic",
  "word_frequency"
];

function inferPlacesByVerse(verse) {
  const book = normalizedString(verse.book);
  if (book === "genesis") {
    return ["Eden", "Canaan"];
  }
  if (book === "exodus") {
    return ["Egypt", "Goshen"];
  }
  if (book === "psalms") {
    return ["Jerusalem", "Zion"];
  }
  if (book === "john") {
    return ["Judea", "Galilee"];
  }
  if (book === "romans") {
    return ["Rome"];
  }
  if (book === "1 corinthians") {
    return ["Corinth"];
  }
  if (book === "revelation") {
    return ["Patmos", "Asia Minor"];
  }
  return [];
}

function uniqueStrings(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

function buildContextRibbon(verse) {
  const lower = normalizedString(verse.book);

  const defaults = [
    "Version",
    "Canon",
    "Book",
    "Concordance",
    "History",
    "Timeline",
    "Maps",
    "Compare",
    "Notes",
    "Cross References",
    "Unlock"
  ];

  if (lower === "genesis") {
    return defaults.concat(["Creation Timeline", "Patriarch Map", "Hebrew Tools"]);
  }
  if (lower === "daniel") {
    return defaults.concat(["Empire Timeline", "Prophecy Focus", "Historical Context"]);
  }
  if (lower === "revelation") {
    return defaults.concat(["Symbolic Study", "Timeline Overlay", "Prophecy Links"]);
  }
  if (lower === "isaiah") {
    return defaults.concat(["Kings of Judah", "Assyrian Context", "Prophetic Era"]);
  }
  if (lower === "acts") {
    return defaults.concat(["Missionary Journeys", "Roman Context", "Church Expansion"]);
  }

  return defaults;
}

const LIVING_WORD_MODELS = {
  pure_scripture: "Returns scripture quotations and references only.",
  scripture_explanation: "Returns scripture quotations with concise anchored explanation.",
  living_voice: "Returns a unified pastoral tone while explicitly citing scripture references."
};

function scoreVerseForQuery(verse, normalizedQuery) {
  let score = 0;
  const fields = [
    verse.reference,
    verse.text,
    ...(verse.themes || []),
    ...(verse.people || []),
    ...(verse.events || []),
    ...((verse.keyLayers && verse.keyLayers.connections) || [])
  ]
    .map((item) => normalizedString(item))
    .join(" ");

  normalizedQuery.split(/\s+/).forEach((token) => {
    if (token && fields.includes(token)) {
      score += 1;
    }
  });

  if (normalizedQuery.includes("fear") && (verse.themes || []).includes("fear")) {
    score += 2;
  }
  if (normalizedQuery.includes("salvation") && (verse.themes || []).includes("salvation")) {
    score += 2;
  }
  if (normalizedQuery.includes("works") && (verse.themes || []).includes("works")) {
    score += 2;
  }
  if (normalizedQuery.includes("faith") && (verse.themes || []).includes("faith")) {
    score += 2;
  }
  if (normalizedQuery.includes("grace") && (verse.themes || []).includes("grace")) {
    score += 2;
  }

  return score;
}

function rankedVersesForQuery(query) {
  const normalized = normalizedString(query);
  const withScore = scriptureData.verses
    .map((verse) => ({ verse, score: scoreVerseForQuery(verse, normalized) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (withScore.length > 0) {
    return withScore.map((entry) => entry.verse);
  }

  return scriptureData.verses.slice(0, 5);
}

function buildContextGuardPayload(verse) {
  const chapterVerses = scriptureData.verses
    .filter((item) => item.book === verse.book && item.chapter === verse.chapter)
    .sort((a, b) => a.verse - b.verse);

  const currentIndex = chapterVerses.findIndex((item) => item.id === verse.id);
  if (currentIndex === -1) {
    return { warning: "Context unavailable for this verse in the current dataset.", context: [] };
  }

  const before = chapterVerses[currentIndex - 1];
  const after = chapterVerses[currentIndex + 1];
  const context = [before, chapterVerses[currentIndex], after]
    .filter(Boolean)
    .map((item) => ({ reference: item.reference, text: item.text }));

  return {
    warning: context.length < 3 ? "Limited chapter context in current dataset." : "Context window loaded.",
    context
  };
}

function formatLivingWordResponse(query, mode, verses, correctionMode) {
  const modeKey = Object.keys(LIVING_WORD_MODELS).includes(mode) ? mode : "scripture_explanation";
  const picks = verses.slice(0, Math.max(3, Math.min(6, verses.length)));

  if (modeKey === "pure_scripture") {
    return {
      responseText: picks.map((v) => `\"${v.text}\" (${v.reference})`).join("\n"),
      style: LIVING_WORD_MODELS[modeKey]
    };
  }

  if (modeKey === "living_voice") {
    const stitched = picks
      .map((v) => `${v.text} (${v.reference})`)
      .join(" ");

    return {
      responseText: `Scripture-centered synthesis: ${stitched}`,
      style: LIVING_WORD_MODELS[modeKey]
    };
  }

  const summary = picks
    .map((v) => `${v.reference} emphasizes ${v.themes.slice(0, 2).join("/") || "core truth"}`)
    .join("; ");

  const correctionNote = correctionMode
    ? "Correction/Alignment Mode active: response balances related passages where needed."
    : "";

  return {
    responseText: `${summary}. ${correctionNote}`.trim(),
    style: LIVING_WORD_MODELS[modeKey]
  };
}

function buildBookCatalogFromLoadedVerses() {
  const byBook = new Map();

  scriptureData.verses.forEach((verse) => {
    if (!byBook.has(verse.book)) {
      const testament = ["Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "Revelation"].includes(verse.book)
        ? "New Testament"
        : "Old Testament";

      let section = "Historical Books";
      if (["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy"].includes(verse.book)) {
        section = "Torah";
      }
      if (["Psalms", "Proverbs", "Job", "Ecclesiastes", "Song of Solomon"].includes(verse.book)) {
        section = "Wisdom Books";
      }
      if (["Isaiah", "Jeremiah", "Ezekiel", "Daniel"].includes(verse.book)) {
        section = "Major Prophets";
      }
      if (["Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi"].includes(verse.book)) {
        section = "Minor Prophets";
      }
      if (["Matthew", "Mark", "Luke", "John"].includes(verse.book)) {
        section = "Gospels";
      }
      if (["Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon"].includes(verse.book)) {
        section = "Letters";
      }
      if (["James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Hebrews"].includes(verse.book)) {
        section = "General Epistles";
      }

      byBook.set(verse.book, {
        book: verse.book,
        testament,
        section,
        canonicalTraditions: Object.keys(CANON_TRADITIONS).filter((key) => CANON_TRADITIONS[key].includes(verse.book)),
        timelinePeriod: testament === "Old Testament" ? "Ancient Israel Era" : "Second Temple and Early Church Era"
      });
    }
  });

  return Array.from(byBook.values()).sort((a, b) => a.book.localeCompare(b.book));
}

const BOOK_CATALOG = buildBookCatalogFromLoadedVerses();

app.get("/api/v1/scripture", (req, res) => {
  const summaries = scriptureData.verses.map(mapSummary);
  res.json({ verses: summaries });
});

app.get("/api/v1/system/catalog", (req, res) => {
  return res.json({
    concordanceTypes: CONCORDANCE_TYPES,
    historyLenses: HISTORY_LENSES,
    timelineTypes: TIMELINE_TYPES,
    canonTraditions: Object.keys(CANON_TRADITIONS),
    studyModes: ["reader", "study", "scholar", "devotional", "timeline", "connection"]
  });
});

app.get("/api/v1/books", (req, res) => {
  const mode = String(req.query.mode || "standard");
  const canonTradition = String(req.query.canonTradition || "protestant");

  if (mode === "canon") {
    return res.json({
      mode,
      tradition: canonTradition,
      books: BOOK_CATALOG.filter((item) => item.canonicalTraditions.includes(canonTradition))
    });
  }

  if (mode === "timeline") {
    const byPeriod = {};
    BOOK_CATALOG.forEach((book) => {
      if (!byPeriod[book.timelinePeriod]) {
        byPeriod[book.timelinePeriod] = [];
      }
      byPeriod[book.timelinePeriod].push(book);
    });

    return res.json({ mode, groups: byPeriod });
  }

  const bySection = {};
  BOOK_CATALOG.forEach((book) => {
    if (!bySection[book.section]) {
      bySection[book.section] = [];
    }
    bySection[book.section].push(book);
  });

  return res.json({ mode, groups: bySection });
});

app.get("/api/v1/search/advanced", (req, res) => {
  const q = normalizedString(req.query.q);
  if (!q) {
    return res.json({
      verses: [],
      books: [],
      people: [],
      places: [],
      themes: [],
      events: [],
      prophecyLinks: [],
      originalWords: [],
      timelines: []
    });
  }

  const matchedVerses = scriptureData.verses.filter((verse) => {
    return (
      normalizedString(verse.reference).includes(q) ||
      normalizedString(verse.text).includes(q) ||
      verse.themes.some((item) => normalizedString(item).includes(q)) ||
      verse.people.some((item) => normalizedString(item).includes(q)) ||
      verse.events.some((item) => normalizedString(item).includes(q))
    );
  });

  const books = BOOK_CATALOG.filter((book) => normalizedString(book.book).includes(q));
  const people = uniqueStrings(matchedVerses.flatMap((verse) => verse.people)).filter((item) => normalizedString(item).includes(q));
  const places = uniqueStrings(matchedVerses.flatMap((verse) => inferPlacesByVerse(verse))).filter((item) => normalizedString(item).includes(q));
  const themes = uniqueStrings(matchedVerses.flatMap((verse) => verse.themes)).filter((item) => normalizedString(item).includes(q));
  const events = uniqueStrings(matchedVerses.flatMap((verse) => verse.events)).filter((item) => normalizedString(item).includes(q));
  const prophecyLinks = uniqueStrings(matchedVerses.flatMap((verse) => verse.keyLayers.connections || [])).filter((item) => normalizedString(item).includes(q));
  const originalWords = uniqueStrings(
    matchedVerses.flatMap((verse) => (verse.original.strongs || []).map((entry) => `${entry.number} ${entry.lemma}`))
  ).filter((item) => normalizedString(item).includes(q));
  const timelines = uniqueStrings(matchedVerses.flatMap((verse) => verse.contextTimeline || [])).filter((item) => normalizedString(item).includes(q));

  return res.json({
    verses: matchedVerses.map(mapSummary),
    books,
    people,
    places,
    themes,
    events,
    prophecyLinks,
    originalWords,
    timelines
  });
});

app.get("/api/v1/context/ribbon/:verseId", (req, res) => {
  const verse = getVerseById(req.params.verseId);
  if (!verse) {
    return res.status(404).json({ error: "Verse not found" });
  }

  return res.json({
    verseId: verse.id,
    reference: verse.reference,
    tools: buildContextRibbon(verse)
  });
});

app.post("/api/v1/living-word/respond", (req, res) => {
  const {
    query = "",
    responseMode = "scripture_explanation",
    correctionMode = false,
    minSupportVerses = 3,
    contextGuard = true,
    strictCitationEnforcement = false
  } = req.body || {};

  const ranked = rankedVersesForQuery(query);
  const supportCount = Math.max(2, Number(minSupportVerses) || 3);
  const selectedVerses = ranked.slice(0, Math.max(supportCount, 3));

  const formatted = formatLivingWordResponse(query, responseMode, selectedVerses, correctionMode);

  const contextWindows = contextGuard
    ? selectedVerses.slice(0, 3).map((verse) => ({
        reference: verse.reference,
        ...buildContextGuardPayload(verse)
      }))
    : [];

  if (strictCitationEnforcement && selectedVerses.length < supportCount) {
    return res.status(422).json({
      error: "Strict citation enforcement failed.",
      requiredCitations: supportCount,
      foundCitations: selectedVerses.length,
      designBoundary:
        "Scripture remains the authority. This tool does not provide new revelation and does not replace Scripture.",
      citations: selectedVerses.map((verse) => verse.reference)
    });
  }

  return res.json({
    designBoundary:
      "Scripture remains the authority. This tool does not provide new revelation and does not replace Scripture.",
    query,
    responseMode,
    correctionMode,
    contextGuard,
    responseText: formatted.responseText,
    responseStyle: formatted.style,
    supportVerses: selectedVerses.map((verse) => ({
      id: verse.id,
      reference: verse.reference,
      text: verse.text,
      themes: verse.themes
    })),
    citations: selectedVerses.map((verse) => verse.reference),
    contextWindows
  });
});

app.get("/api/v1/versions", (req, res) => {
  return res.json({
    versions: versionData.versions,
    note:
      "Includes public-domain/open resources by default. Additional licensed versions can be imported through your own data pipelines."
  });
});

app.get("/api/v1/scripture/parallel/:verseId", (req, res) => {
  const requestedVersions = String(req.query.versions || "")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);

  const payload = buildParallelVersePayload(req.params.verseId, requestedVersions);
  if (!payload) {
    return res.status(404).json({ error: "Verse not found" });
  }

  return res.json(payload);
});

app.get("/api/v1/scripture/cross-version/:verseId", (req, res) => {
  const requestedVersions = String(req.query.versions || "")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);

  const payload = buildVersionCrossReference(req.params.verseId, requestedVersions);
  if (!payload) {
    return res.status(404).json({ error: "Verse not found" });
  }

  return res.json(payload);
});

app.get("/api/v1/scripture/parallel-chapter", (req, res) => {
  const chapterRef = String(req.query.chapterRef || "");
  const parsed = parseChapterReference(chapterRef);

  if (!parsed) {
    return res.status(400).json({ error: "chapterRef must be formatted as Book:Chapter" });
  }

  const requestedVersions = String(req.query.versions || "")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);

  const selectedVersions = requestedVersions
    .filter((code) => getVersionMetadata(code))
    .slice(0, 4);

  const versionsToUse = selectedVersions.length > 0 ? selectedVersions : ["KJV", "ASV", "WEB", "YLT"];
  const chapterVerses = getChapterVerses(parsed.book, parsed.chapter);

  if (chapterVerses.length === 0) {
    return res.status(404).json({ error: "No verses found for requested chapter" });
  }

  return res.json({
    chapterRef: `${parsed.book}:${parsed.chapter}`,
    verseCount: chapterVerses.length,
    panels: versionsToUse.map((code) => {
      const meta = getVersionMetadata(code);
      return {
        version: code,
        name: meta ? meta.name : code,
        verses: chapterVerses.map((verse) => ({
          verseId: verse.id,
          reference: verse.reference,
          text: getVerseTextForVersion(verse.id, code, verse.text)
        }))
      };
    })
  });
});

app.get("/api/v1/scripture/:verseId", (req, res) => {
  const verse = getVerseById(req.params.verseId);

  if (!verse) {
    return res.status(404).json({ error: "Verse not found" });
  }

  return res.json({ verse });
});

app.post("/api/v1/scripture/unlock", (req, res) => {
  const { verseId, mode = "study", includeGraph = true } = req.body;
  const verse = getVerseById(verseId);

  if (!verse) {
    return res.status(404).json({ error: "Verse not found" });
  }

  const relatedVerses = verse.relatedVerseIds
    .map((id) => getVerseById(id))
    .filter(Boolean)
    .map((related) => ({
      id: related.id,
      reference: related.reference,
      text: related.text
    }));

  const confidence = {
    literal: 0.94,
    historical: 0.86,
    prophetic: 0.71,
    symbolic: 0.78
  };

  const modeGuidance = {
    beginner: "Language simplified with practical clarity.",
    study: "Balanced textual and contextual detail.",
    deep: "Nuanced theological framing and alternatives.",
    devotional: "Reflection-forward and spiritually formative tone."
  };

  return res.json({
    verseId: verse.id,
    mode,
    modeGuidance: modeGuidance[mode] || modeGuidance.study,
    layers: verse.keyLayers,
    relatedVerses,
    evidence: {
      crossReferences: verse.crossReferences,
      timeline: verse.contextTimeline
    },
    confidence,
    graph: includeGraph
      ? {
          node: verse.reference,
          themes: verse.themes,
          people: verse.people,
          events: verse.events
        }
      : null
  });
});

app.get("/api/v1/graph/theme/:theme", (req, res) => {
  const theme = req.params.theme.toLowerCase();
  const verses = scriptureData.verses.filter((verse) =>
    verse.themes.some((item) => item.toLowerCase() === theme)
  );

  return res.json({
    theme: req.params.theme,
    nodes: verses.map((verse) => ({ id: verse.id, label: verse.reference })),
    edges: verses.slice(1).map((verse, index) => ({
      from: verses[index].id,
      to: verse.id,
      type: "THEME_OF"
    }))
  });
});

app.post("/api/v1/compare", (req, res) => {
  const { leftVerseId, rightVerseId } = req.body;
  const leftVerse = getVerseById(leftVerseId);
  const rightVerse = getVerseById(rightVerseId);

  if (!leftVerse || !rightVerse) {
    return res.status(404).json({ error: "One or both verses not found" });
  }

  return res.json(compareVerses(leftVerse, rightVerse));
});

app.post("/api/v1/patterns/analyze", (req, res) => {
  const {
    scopeType = "corpus",
    scopeRef = "",
    patternTypes = ["phrase_repeat", "numeric", "chiastic", "parallel"]
  } = req.body;

  const scopeVerses = collectScopeVerses(scopeType, scopeRef);

  if (scopeVerses.length === 0) {
    return res.status(404).json({ error: "No verses found for requested scope" });
  }

  let findings = [];

  if (patternTypes.includes("phrase_repeat")) {
    findings = findings.concat(buildPhraseRepeats(scopeVerses));
  }
  if (patternTypes.includes("numeric")) {
    findings = findings.concat(buildNumericMotifs(scopeVerses));
  }
  if (patternTypes.includes("chiastic")) {
    findings = findings.concat(buildChiasticCandidates(scopeVerses));
  }
  if (patternTypes.includes("parallel")) {
    findings = findings.concat(buildParallelThemes(scopeVerses));
  }

  return res.json({
    scopeType,
    scopeRef,
    findings,
    analyzedVerseCount: scopeVerses.length
  });
});

app.post("/api/v1/brcis/query", (req, res) => {
  const { content = "", mode = "study" } = req.body;
  return res.json(handleBrcisQuery(content, mode));
});

app.get("/api/v1/timeline/events", (req, res) => {
  const events = scriptureData.verses.flatMap((verse) =>
    verse.contextTimeline.map((point, index) => ({
      reference: verse.reference,
      sequence: index + 1,
      point
    }))
  );

  return res.json({ events });
});

app.get("/api/v1/integrations/accordance/capabilities", (req, res) => {
  return res.json({
    provider: "Accordance",
    integrationMode: "user-export-import",
    licensingNote:
      "Scripture Key imports user-owned export data. Proprietary content must remain within your license rights.",
    capabilities: [
      "Bible listings import",
      "Library modules and package cataloging",
      "Historical resources linked to verse references",
      "Cross-reference style metadata ingestion",
      "Original-language support mapping"
    ]
  });
});

app.get("/api/v1/library/overview", (req, res) => {
  return res.json({
    provider: accordanceBridgeData.provider,
    lastImportedAt: accordanceBridgeData.lastImportedAt,
    counts: {
      bibleListings: accordanceBridgeData.bibleListings.length,
      modules: accordanceBridgeData.modules.length,
      historicResources: accordanceBridgeData.historicResources.length
    }
  });
});

app.get("/api/v1/library/packages", (req, res) => {
  return res.json({
    modules: accordanceBridgeData.modules,
    bibleListings: accordanceBridgeData.bibleListings
  });
});

app.get("/api/v1/library/open-source-history", (req, res) => {
  return res.json({
    resources: versionData.openSourceHistoryBooks,
    note: "External links are provided for open-source/public resources."
  });
});

app.get("/api/v1/library/historical/:verseId", (req, res) => {
  const verse = getVerseById(req.params.verseId);
  if (!verse) {
    return res.status(404).json({ error: "Verse not found" });
  }

  const resources = accordanceBridgeData.historicResources.filter((item) => {
    const references = Array.isArray(item.references) ? item.references : [];
    return references.some((ref) => {
      const norm = normalizedString(ref);
      return norm === normalizedString(verse.id) || norm === normalizedString(verse.reference);
    });
  });

  return res.json({ verse: verse.reference, resources });
});

app.post("/api/v1/integrations/accordance/import", (req, res) => {
  const {
    bibleListings = [],
    modules = [],
    historicResources = [],
    mode = "merge"
  } = req.body || {};

  const safeBibleListings = Array.isArray(bibleListings)
    ? bibleListings
        .filter((item) => item && item.name)
        .map((item) => ({
          name: String(item.name),
          language: String(item.language || "unknown"),
          testament: String(item.testament || "both"),
          abbreviation: String(item.abbreviation || "")
        }))
    : [];

  const safeModules = Array.isArray(modules)
    ? modules
        .filter((item) => item && item.name)
        .map((item) => ({
          name: String(item.name),
          category: String(item.category || "study"),
          package: String(item.package || "user-import"),
          source: String(item.source || "Accordance export")
        }))
    : [];

  const safeHistoricResources = Array.isArray(historicResources)
    ? historicResources
        .filter((item) => item && item.title)
        .map((item) => ({
          title: String(item.title),
          period: String(item.period || "unspecified"),
          summary: String(item.summary || ""),
          references: Array.isArray(item.references)
            ? item.references.map((ref) => String(ref))
            : []
        }))
    : [];

  if (mode === "replace") {
    accordanceBridgeData = {
      provider: "Accordance",
      lastImportedAt: new Date().toISOString(),
      bibleListings: safeBibleListings,
      modules: safeModules,
      historicResources: safeHistoricResources
    };
  } else {
    accordanceBridgeData = {
      provider: "Accordance",
      lastImportedAt: new Date().toISOString(),
      bibleListings: mergeByKey(
        accordanceBridgeData.bibleListings,
        safeBibleListings,
        (item) => `${normalizedString(item.name)}|${normalizedString(item.abbreviation)}`
      ),
      modules: mergeByKey(
        accordanceBridgeData.modules,
        safeModules,
        (item) => `${normalizedString(item.name)}|${normalizedString(item.category)}`
      ),
      historicResources: mergeByKey(
        accordanceBridgeData.historicResources,
        safeHistoricResources,
        (item) => `${normalizedString(item.title)}|${normalizedString(item.period)}`
      )
    };
  }

  saveAccordanceBridgeData(accordanceBridgeData);

  return res.json({
    message: "Accordance export imported successfully.",
    lastImportedAt: accordanceBridgeData.lastImportedAt,
    counts: {
      bibleListings: accordanceBridgeData.bibleListings.length,
      modules: accordanceBridgeData.modules.length,
      historicResources: accordanceBridgeData.historicResources.length
    }
  });
});

// ── DISCOVERY ENGINE DATA ──────────────────────────────────────────────

const CANONICAL_BOOK_ORDER = {
  Genesis: 1, Exodus: 2, Leviticus: 3, Numbers: 4, Deuteronomy: 5,
  Joshua: 6, Judges: 7, Ruth: 8, "1 Samuel": 9, "2 Samuel": 10,
  "1 Kings": 11, "2 Kings": 12, "1 Chronicles": 13, "2 Chronicles": 14,
  Ezra: 15, Nehemiah: 16, Esther: 17, Job: 18, Psalms: 19,
  Proverbs: 20, Ecclesiastes: 21, "Song of Solomon": 22, Isaiah: 23,
  Jeremiah: 24, Lamentations: 25, Ezekiel: 26, Daniel: 27, Hosea: 28,
  Joel: 29, Amos: 30, Obadiah: 31, Jonah: 32, Micah: 33,
  Nahum: 34, Habakkuk: 35, Zephaniah: 36, Haggai: 37, Zechariah: 38,
  Malachi: 39, Matthew: 40, Mark: 41, Luke: 42, John: 43, Acts: 44,
  Romans: 45, "1 Corinthians": 46, "2 Corinthians": 47, Galatians: 48,
  Ephesians: 49, Philippians: 50, Colossians: 51, "1 Thessalonians": 52,
  "2 Thessalonians": 53, "1 Timothy": 54, "2 Timothy": 55, Titus: 56,
  Philemon: 57, Hebrews: 58, James: 59, "1 Peter": 60, "2 Peter": 61,
  "1 John": 62, "2 John": 63, "3 John": 64, Jude: 65, Revelation: 66
};

const BIBLICAL_ERA_MAP = {
  Genesis: "Creation & Patriarchs", Exodus: "Torah & Law", Leviticus: "Torah & Law",
  Numbers: "Torah & Law", Deuteronomy: "Torah & Law", Joshua: "Conquest & Settlement",
  Judges: "Judges Era", Ruth: "Judges Era", "1 Samuel": "United Kingdom",
  "2 Samuel": "United Kingdom", "1 Kings": "Divided Kingdom", "2 Kings": "Divided Kingdom",
  "1 Chronicles": "Historical Record", "2 Chronicles": "Historical Record",
  Ezra: "Return from Exile", Nehemiah: "Return from Exile", Esther: "Diaspora",
  Job: "Wisdom Literature", Psalms: "Wisdom Literature", Proverbs: "Wisdom Literature",
  Ecclesiastes: "Wisdom Literature", "Song of Solomon": "Wisdom Literature",
  Isaiah: "Major Prophets", Jeremiah: "Major Prophets", Lamentations: "Major Prophets",
  Ezekiel: "Major Prophets", Daniel: "Major Prophets",
  Hosea: "Minor Prophets", Joel: "Minor Prophets", Amos: "Minor Prophets",
  Obadiah: "Minor Prophets", Jonah: "Minor Prophets", Micah: "Minor Prophets",
  Nahum: "Minor Prophets", Habakkuk: "Minor Prophets", Zephaniah: "Minor Prophets",
  Haggai: "Minor Prophets", Zechariah: "Minor Prophets", Malachi: "Minor Prophets",
  Matthew: "Gospels", Mark: "Gospels", Luke: "Gospels", John: "Gospels",
  Acts: "Early Church", Romans: "Apostolic Letters", "1 Corinthians": "Apostolic Letters",
  "2 Corinthians": "Apostolic Letters", Galatians: "Apostolic Letters",
  Ephesians: "Apostolic Letters", Philippians: "Apostolic Letters",
  Colossians: "Apostolic Letters", "1 Thessalonians": "Apostolic Letters",
  "2 Thessalonians": "Apostolic Letters", "1 Timothy": "Apostolic Letters",
  "2 Timothy": "Apostolic Letters", Titus: "Apostolic Letters", Philemon: "Apostolic Letters",
  Hebrews: "General Epistles", James: "General Epistles", "1 Peter": "General Epistles",
  "2 Peter": "General Epistles", "1 John": "General Epistles", "2 John": "General Epistles",
  "3 John": "General Epistles", Jude: "General Epistles", Revelation: "Apocalyptic"
};

const BOOK_PURPOSE_MAP = {
  Genesis: "Origins of creation, humanity, sin, and God's covenant promise.",
  Exodus: "God's deliverance of Israel from Egypt; the Mosaic covenant and law.",
  Leviticus: "Holiness laws and the sacrificial system — atonement framework.",
  Psalms: "Israel's prayer and worship book; honest human expression toward God.",
  Proverbs: "Practical wisdom for daily godly living in covenant community.",
  Isaiah: "Judgment, comfort, and messianic hope — most quoted OT book in the NT.",
  Micah: "Justice and mercy; precise prophecy of Messiah's birthplace.",
  John: "The identity and mission of Jesus as divine Word and Son of God.",
  Romans: "The gospel's theological foundation; justification by faith through grace.",
  "1 Corinthians": "Correction and instruction for a divided, gifted church.",
  Ephesians: "The church as body of Christ; grace, unity, and spiritual warfare.",
  Hebrews: "Christ as the high priest and fulfillment of the Levitical system.",
  James: "Practical faith lived out in deeds, speech, and community.",
  Revelation: "Prophetic vision of Messiah's ultimate victory; comfort for suffering churches."
};

const COMMONLY_MISQUOTED = new Set([
  "JER.29.11", "PHI.4.13", "MAT.18.20", "ROM.8.28",
  "JHN.3.16", "PRO.3.5", "ISA.41.10"
]);

const PROPHECY_FULFILLMENT_PAIRS = [
  {
    id: "seed-of-woman",
    shortTitle: "Seed of the Woman",
    category: "messianic",
    prophecyVerseId: "GEN.3.15",
    prophecyReference: "Genesis 3:15",
    prophecyText: "he shall bruise your head, and you shall bruise his heel.",
    fulfillmentVerseId: "JHN.1.29",
    fulfillmentReference: "John 1:29",
    fulfillmentText: "Behold, the Lamb of God, who takes away the sin of the world!",
    fulfillmentStatus: "complete",
    partialFulfillment: null,
    futureImplication: "The ultimate defeat of death and the enemy is consummated in Revelation 21.",
    notes: "The Protoevangelium — the first messianic promise in Scripture."
  },
  {
    id: "passover-to-messiah",
    shortTitle: "Passover → Christ Our Passover",
    category: "typological",
    prophecyVerseId: "EXO.12.13",
    prophecyReference: "Exodus 12:13",
    prophecyText: "The blood shall be a sign for you on the houses where you are.",
    fulfillmentVerseId: "1CO.5.7",
    fulfillmentReference: "1 Corinthians 5:7",
    fulfillmentText: "For Christ, our Passover lamb, has been sacrificed.",
    fulfillmentStatus: "complete",
    partialFulfillment: null,
    futureImplication: "Passover becomes the template for understanding Messiah's once-for-all sacrifice.",
    notes: "Paul explicitly draws the Passover → Christ typology in 1 Corinthians 5."
  },
  {
    id: "blood-atonement",
    shortTitle: "Blood Makes Atonement → Messiah's Blood",
    category: "typological",
    prophecyVerseId: "LEV.17.11",
    prophecyReference: "Leviticus 17:11",
    prophecyText: "It is the blood that makes atonement by the life.",
    fulfillmentVerseId: "JHN.1.29",
    fulfillmentReference: "John 1:29",
    fulfillmentText: "Behold, the Lamb of God, who takes away the sin of the world!",
    fulfillmentStatus: "complete",
    partialFulfillment: null,
    futureImplication: "Hebrews 9:22 confirms: without the shedding of blood there is no forgiveness.",
    notes: "The Levitical principle that blood = life is fulfilled in Messiah's sacrificial death."
  },
  {
    id: "suffering-servant",
    shortTitle: "Isaiah's Suffering Servant",
    category: "messianic",
    prophecyVerseId: "ISA.53.5",
    prophecyReference: "Isaiah 53:5",
    prophecyText: "But he was pierced for our transgressions; he was crushed for our iniquities.",
    fulfillmentVerseId: "1CO.15.3",
    fulfillmentReference: "1 Corinthians 15:3",
    fulfillmentText: "Christ died for our sins in accordance with the Scriptures.",
    fulfillmentStatus: "complete",
    partialFulfillment: null,
    futureImplication: "The healing promised ('with his wounds we are healed') is completed in the new creation.",
    notes: "Written 700+ years before the crucifixion. The most cited OT passage in the New Testament."
  },
  {
    id: "bethlehem-ruler",
    shortTitle: "King from Bethlehem",
    category: "messianic",
    prophecyVerseId: "MIC.5.2",
    prophecyReference: "Micah 5:2",
    prophecyText: "From you shall come forth for me one who is to be ruler in Israel, whose coming forth is from of old, from ancient days.",
    fulfillmentVerseId: "JHN.1.1",
    fulfillmentReference: "John 1:1",
    fulfillmentText: "In the beginning was the Word, and the Word was with God, and the Word was God.",
    fulfillmentStatus: "complete",
    partialFulfillment: "Historical birth in Bethlehem (fulfilled, nativity narratives).",
    futureImplication: "The 'ancient days' origin affirms Messiah's eternal, divine pre-existence.",
    notes: "Given 700 years before the birth. The eternal origins clause points beyond geography to divinity."
  },
  {
    id: "faith-counted-righteousness",
    shortTitle: "Abraham's Faith Pattern",
    category: "doctrinal",
    prophecyVerseId: "GEN.15.6",
    prophecyReference: "Genesis 15:6",
    prophecyText: "And he believed the LORD, and he counted it to him as righteousness.",
    fulfillmentVerseId: "EPH.2.8",
    fulfillmentReference: "Ephesians 2:8",
    fulfillmentText: "For by grace you have been saved through faith. And this is not your own doing; it is the gift of God.",
    fulfillmentStatus: "complete",
    partialFulfillment: null,
    futureImplication: "The faith-righteousness pattern spans both covenants and all nations.",
    notes: "Paul argues in Romans 4 that this verse proves justification by faith predates the Law."
  },
  {
    id: "sin-to-no-condemnation",
    shortTitle: "Universal Sin → No Condemnation",
    category: "doctrinal",
    prophecyVerseId: "ROM.3.23",
    prophecyReference: "Romans 3:23",
    prophecyText: "For all have sinned and fall short of the glory of God.",
    fulfillmentVerseId: "ROM.8.1",
    fulfillmentReference: "Romans 8:1",
    fulfillmentText: "There is therefore now no condemnation for those who are in Christ Jesus.",
    fulfillmentStatus: "complete",
    partialFulfillment: null,
    futureImplication: "Revelation 21 completes this — no more curse, no more death.",
    notes: "Romans 3:23 is the universal diagnosis; Romans 8:1 is the covenant solution."
  },
  {
    id: "creation-to-new-creation",
    shortTitle: "Original Creation → New Creation",
    category: "typological",
    prophecyVerseId: "GEN.1.1",
    prophecyReference: "Genesis 1:1",
    prophecyText: "In the beginning God created the heavens and the earth.",
    fulfillmentVerseId: "REV.21.1",
    fulfillmentReference: "Revelation 21:1",
    fulfillmentText: "Then I saw a new heaven and a new earth.",
    fulfillmentStatus: "complete",
    partialFulfillment: "New creation inaugurated in Messiah (2 Corinthians 5:17).",
    futureImplication: "Revelation 21-22 shows the completed new creation beyond this age.",
    notes: "The whole Bible moves from Genesis 1 to Revelation 21 — creation to new creation."
  }
];

const DOCTRINE_MAP = {
  salvation: {
    name: "Salvation",
    definition: "The redemptive act of God delivering humanity from sin and its consequences through Messiah.",
    keyVerses: ["EPH.2.8", "EPH.2.9", "JHN.3.16"],
    supportingVerses: ["ROM.3.23", "ROM.6.23", "1CO.15.3"],
    debatedPassages: ["JAS.2.17"],
    timeline: [
      { era: "Creation & Patriarchs", note: "Salvation promised through the Seed", verseId: "GEN.3.15" },
      { era: "Torah & Law", note: "Passover blood typifies redemption", verseId: "EXO.12.13" },
      { era: "Major Prophets", note: "Suffering Servant absorbs our sin", verseId: "ISA.53.5" },
      { era: "Gospels", note: "The Lamb of God arrives — salvation enacted", verseId: "JHN.1.29" },
      { era: "Apostolic Letters", note: "Justified by grace through faith", verseId: "EPH.2.8" },
      { era: "Apocalyptic", note: "New creation — full restoration realized", verseId: "REV.21.1" }
    ]
  },
  grace: {
    name: "Grace",
    definition: "God's unmerited favor — the basis of salvation and every covenant relationship.",
    keyVerses: ["EPH.2.8", "ROM.8.1", "JHN.3.16"],
    supportingVerses: ["ROM.3.23", "ROM.6.23", "GEN.15.6"],
    debatedPassages: ["JAS.2.17"],
    timeline: [
      { era: "Creation & Patriarchs", note: "Grace shown to Abraham — faith counted as righteousness", verseId: "GEN.15.6" },
      { era: "Torah & Law", note: "God's protection of Israel through shed blood", verseId: "EXO.12.13" },
      { era: "Gospels", note: "God gave his Son — the supreme act of grace", verseId: "JHN.3.16" },
      { era: "Apostolic Letters", note: "Grace is the explicit foundation of salvation", verseId: "EPH.2.8" },
      { era: "Apostolic Letters", note: "Gift of eternal life — not wages earned", verseId: "ROM.6.23" },
      { era: "Apocalyptic", note: "New heaven and earth — final act of grace", verseId: "REV.21.1" }
    ]
  },
  faith: {
    name: "Faith",
    definition: "Trust in God's person and promises — the means through which grace is received.",
    keyVerses: ["HEB.11.1", "GEN.15.6", "EPH.2.8"],
    supportingVerses: ["JAS.2.17", "PRO.3.5"],
    debatedPassages: ["JAS.2.17", "EPH.2.9"],
    timeline: [
      { era: "Creation & Patriarchs", note: "Abraham's faith counted as righteousness — the pattern is set", verseId: "GEN.15.6" },
      { era: "Wisdom Literature", note: "Trust in the Lord with all your heart", verseId: "PRO.3.5" },
      { era: "Apostolic Letters", note: "Saved through faith — not of ourselves", verseId: "EPH.2.8" },
      { era: "General Epistles", note: "Faith defined: substance of hope, evidence of unseen", verseId: "HEB.11.1" },
      { era: "General Epistles", note: "Faith without works is dead — evidence of life", verseId: "JAS.2.17" }
    ]
  },
  atonement: {
    name: "Atonement",
    definition: "The substitutionary work restoring the covenant relationship between God and humanity.",
    keyVerses: ["EXO.12.13", "ISA.53.5", "JHN.1.29"],
    supportingVerses: ["LEV.17.11", "1CO.5.7", "ROM.6.23", "1CO.15.3"],
    debatedPassages: [],
    timeline: [
      { era: "Creation & Patriarchs", note: "First sacrifice — Seed will bruise the serpent", verseId: "GEN.3.15" },
      { era: "Torah & Law", note: "Passover blood provides covenant protection", verseId: "EXO.12.13" },
      { era: "Torah & Law", note: "Life is in the blood — the principle of atonement", verseId: "LEV.17.11" },
      { era: "Major Prophets", note: "Suffering Servant bears our iniquities", verseId: "ISA.53.5" },
      { era: "Gospels", note: "Lamb of God — atonement enacted", verseId: "JHN.1.29" },
      { era: "Apostolic Letters", note: "Christ our Passover lamb sacrificed for us", verseId: "1CO.5.7" }
    ]
  },
  resurrection: {
    name: "Resurrection",
    definition: "The bodily raising from the dead — guaranteed by Messiah's own resurrection.",
    keyVerses: ["1CO.15.3", "REV.21.1"],
    supportingVerses: ["ROM.6.23", "ROM.8.1", "JHN.3.16"],
    debatedPassages: [],
    timeline: [
      { era: "Wisdom Literature", note: "The Lord shepherd who restores — life beyond death", verseId: "PSA.23.1" },
      { era: "Apostolic Letters", note: "Christ died and rose — the gospel creed", verseId: "1CO.15.3" },
      { era: "Apostolic Letters", note: "Wages of sin is death; gift is eternal life", verseId: "ROM.6.23" },
      { era: "Apostolic Letters", note: "No condemnation — life in the Spirit now", verseId: "ROM.8.1" },
      { era: "Apocalyptic", note: "New creation — death no more", verseId: "REV.21.1" }
    ]
  },
  covenant: {
    name: "Covenant",
    definition: "A binding relational framework between God and His people, progressively developed through Scripture.",
    keyVerses: ["GEN.1.1", "EXO.12.13", "JHN.3.16"],
    supportingVerses: ["GEN.3.15", "GEN.15.6", "EPH.2.8"],
    debatedPassages: [],
    timeline: [
      { era: "Creation & Patriarchs", note: "Creation — God establishes humanity for covenant", verseId: "GEN.1.1" },
      { era: "Creation & Patriarchs", note: "Fall — first covenant promise given", verseId: "GEN.3.15" },
      { era: "Creation & Patriarchs", note: "Abrahamic covenant — faith and righteousness", verseId: "GEN.15.6" },
      { era: "Torah & Law", note: "Passover — blood covenant in history", verseId: "EXO.12.13" },
      { era: "Gospels", note: "God so loved — new covenant in the Son", verseId: "JHN.3.16" },
      { era: "Apostolic Letters", note: "Saved by grace — covenant gift to all nations", verseId: "EPH.2.8" },
      { era: "Apocalyptic", note: "New creation — covenant dwelling fully realized", verseId: "REV.21.1" }
    ]
  },
  judgment: {
    name: "Judgment",
    definition: "God's righteous evaluation and verdict on sin, executed through history and eschatology.",
    keyVerses: ["ROM.3.23", "ROM.6.23"],
    supportingVerses: ["GEN.3.15", "ISA.53.5", "REV.21.1"],
    debatedPassages: [],
    timeline: [
      { era: "Creation & Patriarchs", note: "Sin enters — enmity and judgment declared", verseId: "GEN.3.15" },
      { era: "Apostolic Letters", note: "All have sinned — universal verdict", verseId: "ROM.3.23" },
      { era: "Apostolic Letters", note: "Wages of sin is death — judgment executed", verseId: "ROM.6.23" },
      { era: "Apostolic Letters", note: "In Christ — no condemnation for the justified", verseId: "ROM.8.1" },
      { era: "Apocalyptic", note: "New creation emerges after final judgment", verseId: "REV.21.1" }
    ]
  }
};

const INTERPRETATION_MAP = {
  "grace-and-works": {
    topic: "Grace and Works",
    question: "Are we saved by faith alone, or do works play a necessary role?",
    views: [
      {
        tradition: "Protestant / Reformed (Sola Fide)",
        summary: "Salvation is entirely by grace through faith alone. Works are the fruit of salvation, not its root or cause.",
        keyVerses: ["EPH.2.8", "EPH.2.9"],
        agreementPoint: "All agree grace is necessary and central."
      },
      {
        tradition: "Catholic / Anglican",
        summary: "Salvation is by grace through faith, but genuine faith must work through love. Faith without charity is insufficient.",
        keyVerses: ["JAS.2.17"],
        agreementPoint: "All agree true faith transforms behavior."
      },
      {
        tradition: "Synthesis View",
        summary: "Paul and James address different questions: Paul defends the basis of justification (faith not works); James defends evidence of genuine faith (works prove it). Same coin, different sides.",
        keyVerses: ["EPH.2.8", "EPH.2.9", "JAS.2.17"],
        agreementPoint: "Real saving faith produces works. Dead faith has no works. Both Paul and James condemn dead faith."
      }
    ]
  },
  "kingdom": {
    topic: "Kingdom of God",
    question: "When and how does the Kingdom of God arrive and manifest?",
    views: [
      {
        tradition: "Already / Not Yet (Progressive)",
        summary: "The Kingdom was inaugurated at Messiah's first coming but awaits full consummation at his return.",
        keyVerses: ["GEN.1.1", "REV.21.1"],
        agreementPoint: "All recognize both a present and a future dimension to the Kingdom."
      },
      {
        tradition: "Inaugurated Eschatology",
        summary: "The Kingdom is spiritually present now through the Spirit and Word, made visible at Messiah's return.",
        keyVerses: ["ROM.8.1", "JHN.3.16"],
        agreementPoint: "Spiritual reality of Kingdom is accessible now through Messiah."
      },
      {
        tradition: "Dispensational Pre-Millennial",
        summary: "The Kingdom is primarily future and literal — Messiah will reign physically on earth in the Millennium.",
        keyVerses: ["REV.21.1"],
        agreementPoint: "The Kingdom will have a concrete, glorious physical expression."
      }
    ]
  },
  "atonement": {
    topic: "Atonement",
    question: "What did Messiah accomplish on the cross — and how does it save?",
    views: [
      {
        tradition: "Penal Substitution",
        summary: "Messiah bore God's righteous wrath in our place — satisfying the legal penalty our sin deserved.",
        keyVerses: ["ISA.53.5", "ROM.3.23", "ROM.6.23"],
        agreementPoint: "All views affirm that Messiah's death was real, intentional, and salvific."
      },
      {
        tradition: "Christus Victor",
        summary: "Messiah defeated the powers of sin, death, and the enemy — liberating humanity from bondage through resurrection.",
        keyVerses: ["GEN.3.15", "ROM.8.1"],
        agreementPoint: "The victory motif over death and evil spans both testaments."
      },
      {
        tradition: "Moral Influence / Example",
        summary: "Messiah's sacrifice is the supreme demonstration of divine love, motivating human transformation by example.",
        keyVerses: ["JHN.3.16"],
        agreementPoint: "Love as the motivation and character of atonement is universally acknowledged."
      }
    ]
  }
};

const CONTRADICTION_PAIRS = [
  {
    id: "faith-vs-works",
    question: "Does James 2:17 contradict Ephesians 2:8-9?",
    passages: ["EPH.2.8", "EPH.2.9", "JAS.2.17"],
    resolution: "Paul addresses the source of salvation (faith, not works); James addresses the evidence of genuine faith (works prove its life). Both condemn dead faith — they face different enemies in their audiences.",
    agreementPoint: "Dead faith and living faith are not the same thing. Both Paul and James insist on real, alive, working faith."
  },
  {
    id: "all-sin-no-condemnation",
    question: "Romans 3:23 says all sin — but Romans 8:1 says no condemnation. Contradiction?",
    passages: ["ROM.3.23", "ROM.8.1"],
    resolution: "The guilt is real (3:23) and the solution is equally real — justification in Christ removes condemnation without erasing the historical reality of sin. Diagnosis and cure are both truthful.",
    agreementPoint: "The court verdict is universal guilt; the redemption is through the covenant representative, Messiah."
  },
  {
    id: "fear-not-fear",
    question: "Isaiah 41:10 says 'fear not' but other texts call for 'fear of the Lord' — contradiction?",
    passages: ["ISA.41.10", "PRO.3.5"],
    resolution: "Two different Hebrew words: yare (dread/terror) is what Isaiah forbids; yir'ah (reverent awe) is what Proverbs prescribes. The command is against anxious terror; the call is to reverential trust.",
    agreementPoint: "Reverent trust is the heart posture Scripture calls for — neither anxious dread nor careless presumption."
  },
  {
    id: "grace-vs-wages",
    question: "Romans 6:23 speaks of 'wages' (sin earns death) — but also a 'gift'. Wages and gifts are opposites?",
    passages: ["ROM.6.23", "EPH.2.8"],
    resolution: "Precisely. Paul uses military language (opsonia = soldier's pay) to contrast sin's earned outcome (death) with God's gift (life). The contrast is intentional — you earn death; you receive life.",
    agreementPoint: "Both verses agree: salvation is never earned. The wage-gift contrast is the point, not a problem."
  }
];

const PARALLEL_PASSAGE_DATA = [
  {
    theme: "Covenant Sacrifice → Messianic Fulfillment",
    pairs: [
      { left: "EXO.12.13", right: "JHN.1.29", note: "Passover blood → Lamb of God who takes away sin" },
      { left: "EXO.12.13", right: "1CO.5.7", note: "Passover → Christ our Passover lamb sacrificed" },
      { left: "LEV.17.11", right: "JHN.1.29", note: "Life is in the blood → Lamb takes away the sin of the world" }
    ]
  },
  {
    theme: "Creation → New Creation Arc",
    pairs: [
      { left: "GEN.1.1", right: "JHN.1.1", note: "In the beginning (Torah) → In the beginning was the Word" },
      { left: "GEN.1.1", right: "REV.21.1", note: "Original creation → New heaven and earth" }
    ]
  },
  {
    theme: "Suffering → Healing Pattern",
    pairs: [
      { left: "ISA.53.5", right: "JHN.1.29", note: "Suffering servant pierced → Lamb who takes away sin" },
      { left: "ISA.41.10", right: "2TI.1.7", note: "Fear not (OT promise) → Spirit of power not fear (NT gift)" }
    ]
  },
  {
    theme: "Faith as Covenant Pattern",
    pairs: [
      { left: "GEN.15.6", right: "EPH.2.8", note: "Abraham's faith counted as righteousness → Saved by grace through faith" },
      { left: "HEB.11.1", right: "PRO.3.5", note: "Faith defined as assurance → Trust in the Lord with all your heart" }
    ]
  },
  {
    theme: "Sin → Grace Reversal",
    pairs: [
      { left: "ROM.3.23", right: "ROM.8.1", note: "All have sinned → No condemnation in Christ" },
      { left: "ROM.6.23", right: "EPH.2.8", note: "Wages of sin is death → Free gift of God is eternal life" }
    ]
  }
];

// ── DISCOVERY ENGINE UTILITY FUNCTIONS ────────────────────────────────

function sortedCanonicalVerses() {
  return [...scriptureData.verses].sort((a, b) => {
    const orderA = CANONICAL_BOOK_ORDER[a.book] || 99;
    const orderB = CANONICAL_BOOK_ORDER[b.book] || 99;
    if (orderA !== orderB) return orderA - orderB;
    if (a.chapter !== b.chapter) return a.chapter - b.chapter;
    return a.verse - b.verse;
  });
}

function buildFirstMentionResult(term) {
  const normalized = normalizedString(term);
  const sorted = sortedCanonicalVerses();

  const matchingVerses = sorted.filter((verse) =>
    normalizedString(verse.text).includes(normalized) ||
    verse.themes.some((t) => normalizedString(t).includes(normalized)) ||
    verse.people.some((p) => normalizedString(p).includes(normalized)) ||
    verse.events.some((e) => normalizedString(e).includes(normalized))
  );

  if (matchingVerses.length === 0) return null;

  const firstMention = matchingVerses[0];

  const eraGroups = {};
  matchingVerses.forEach((verse) => {
    const era = BIBLICAL_ERA_MAP[verse.book] || "Unknown Era";
    if (!eraGroups[era]) eraGroups[era] = [];
    eraGroups[era].push({ reference: verse.reference, text: verse.text, themes: verse.themes, verseId: verse.id });
  });

  const developments = Object.entries(eraGroups).map(([era, eraVerses]) => {
    const topThemes = [...new Set(eraVerses.flatMap((v) => v.themes))].slice(0, 3);
    return {
      era,
      occurrences: eraVerses.length,
      primaryVerse: eraVerses[0].reference,
      primaryVerseId: eraVerses[0].verseId,
      themes: topThemes,
      note: `In ${era}: connected to ${topThemes.join(", ") || "multiple themes"}`
    };
  });

  return {
    term,
    firstMention: {
      reference: firstMention.reference,
      text: firstMention.text,
      book: firstMention.book,
      era: BIBLICAL_ERA_MAP[firstMention.book] || "Unknown",
      verseId: firstMention.id
    },
    totalOccurrences: matchingVerses.length,
    developments,
    note: `"${term}" first appears in the dataset at ${firstMention.reference} (${BIBLICAL_ERA_MAP[firstMention.book] || "Unknown Era"}).`
  };
}

function buildContextIntegrityPayload(verse) {
  const contextWindow = buildContextGuardPayload(verse);
  const isCommonlyMisquoted = COMMONLY_MISQUOTED.has(verse.id);
  const contextWarning = isCommonlyMisquoted
    ? `This verse (${verse.reference}) is frequently quoted outside its full context. The surrounding passage is essential for accurate interpretation.`
    : null;

  return {
    verseId: verse.id,
    reference: verse.reference,
    contextWarning,
    isCommonlyMisquoted,
    surroundingContext: contextWindow.context,
    contextStatus: contextWindow.warning,
    bookPurpose: BOOK_PURPOSE_MAP[verse.book] || "Part of the biblical canon, contributing to the whole narrative.",
    readFullPassagePrompt: contextWarning ? `View full passage in ${verse.book} chapter ${verse.chapter}` : null
  };
}

function findParallelPassagesForVerse(verseId) {
  const result = [];
  PARALLEL_PASSAGE_DATA.forEach((group) => {
    group.pairs.forEach((pair) => {
      if (pair.left === verseId || pair.right === verseId) {
        const partnerId = pair.left === verseId ? pair.right : pair.left;
        const partnerVerse = getVerseById(partnerId);
        result.push({
          theme: group.theme,
          parallelVerseId: partnerId,
          parallelReference: partnerVerse ? partnerVerse.reference : partnerId,
          parallelText: partnerVerse ? partnerVerse.text : null,
          note: pair.note
        });
      }
    });
  });
  return result;
}

// ── DISCOVERY ENGINE ENDPOINTS ─────────────────────────────────────────

app.get("/api/v1/first-mention", (req, res) => {
  const term = String(req.query.term || "").trim();
  if (!term) {
    return res.status(400).json({ error: "term parameter is required" });
  }
  const result = buildFirstMentionResult(term);
  if (!result) {
    return res.status(404).json({ error: `No mentions of "${term}" found in the current dataset.` });
  }
  return res.json(result);
});

app.get("/api/v1/theme-evolution", (req, res) => {
  const theme = String(req.query.theme || "").trim();
  if (!theme) {
    return res.status(400).json({ error: "theme parameter is required" });
  }
  const result = buildFirstMentionResult(theme);
  if (!result) {
    return res.status(404).json({ error: `No theme matches for "${theme}" found.` });
  }
  const doctrineKey = Object.keys(DOCTRINE_MAP).find(
    (k) =>
      normalizedString(k).includes(normalizedString(theme)) ||
      normalizedString(DOCTRINE_MAP[k].name).includes(normalizedString(theme))
  );
  const doctrineArc = doctrineKey ? DOCTRINE_MAP[doctrineKey].timeline : null;
  const devCount = result.developments.length;
  return res.json({
    ...result,
    doctrineArc,
    evolutionSummary: `"${theme}" develops from ${result.developments[0]?.era || "early Scripture"} through ${result.developments[devCount - 1]?.era || "the New Testament"}, revealing progressive disclosure of meaning.`
  });
});

app.get("/api/v1/context-integrity/:verseId", (req, res) => {
  const verse = getVerseById(req.params.verseId);
  if (!verse) {
    return res.status(404).json({ error: "Verse not found" });
  }
  return res.json(buildContextIntegrityPayload(verse));
});

app.get("/api/v1/prophecy/all", (req, res) => {
  return res.json({
    total: PROPHECY_FULFILLMENT_PAIRS.length,
    pairs: PROPHECY_FULFILLMENT_PAIRS
  });
});

app.get("/api/v1/prophecy/:verseId", (req, res) => {
  const verseId = req.params.verseId;
  const matches = PROPHECY_FULFILLMENT_PAIRS.filter(
    (pair) => pair.prophecyVerseId === verseId || pair.fulfillmentVerseId === verseId
  );
  if (matches.length === 0) {
    return res.status(404).json({ error: "No prophecy/fulfillment link found for this verse." });
  }
  return res.json({ verseId, links: matches });
});

app.get("/api/v1/doctrine/list", (req, res) => {
  return res.json({
    doctrines: Object.keys(DOCTRINE_MAP).map((key) => ({
      key,
      name: DOCTRINE_MAP[key].name,
      definition: DOCTRINE_MAP[key].definition
    }))
  });
});

app.get("/api/v1/doctrine", (req, res) => {
  const name = normalizedString(req.query.name || "");
  if (!name) {
    return res.status(400).json({ error: "name parameter is required" });
  }
  const doc = DOCTRINE_MAP[name] || Object.values(DOCTRINE_MAP).find((d) => normalizedString(d.name) === name);
  if (!doc) {
    return res.status(404).json({ error: `No doctrine found for "${name}".` });
  }

  const enrichedTimeline = doc.timeline.map((entry) => {
    const verse = getVerseById(entry.verseId);
    return {
      ...entry,
      reference: verse ? verse.reference : entry.verseId,
      text: verse ? verse.text : null
    };
  });

  const allRelevantVerseIds = [...new Set([...doc.keyVerses, ...doc.supportingVerses, ...doc.debatedPassages])];
  const verseObjects = allRelevantVerseIds
    .map((id) => getVerseById(id))
    .filter(Boolean)
    .map(mapSummary);

  return res.json({
    ...doc,
    timeline: enrichedTimeline,
    verseObjects
  });
});

app.get("/api/v1/parallel-passages/:verseId", (req, res) => {
  const parallels = findParallelPassagesForVerse(req.params.verseId);
  if (parallels.length === 0) {
    return res.status(404).json({ error: "No parallel passages defined for this verse." });
  }
  return res.json({ verseId: req.params.verseId, parallels });
});

app.get("/api/v1/interpretations", (req, res) => {
  const topic = normalizedString(req.query.topic || "");
  if (!topic) {
    return res.json({
      topics: Object.keys(INTERPRETATION_MAP).map((k) => ({
        key: k,
        topic: INTERPRETATION_MAP[k].topic,
        question: INTERPRETATION_MAP[k].question
      }))
    });
  }
  const result = INTERPRETATION_MAP[topic] || Object.values(INTERPRETATION_MAP).find(
    (item) => normalizedString(item.topic).includes(topic)
  );
  if (!result) {
    return res.status(404).json({ error: `No interpretations found for topic "${topic}".` });
  }
  const enrichedViews = result.views.map((view) => {
    const verseObjects = (view.keyVerses || []).map((id) => getVerseById(id)).filter(Boolean).map(mapSummary);
    return { ...view, verseObjects };
  });
  return res.json({ ...result, views: enrichedViews });
});

app.post("/api/v1/contradiction-resolver", (req, res) => {
  const { passage = "", question = "" } = req.body || {};
  const query = normalizedString(passage || question);
  const match = CONTRADICTION_PAIRS.find(
    (pair) =>
      pair.passages.some((p) => normalizedString(p).includes(query) || query.includes(normalizedString(p))) ||
      normalizedString(pair.question).includes(query) ||
      normalizedString(pair.id).includes(query)
  );

  if (!match) {
    const closest = CONTRADICTION_PAIRS[0];
    return res.json({
      found: false,
      suggestion: "No exact match found. Showing example contradiction for reference.",
      example: {
        ...closest,
        verseObjects: closest.passages.map((id) => getVerseById(id)).filter(Boolean).map(mapSummary)
      },
      available: CONTRADICTION_PAIRS.map((p) => ({ id: p.id, question: p.question }))
    });
  }

  return res.json({
    found: true,
    ...match,
    verseObjects: match.passages.map((id) => getVerseById(id)).filter(Boolean).map(mapSummary)
  });
});

app.get("/api/v1/visual-network", (req, res) => {
  const seed = String(req.query.seed || "").trim();
  const allVerses = scriptureData.verses;

  let nodes = [];
  let edges = [];

  if (seed) {
    const normalized = normalizedString(seed);
    const centerVerses = allVerses.filter(
      (v) =>
        v.themes.some((t) => normalizedString(t).includes(normalized)) ||
        normalizedString(v.text).includes(normalized)
    );
    const centerIds = new Set(centerVerses.map((v) => v.id));

    nodes = centerVerses.map((v) => ({
      id: v.id,
      label: v.reference,
      themes: v.themes,
      era: BIBLICAL_ERA_MAP[v.book] || "Unknown",
      isSeed: true
    }));

    centerVerses.forEach((v) => {
      (v.relatedVerseIds || []).forEach((relId) => {
        const relVerse = getVerseById(relId);
        if (relVerse && !centerIds.has(relId)) {
          nodes.push({
            id: relVerse.id,
            label: relVerse.reference,
            themes: relVerse.themes,
            era: BIBLICAL_ERA_MAP[relVerse.book] || "Unknown",
            isSeed: false
          });
          centerIds.add(relId);
        }
        edges.push({ from: v.id, to: relId, type: "RELATED" });
      });
    });

    PARALLEL_PASSAGE_DATA.forEach((group) => {
      group.pairs.forEach((pair) => {
        if (centerIds.has(pair.left) || centerIds.has(pair.right)) {
          edges.push({ from: pair.left, to: pair.right, type: "PARALLEL", note: pair.note });
        }
      });
    });
  } else {
    nodes = allVerses.map((v) => ({
      id: v.id,
      label: v.reference,
      themes: v.themes,
      era: BIBLICAL_ERA_MAP[v.book] || "Unknown",
      isSeed: false
    }));
    allVerses.forEach((v) => {
      (v.relatedVerseIds || []).forEach((relId) => {
        edges.push({ from: v.id, to: relId, type: "RELATED" });
      });
    });
  }

  const uniqueNodes = Array.from(new Map(nodes.map((n) => [n.id, n])).values());

  return res.json({ seed: seed || null, nodes: uniqueNodes, edges });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Scripture Key server running on http://localhost:${PORT}`);
});
