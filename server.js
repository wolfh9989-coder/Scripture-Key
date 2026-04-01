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

// ── INTELLIGENCE LAYER DATA ────────────────────────────────────────────

const WHY_IT_MATTERS_MAP = {
  "GEN.1.1": {
    whatItMeans: "God is the sovereign, uncaused first cause of all that exists — creation is intentional, not accidental.",
    whyItMatters: "Every worldview question — purpose, value, morality — depends on whether existence is designed or random. This verse is the load-bearing foundation.",
    howItApplies: "When facing meaninglessness: existence is not accidental. When facing ethical questions: there is a creator whose character defines good. When studying redemption: the same God who created is the one who redeems."
  },
  "GEN.3.15": {
    whatItMeans: "God announces a coming victor who will defeat the enemy through his own suffering — the first messianic promise.",
    whyItMatters: "It explains why evil was not immediately destroyed — grace delays judgment to accomplish redemption. Sets the entire biblical plot in motion.",
    howItApplies: "Suffering in the world is not evidence against God's plan; it is the arena in which it unfolds. The wound in the heel is the price of the crushed head."
  },
  "GEN.15.6": {
    whatItMeans: "Abraham's faith — not his actions — was the act God credited as righteousness, establishing the pattern for all covenant relationship.",
    whyItMatters: "Written before circumcision and 430 years before the Mosaic Law — Paul's linchpin argument that justification is always by faith, always by grace.",
    howItApplies: "No amount of religious activity can earn standing before God. The posture of trust — not achievement — is the covenant relationship."
  },
  "EXO.12.13": {
    whatItMeans: "Blood on the doorpost marked households for divine protection — a covenant boundary sign in history.",
    whyItMatters: "Establishes the principle that protection from divine judgment requires a blood-marked identification — the Passover typology that Paul and the NT authors explicitly connect to Messiah.",
    howItApplies: "The pattern: deliverance comes through a substitute's blood, not through personal merit. The Passover is designed to be remembered and re-interpreted."
  },
  "LEV.17.11": {
    whatItMeans: "Life resides in blood; therefore blood given on the altar accomplishes atonement because life is being offered for life.",
    whyItMatters: "This is the theological foundation of the entire sacrificial system. Without this principle, the crucifixion is just a death — with it, it is the ultimate exchange of life for life.",
    howItApplies: "God's provision for sin is costly — it requires life. This should produce reverence, not casual treatment of forgiveness."
  },
  "PSA.23.1": {
    whatItMeans: "God governs with the intimacy and competency of a shepherd — personally providing and protecting those under his care.",
    whyItMatters: "Pastoral imagery bridges personal devotion and royal theology — the king who cares individually. Jesus explicitly claims this identity in John 10.",
    howItApplies: "Worry is the opposite of this verse. David wrote it after years of conflict — not from a place of ease, but of proven covenant trust."
  },
  "PRO.3.5": {
    whatItMeans: "The command to trust with the whole heart deliberately contrasts human rationalism — the 'own understanding' — with covenantal reliance on God.",
    whyItMatters: "Wisdom literature consistently describes wisdom not as intelligence but as moral alignment with divine reality. This is the posture that produces it.",
    howItApplies: "Decision-making: hold conclusions loosely when they haven't been tested against Scripture and counsel. 'Lean not' is active — it requires resisting the default."
  },
  "ISA.41.10": {
    whatItMeans: "God's command not to fear is grounded in his presence ('I am with you') and his identity ('I am your God') — two separate covenant guarantees.",
    whyItMatters: "Fear is not just an emotion — it reveals what we believe is most real and powerful. This verse addresses the belief beneath the feeling.",
    howItApplies: "The antidote to fear is not willpower but a reordering of what one believes is most real. The command is effective because it comes with the promise."
  },
  "ISA.53.5": {
    whatItMeans: "The servant absorbs our sin's penalty — pierced for our rebellion, crushed for our moral failure — and in doing so produces our shalom and healing.",
    whyItMatters: "Written 700 years in advance. The specificity — piercing, crushing, chastisement, wounds, healing — is not generic suffering but precise substitution.",
    howItApplies: "Guilt is not something to manage or suppress — it can be definitively resolved through the one who absorbed its full weight on our behalf."
  },
  "MIC.5.2": {
    whatItMeans: "The coming ruler's birthplace is named precisely along with his eternal pre-existence — two facts in one verse.",
    whyItMatters: "The prophecy is doubly remarkable: geographic precision centuries before the event, and a claim of eternal origins that cannot describe any ordinary human.",
    howItApplies: "The reliability of Scripture's fulfilled prophecy is the foundation for trusting its unfulfilled prophecy."
  },
  "JHN.1.1": {
    whatItMeans: "The Word is placed before creation, in relationship with God, and identified as God — eternal, relational, divine.",
    whyItMatters: "John deliberately echoes Genesis 1:1 ('In the beginning') to signal that Messiah is not a part of creation but the agent of it. Identity comes before mission.",
    howItApplies: "Who Jesus is determines what his actions mean. The crucifixion's significance depends entirely on who is doing the dying — hence John 1 precedes John 19."
  },
  "JHN.1.29": {
    whatItMeans: "John identifies Jesus as the sacrificial lamb who removes the sin of the entire world — not a nation, but the cosmos.",
    whyItMatters: "It connects the entire Levitical sacrificial system to one person in one moment. The 'world' (kosmos) signals universal scope.",
    howItApplies: "No one is beyond the scope of the atonement's provision — only outside its application by unbelief."
  },
  "JHN.3.16": {
    whatItMeans: "Love is the divine motivation; giving the Son is the divine act; belief is the human response; life is the promised outcome.",
    whyItMatters: "The gospel in structural form. Every element is load-bearing: remove the love and it becomes transaction; remove the gift and it becomes self-help; remove belief and it becomes universalism.",
    howItApplies: "Evangelism: the invitation is to believe, not to perform. Assurance: the basis of life is God's love and gift, not one's consistency."
  },
  "ROM.3.23": {
    whatItMeans: "The universal human verdict — every person, regardless of background, has sinned and consequently lacks God's glory.",
    whyItMatters: "It dismantles every hierarchy of moral self-sufficiency before the gospel is offered. The diagnosis must precede the prescription.",
    howItApplies: "No one enters the gospel through pride. This verse levels the ground — it applies to the religious and irreligious alike."
  },
  "ROM.6.23": {
    whatItMeans: "Sin pays its employee what is earned (death); God gives what is not earned (life). Wages versus gift — the sharpest contrast in Paul.",
    whyItMatters: "The military term 'opsonia' (soldier's pay) makes the point: sin is an employer, and death is what it owes you. The gift line is pure grace — unprompted, unearned.",
    howItApplies: "Stop trying to earn what can only be received. The posture of grace is open hands, not clenched fists."
  },
  "ROM.8.1": {
    whatItMeans: "The legal sentence of condemnation — the verdict that should have stood against every sinner — is dismissed for those identified with Messiah.",
    whyItMatters: "This is not psychological reassurance — it is a courtroom verdict reversal. The same word (katakrima) used for guilty sentence is now declared null.",
    howItApplies: "Shame and guilt lose their grip not through willpower but through understanding one's legal standing. Condemnation has been absorbed elsewhere."
  },
  "1CO.5.7": {
    whatItMeans: "Paul declares the Passover typology complete — Christ is the Passover lamb, which means the type has met its fulfillment.",
    whyItMatters: "Typological reading validates that the entire Mosaic sacrificial system was anticipatory, not ultimate. The shadow has met the substance.",
    howItApplies: "Christians are no longer in the type; they live in the fulfillment. This shapes how to read Exodus — as preview, not prescription for today."
  },
  "1CO.15.3": {
    whatItMeans: "The earliest creedal summary of the gospel: Christ died for sins according to Scripture — not an improvised rescue but a predetermined plan.",
    whyItMatters: "Scholars date this creed to within 2-5 years of the resurrection — making it the earliest documented Christian theology. 'According to the Scriptures' anchors it in OT fulfillment.",
    howItApplies: "The gospel is not invented — it was announced. Its validity comes from its scriptural grounding, not from its emotional appeal."
  },
  "EPH.2.8": {
    whatItMeans: "Grace is the source (originating cause), faith is the channel (receiving instrument), and the whole package — including the faith — is God's gift.",
    whyItMatters: "Even faith itself is not meritorious — it is the hand that opens to receive what God freely extends. Removes all basis for religious pride.",
    howItApplies: "Assurance of salvation should be grounded in the giver's character and commitment, not in the receiver's consistency."
  },
  "EPH.2.9": {
    whatItMeans: "Works are explicitly excluded from the basis of salvation — specifically to prevent the human impulse toward spiritual boasting.",
    whyItMatters: "The exclusion of works is not incidental — Paul names the reason: so no one may boast. Grace by design eliminates the grounds for pride.",
    howItApplies: "Religious accomplishment is not spiritual currency. Every person stands before God on identical ground — the worth of another."
  },
  "HEB.11.1": {
    whatItMeans: "Faith is substantive, not vague — it is the present reality of future hope and the evidential conviction of what cannot yet be seen.",
    whyItMatters: "Greek 'hypostasis' (title deed/substance) and 'elegchos' (legal proof/evidence) give faith forensic force — it is not emotion but certainty grounded in God's character.",
    howItApplies: "Faith is not the absence of questions — it is confidence calibrated to the reliability of the one trusted, not the quality of one's feelings."
  },
  "JAS.2.17": {
    whatItMeans: "Faith that produces no visible change in behavior is not alive — it is the doctrinal profession without the covenantal reality behind it.",
    whyItMatters: "James faces the opposite problem from Paul — not people trusting works for salvation, but people claiming faith while living unchanged. Both are wrong.",
    howItApplies: "The question is not 'Do I believe the right things?' but 'Is what I believe actually shaping how I live?' Live faith has a pulse."
  },
  "REV.21.1": {
    whatItMeans: "The original creation is renewed and elevated — not destroyed and replaced, but transformed and restored to its intended purpose under God's direct reign.",
    whyItMatters: "The Bible opens with creation (Gen 1:1) and closes with new creation — meaning the storyline is not escape from matter but its redemption.",
    howItApplies: "Physical creation matters. Bodies matter. History matters. The trajectory is not evacuation but transformation — this shapes how we treat the material world."
  },
  "2TI.1.7": {
    whatItMeans: "The Spirit God gave believers does not produce timidity — it produces power (capacity), love (motivation), and self-discipline (direction).",
    whyItMatters: "Paul writes from prison, facing execution — this is not theoretical courage. The Spirit's character is the antidote to fear-driven paralysis.",
    howItApplies: "Courage is not the absence of fear — it is action taken in the Spirit's enabling, despite fear. The Spirit's presence changes what fear has access to."
  }
};

const SPIRITUAL_CONFLICTS = [
  {
    id: "grace-vs-law",
    title: "Grace vs. Law",
    tension: "The law reveals sin and demands obedience; grace declares righteousness freely. Can they coexist?",
    sideA: {
      label: "Law",
      description: "God's righteous standard that exposes sin and requires perfect obedience.",
      keyVerses: ["ROM.3.23"],
      note: "The law is holy (Romans 7:12) — its purpose is to diagnose, not to cure."
    },
    sideB: {
      label: "Grace",
      description: "God's unmerited provision that accomplishes what the law could only demand.",
      keyVerses: ["EPH.2.8", "ROM.8.1"],
      note: "Grace does not abolish the law's standard — it fulfills it through a substitute."
    },
    resolution: "The law is the standard; grace is the provision that meets it. Messiah fulfilled the law fully so that grace could be extended justly. Romans 8:3-4: 'what the law could not do... God did.'",
    resolutionVerseId: "ROM.8.1"
  },
  {
    id: "faith-vs-works",
    title: "Faith vs. Works",
    tension: "Paul says salvation is not by works (Eph 2:9); James says faith without works is dead (Jas 2:17). Direct contradiction?",
    sideA: {
      label: "Faith Alone (Paul)",
      description: "Justification before God is through faith alone — works cannot earn or contribute to it.",
      keyVerses: ["EPH.2.8", "EPH.2.9", "GEN.15.6"],
      note: "Paul addresses the root of salvation — what establishes right standing before God."
    },
    sideB: {
      label: "Faith Demonstrated (James)",
      description: "Genuine faith necessarily produces visible obedience — a faith that produces nothing is not real.",
      keyVerses: ["JAS.2.17"],
      note: "James addresses the evidence of genuine faith — what proves its existence to others."
    },
    resolution: "Different questions, not contradictory answers. Paul: How is one justified before God? (faith). James: How is faith proven genuine? (works). A tree is not made alive by fruit — but a living tree produces fruit.",
    resolutionVerseId: "JAS.2.17"
  },
  {
    id: "justice-vs-mercy",
    title: "Justice vs. Mercy",
    tension: "God is perfectly just (must punish sin) and perfectly merciful (loves the sinner). How can both be true at the cross?",
    sideA: {
      label: "Justice",
      description: "God's nature demands that sin be punished — moral categories cannot be ignored without dishonesty.",
      keyVerses: ["ROM.3.23", "ROM.6.23"],
      note: "The wages of sin must be paid — God does not simply overlook moral failure."
    },
    sideB: {
      label: "Mercy",
      description: "God's love sends a substitute so that justice is satisfied while the sinner is freed.",
      keyVerses: ["JHN.3.16", "ISA.53.5"],
      note: "Mercy is not the absence of justice — it is justice redirected to a willing substitute."
    },
    resolution: "At the cross, justice and mercy meet: the penalty is fully paid (justice satisfied) but paid by Another (mercy extended). Romans 3:26: God is 'just and the justifier.'",
    resolutionVerseId: "ROM.8.1"
  },
  {
    id: "flesh-vs-spirit",
    title: "Flesh vs. Spirit",
    tension: "The flesh pulls toward self-will and sin; the Spirit pulls toward obedience and life. Every believer feels this war.",
    sideA: {
      label: "Flesh",
      description: "The human nature apart from divine renewal — inclined toward self-sufficiency and moral failure.",
      keyVerses: ["ROM.3.23"],
      note: "Flesh is not the body — it is the self-governing orientation that resists submission to God."
    },
    sideB: {
      label: "Spirit",
      description: "The indwelling Spirit of God who enables, motivates, and empowers covenant faithfulness.",
      keyVerses: ["2TI.1.7", "ROM.8.1"],
      note: "Paul's Spirit-of-power (2 Tim 1:7) is given precisely for this conflict."
    },
    resolution: "The conflict is real and ongoing, but the outcome is decided — 'no condemnation' (Rom 8:1) is the foundation that enables Spirit-led living rather than fear-driven striving.",
    resolutionVerseId: "ROM.8.1"
  },
  {
    id: "shadow-vs-fulfillment",
    title: "Shadow vs. Fulfillment",
    tension: "The Old Testament system of sacrifices, laws, and ceremonies — was it valid? Was it replaced? Do both covenants have equal authority?",
    sideA: {
      label: "Shadow (Old Covenant)",
      description: "The Mosaic system was genuine and divinely given, but prophetically anticipatory — pointing forward.",
      keyVerses: ["EXO.12.13", "LEV.17.11"],
      note: "Typological: the shadow is not the substance but is still meaningful — it reveals the substance's shape."
    },
    sideB: {
      label: "Fulfillment (New Covenant)",
      description: "Messiah is the substance that every type, symbol, and prophecy was pointing toward.",
      keyVerses: ["1CO.5.7", "1CO.15.3"],
      note: "Fulfillment does not invalidate the type — it completes and explains it."
    },
    resolution: "Hebrews 10:1 — 'the law is a shadow of the good things to come.' The Mosaic system was the blueprint; Christ is the building. Both are real; one is preparatory, one is final.",
    resolutionVerseId: "JHN.1.29"
  }
];

const MISUSE_DETECTION_DATA = {
  "ISA.41.10": {
    commonMisuse: "Used as a blanket promise that God will prevent all suffering, difficulty, or hard circumstances.",
    incorrectUsage: "Cherry-picked as a personal prosperity guarantee — 'God won't let anything bad happen to me.'",
    correctContext: "God's covenant assurance to Israel in a context of impending Babylonian threat. 'Fear not' is a command to trust, not a promise of ease. Verse 10 continues: 'I will strengthen you, I will help you' — implying there is something to face.",
    fullPassageNote: "Isaiah 41:8-14 addresses a people facing real, severe threat — not comfort from a distance but strengthening to face difficulty.",
    balancingVerses: ["2TI.1.7", "PSA.23.1"],
    correctApplication: "God's presence does not eliminate hardship — it transforms our capacity within hardship. The promise is presence and strengthening, not exemption."
  },
  "PRO.3.5": {
    commonMisuse: "Used to justify not thinking, reasoning, or planning — 'I just trust God' as a substitute for wisdom and discernment.",
    incorrectUsage: "Anti-intellectualism dressed in spiritual language. Or: used to dismiss someone else's counsel — 'I lean on God, not human advice.'",
    correctContext: "Proverbs is a book about wisdom — careful, discerning, attentive engagement with reality. The contrast is not between thinking and trusting, but between autonomous pride-driven conclusions and humble, God-anchored discernment.",
    fullPassageNote: "Proverbs 3:5-6 — 'in all your ways acknowledge him and he will make your paths straight.' Acknowledgment is active, not passive.",
    balancingVerses: ["PRO.3.5"],
    correctApplication: "Think carefully, plan wisely, seek counsel — and hold your conclusions with open hands before God rather than as absolute truths derived from your own analysis alone."
  },
  "JHN.3.16": {
    commonMisuse: "Used in isolation to imply universal salvation — 'God loves everyone, so everyone will be saved in the end.'",
    incorrectUsage: "The 'whoever believes' condition is removed, leaving only 'God so loved the world' as the entire theological statement.",
    correctContext: "The verse has four components: love (motivation), gift (act), belief (condition), life (result for believers) / perish (result for non-believers). The condition of belief is structurally essential.",
    fullPassageNote: "John 3:17-18 immediately follows: 'whoever does not believe is condemned already.' The universal love does not produce universal salvation without the response of faith.",
    balancingVerses: ["EPH.2.8", "ROM.3.23"],
    correctApplication: "The scope of God's love is universal; the application of its benefit is conditioned on belief. Both truths must be held."
  },
  "ROM.8.1": {
    commonMisuse: "Used to claim that sin has no consequences for believers — 'no condemnation means I can live however I want.'",
    incorrectUsage: "Moral antinomianism — using grace as license rather than foundation.",
    correctContext: "Romans 8:1 follows Romans 7's war with sin and precedes Romans 8:4's call to walk in the Spirit. It is the foundation of sanctified living, not a bypass of it.",
    fullPassageNote: "Romans 8:1 in full context (chapters 6-8) argues: because we are freed from condemnation, we are freed to live by the Spirit — not freed to ignore righteousness.",
    balancingVerses: ["JAS.2.17", "EPH.2.9"],
    correctApplication: "No condemnation is the assurance that empowers holy living — not the excuse that bypasses it."
  },
  "EPH.2.8": {
    commonMisuse: "Used to argue that how one lives is irrelevant — 'saved by grace alone means behavior doesn't matter.'",
    incorrectUsage: "Separates Ephesians 2:8-9 from Ephesians 2:10 ('created for good works') and from James 2:17.",
    correctContext: "Grace produces a new creation aimed at good works (Eph 2:10). Saved by grace is the root; good works are the fruit. The fruit does not produce the root.",
    fullPassageNote: "Ephesians 2:8-10 is a three-verse unit: grace saves → through faith → unto good works prepared in advance. The good works are the trajectory, not the basis.",
    balancingVerses: ["JAS.2.17", "EPH.2.9"],
    correctApplication: "Grace saves — and grace produces. The same grace that justifies also sanctifies. A life unchanged by grace should prompt examination, not reassurance."
  },
  "1CO.15.3": {
    commonMisuse: "Reduced to a proof text without reading 'according to the Scriptures' — treating the gospel as self-contained rather than fulfillment of OT promises.",
    incorrectUsage: "Used without context to present a gospel disconnected from its Old Testament roots, making it seem like a new invention.",
    correctContext: "Paul's point is precisely that Christ's death and resurrection were not improvised — they were 'according to the Scriptures.' The OT arc is intrinsic.",
    fullPassageNote: "1 Corinthians 15:3-4 is a formal creedal summary ('I received... I delivered') — Paul is passing on fixed tradition, not his own teaching.",
    balancingVerses: ["ISA.53.5", "EXO.12.13"],
    correctApplication: "The gospel has deep OT roots. Presenting the crucifixion without Isaiah 53 or the Passover pattern strips it of its scriptural explanatory power."
  }
};

const SYMBOL_MAP = {
  blood: {
    definition: "Life offered as price — covenant marking, atonement, and redemptive cost.",
    firstAppearance: "EXO.12.13",
    firstBook: "Exodus",
    symbolMeanings: ["life", "atonement", "covenant boundary", "redemptive cost"],
    developmentArc: [
      { era: "Torah & Law", verseId: "EXO.12.13", note: "Blood as covenant protection boundary in Passover" },
      { era: "Torah & Law", verseId: "LEV.17.11", note: "Life is in the blood — the atonement principle" },
      { era: "Gospels", verseId: "JHN.1.29", note: "The Lamb of God — ultimate blood offering" },
      { era: "Apostolic Letters", verseId: "1CO.5.7", note: "Christ our Passover — blood as fulfillment" },
      { era: "Apocalyptic", verseId: "REV.21.1", note: "New creation where the blood-cost is complete" }
    ],
    bookOccurrences: ["Exodus", "Leviticus", "John", "1 Corinthians", "Revelation"]
  },
  lamb: {
    definition: "Innocent substitute offered in place of the guilty — purity, sacrifice, and covenant peace.",
    firstAppearance: "EXO.12.13",
    firstBook: "Exodus",
    symbolMeanings: ["innocence", "substitution", "sacrifice", "passover"],
    developmentArc: [
      { era: "Torah & Law", verseId: "EXO.12.13", note: "Passover lamb — substitute for the firstborn" },
      { era: "Major Prophets", verseId: "ISA.53.5", note: "Servant like a lamb led to slaughter (Isaiah 53:7)" },
      { era: "Gospels", verseId: "JHN.1.29", note: "The Lamb of God who takes away sin of the world" },
      { era: "Apostolic Letters", verseId: "1CO.5.7", note: "Christ our Passover lamb sacrificed" },
      { era: "Apocalyptic", verseId: "REV.21.1", note: "The Lamb on the throne — Revelation's central image" }
    ],
    bookOccurrences: ["Exodus", "Leviticus", "Isaiah", "John", "1 Corinthians", "Revelation"]
  },
  light: {
    definition: "Divine presence, revelation, and moral clarity — that which makes the invisible visible.",
    firstAppearance: "GEN.1.1",
    firstBook: "Genesis",
    symbolMeanings: ["revelation", "presence", "truth", "life"],
    developmentArc: [
      { era: "Creation & Patriarchs", verseId: "GEN.1.1", note: "God speaks light into creation — first creative act" },
      { era: "Wisdom Literature", verseId: "PSA.23.1", note: "The Lord's presence as safe passage through darkness" },
      { era: "Gospels", verseId: "JHN.1.1", note: "The Word is the light of humanity — John 1:4-9" },
      { era: "Apocalyptic", verseId: "REV.21.1", note: "New Jerusalem has no need of sun — the Lamb is its light" }
    ],
    bookOccurrences: ["Genesis", "Psalms", "Proverbs", "John", "Revelation"]
  },
  word: {
    definition: "God's self-expression and creative power — spoken decrees that accomplish reality.",
    firstAppearance: "GEN.1.1",
    firstBook: "Genesis",
    symbolMeanings: ["divine expression", "creation power", "revelation", "person of Christ"],
    developmentArc: [
      { era: "Creation & Patriarchs", verseId: "GEN.1.1", note: "God speaks — word as creative force" },
      { era: "Major Prophets", verseId: "ISA.53.5", note: "The prophetic word accomplishes God's purpose" },
      { era: "Gospels", verseId: "JHN.1.1", note: "The Word becomes personal — logos as divine person" },
      { era: "Apostolic Letters", verseId: "HEB.11.1", note: "Faith rests on the word spoken — invisible things made certain" }
    ],
    bookOccurrences: ["Genesis", "Isaiah", "Psalms", "John", "Hebrews"]
  },
  shepherd: {
    definition: "Intimate governance, provision, and protection — leadership through care rather than power.",
    firstAppearance: "PSA.23.1",
    firstBook: "Psalms",
    symbolMeanings: ["provision", "guidance", "protection", "intimate care", "covenant leadership"],
    developmentArc: [
      { era: "Wisdom Literature", verseId: "PSA.23.1", note: "The Lord as personal shepherd — Davidic intimacy with God" },
      { era: "Major Prophets", verseId: "ISA.41.10", note: "God as tender comforter — gathering the scattered" },
      { era: "Gospels", verseId: "JHN.1.29", note: "Good Shepherd who lays down his life for the sheep (John 10:11)" },
      { era: "Apostolic Letters", verseId: "HEB.11.1", note: "The great shepherd of the sheep (Hebrews 13:20)" }
    ],
    bookOccurrences: ["Psalms", "Isaiah", "Ezekiel", "John", "Hebrews", "1 Peter"]
  },
  covenant: {
    definition: "A binding relational framework established by God — not contract (equal parties) but covenant (initiated by the stronger to benefit the weaker).",
    firstAppearance: "GEN.1.1",
    firstBook: "Genesis",
    symbolMeanings: ["relationship", "promise", "commitment", "identity", "obligation"],
    developmentArc: [
      { era: "Creation & Patriarchs", verseId: "GEN.3.15", note: "First covenant promise — seed will crush the serpent" },
      { era: "Creation & Patriarchs", verseId: "GEN.15.6", note: "Abrahamic covenant — faith and righteousness pattern" },
      { era: "Torah & Law", verseId: "EXO.12.13", note: "Blood covenant — Passover as covenant boundary marker" },
      { era: "Gospels", verseId: "JHN.3.16", note: "New covenant in the Son — universal scope" },
      { era: "Apostolic Letters", verseId: "EPH.2.8", note: "Covenant gift of grace — not earned, freely given" }
    ],
    bookOccurrences: ["Genesis", "Exodus", "Leviticus", "Isaiah", "Jeremiah", "Matthew", "John", "Hebrews"]
  },
  seed: {
    definition: "Offspring/descendant — especially the promised line through which redemption comes.",
    firstAppearance: "GEN.3.15",
    firstBook: "Genesis",
    symbolMeanings: ["promise", "continuity", "messianic hope", "covenant heir"],
    developmentArc: [
      { era: "Creation & Patriarchs", verseId: "GEN.3.15", note: "The seed of the woman — first messianic promise" },
      { era: "Creation & Patriarchs", verseId: "GEN.15.6", note: "Abraham's seed — the faith lineage" },
      { era: "Apostolic Letters", verseId: "EPH.2.8", note: "The promise to Abraham received through faith/grace" },
      { era: "Apocalyptic", verseId: "REV.21.1", note: "New creation — the seed's promise fully realized" }
    ],
    bookOccurrences: ["Genesis", "Isaiah", "Galatians", "Revelation"]
  }
};

const CROSS_COVENANT_DATA = [
  {
    concept: "Sacrifice",
    oldCovenant: {
      summary: "Repeated animal sacrifices covering sin temporarily — requiring annual repetition (Yom Kippur).",
      keyVerseId: "LEV.17.11",
      keyReference: "Leviticus 17:11",
      nature: "Shadow / Ongoing",
      limitation: "Could not permanently remove sin — only cover it year by year."
    },
    newCovenant: {
      summary: "One final sacrifice — Messiah's death — permanently removing sin and requiring no repetition.",
      keyVerseId: "1CO.5.7",
      keyReference: "1 Corinthians 5:7",
      nature: "Fulfillment / Once for All",
      advancement: "Hebrews 10:14 — 'by a single offering he has perfected for all time those who are being sanctified.'"
    },
    continuity: "The principle: sin requires life as payment. The change: animal life → divine life.",
    connectingVerseId: "JHN.1.29"
  },
  {
    concept: "Priesthood",
    oldCovenant: {
      summary: "Levitical priests — mortal, fallible, required daily offerings for their own sins and for the people.",
      keyVerseId: "EXO.12.13",
      keyReference: "Exodus 12:13",
      nature: "Shadow / Ongoing",
      limitation: "Priests died and needed successors; their own sin required atonement."
    },
    newCovenant: {
      summary: "Messiah as eternal high priest — sinless, permanent, interceding continuously.",
      keyVerseId: "HEB.11.1",
      keyReference: "Hebrews 11:1",
      nature: "Fulfillment / Eternal",
      advancement: "Hebrews 7:24-25 — 'because he remains forever, he holds his priesthood permanently... always living to intercede.'"
    },
    continuity: "The role of mediator between God and humanity. The change: mortal → eternal; imperfect → sinless.",
    connectingVerseId: "ISA.53.5"
  },
  {
    concept: "Atonement",
    oldCovenant: {
      summary: "Yom Kippur — annual covering of sin through blood, with the nation's guilt ceremonially transferred to the scapegoat.",
      keyVerseId: "LEV.17.11",
      keyReference: "Leviticus 17:11",
      nature: "Shadow / Annual",
      limitation: "Covered but did not remove sin — needed to be repeated, indicating incompleteness."
    },
    newCovenant: {
      summary: "Christ's once-for-all atonement — not covering but removing sin permanently.",
      keyVerseId: "ROM.8.1",
      keyReference: "Romans 8:1",
      nature: "Fulfillment / Permanent",
      advancement: "Romans 8:1 — 'no condemnation' is the new covenant verdict replacing annual repeated atonement."
    },
    continuity: "The necessity: sin must be addressed for relationship with God to continue. The change: temporary → permanent.",
    connectingVerseId: "JHN.1.29"
  },
  {
    concept: "Righteousness",
    oldCovenant: {
      summary: "Righteousness through covenant obedience to the Mosaic law — an external standard requiring constant moral performance.",
      keyVerseId: "ROM.3.23",
      keyReference: "Romans 3:23",
      nature: "Shadow / External",
      limitation: "'All have sinned and fall short' — universal failure confirms no one achieves it consistently."
    },
    newCovenant: {
      summary: "Righteousness credited through faith — received as gift rather than earned through performance.",
      keyVerseId: "GEN.15.6",
      keyReference: "Genesis 15:6",
      nature: "Fulfillment / Imputed",
      advancement: "Romans 4:5 — 'to the one who does not work but believes... his faith is counted as righteousness.' The OT pattern is confirmed, not invented."
    },
    continuity: "God is righteous and requires righteousness. The change: self-produced → gift-received.",
    connectingVerseId: "EPH.2.8"
  },
  {
    concept: "Promise & Fulfillment",
    oldCovenant: {
      summary: "Prophetic promises of a coming redeemer, king, and servant — building expectation over centuries.",
      keyVerseId: "GEN.3.15",
      keyReference: "Genesis 3:15",
      nature: "Promise / Anticipatory",
      limitation: "The promise was real but its full shape was not yet seen — 'seen from afar' (Hebrews 11:13)."
    },
    newCovenant: {
      summary: "The fulfillment of every OT covenant promise in the person and work of Messiah.",
      keyVerseId: "1CO.15.3",
      keyReference: "1 Corinthians 15:3",
      nature: "Fulfillment / Realized",
      advancement: "'According to the Scriptures' — the creed explicitly states that the NT events are OT promises accomplished."
    },
    continuity: "One God, one plan, one storyline. The change: anticipated → actualized.",
    connectingVerseId: "MIC.5.2"
  }
];

const NARRATIVE_FLOW_DATA = [
  {
    arcName: "The Redemptive Arc",
    description: "The single storyline of Scripture from creation's rupture to new creation's completion.",
    nodes: [
      { label: "Creation", verseId: "GEN.1.1", note: "God creates — everything is very good." },
      { label: "The Fall & First Promise", verseId: "GEN.3.15", note: "Sin enters — but the Seed is promised." },
      { label: "Faith Covenant", verseId: "GEN.15.6", note: "Abraham trusts — the covenant pattern is set." },
      { label: "Passover Deliverance", verseId: "EXO.12.13", note: "Blood provides rescue — the exodus picture." },
      { label: "Blood Principle", verseId: "LEV.17.11", note: "Life is in the blood — atonement explained." },
      { label: "Prophetic Vision", verseId: "ISA.53.5", note: "Suffering servant foreseen — 700 years ahead." },
      { label: "Bethlehem Birth", verseId: "MIC.5.2", note: "King's origin predicted — precise location." },
      { label: "Word Made Flesh", verseId: "JHN.1.1", note: "The eternal Word enters creation." },
      { label: "Lamb Revealed", verseId: "JHN.1.29", note: "John the Baptist points to Messiah." },
      { label: "Diagnosis", verseId: "ROM.3.23", note: "All have sinned — universal need established." },
      { label: "The Price", verseId: "ROM.6.23", note: "Wages of sin is death — gift is life." },
      { label: "No Condemnation", verseId: "ROM.8.1", note: "In Christ — the verdict is reversed." },
      { label: "New Creation", verseId: "REV.21.1", note: "All things made new — the arc complete." }
    ]
  },
  {
    arcName: "The Faith Arc",
    description: "How trust in God's word is the consistent covenant posture across all ages.",
    nodes: [
      { label: "Abraham's Trust", verseId: "GEN.15.6", note: "First explicit faith-righteousness equation." },
      { label: "Trust Over Understanding", verseId: "PRO.3.5", note: "Wisdom posture: lean on God not self." },
      { label: "Fear Replaced by Trust", verseId: "ISA.41.10", note: "Covenant people commanded to trust God's presence." },
      { label: "God's Love Act", verseId: "JHN.3.16", note: "Belief is the response to the gift." },
      { label: "Saved Through Faith", verseId: "EPH.2.8", note: "Faith as the receiving instrument of grace." },
      { label: "Faith Defined", verseId: "HEB.11.1", note: "The substance and evidence of unseen realities." },
      { label: "Faith That Lives", verseId: "JAS.2.17", note: "Real faith has visibly alive expression." }
    ]
  },
  {
    arcName: "The Atonement Arc",
    description: "Blood, sacrifice, and substitution from the first Passover to the final Lamb.",
    nodes: [
      { label: "Passover Blood", verseId: "EXO.12.13", note: "Blood as covenant boundary — death passes over." },
      { label: "Blood Principle", verseId: "LEV.17.11", note: "Life for life — foundational atonement logic." },
      { label: "Suffering Servant", verseId: "ISA.53.5", note: "Pierced for transgressions — vicarious suffering." },
      { label: "Lamb of God", verseId: "JHN.1.29", note: "John identifies Jesus as the atonement fulfillment." },
      { label: "Our Passover", verseId: "1CO.5.7", note: "Paul makes the Passover → Christ connection explicit." },
      { label: "Gospel Summary", verseId: "1CO.15.3", note: "Died for sins according to the Scriptures." },
      { label: "No Condemnation", verseId: "ROM.8.1", note: "Atonement's legal outcome: guilt removed." }
    ]
  },
  {
    arcName: "The Kingdom Arc",
    description: "God's sovereign rule — promised, expected, arriving, expanding, consummating.",
    nodes: [
      { label: "Creation Order", verseId: "GEN.1.1", note: "God reigns over all he made — original kingdom." },
      { label: "Kingdom Promised", verseId: "GEN.3.15", note: "Enmity will end — the ruler will come." },
      { label: "King's Birthplace", verseId: "MIC.5.2", note: "Ruler from Bethlehem — humble origins, eternal origins." },
      { label: "King Arrives", verseId: "JHN.1.1", note: "The Word enters — the kingdom takes flesh." },
      { label: "Kingdom Applied", verseId: "ROM.8.1", note: "The Spirit's reign — no condemnation in the King." },
      { label: "Kingdom Completed", verseId: "REV.21.1", note: "New heaven and earth — God reigns forever." }
    ]
  }
];

const VERSE_CENTRALITY = {
  "GEN.1.1": { score: 10.0, role: "Foundation", doctrines: ["creation", "sovereignty"], note: "The load-bearing first statement of all Scripture." },
  "GEN.3.15": { score: 9.5, role: "Protoevangelium", doctrines: ["redemption", "covenant", "messianic"], note: "First messianic promise — launches the entire redemptive plot." },
  "GEN.15.6": { score: 9.0, role: "Justification Pattern", doctrines: ["faith", "righteousness", "covenant"], note: "Paul's entire Romans 4 argument rests on this verse." },
  "EXO.12.13": { score: 8.5, role: "Sacrificial Type", doctrines: ["atonement", "passover", "blood"], note: "Passover pattern that Paul makes explicit in 1 Cor 5:7." },
  "LEV.17.11": { score: 8.0, role: "Atonement Principle", doctrines: ["blood", "atonement", "sacrifice"], note: "Foundational logic for why blood accomplishes forgiveness." },
  "ISA.53.5": { score: 9.8, role: "Suffering Servant", doctrines: ["atonement", "substitution", "messianic"], note: "Most cited OT passage in NT — precise prophetic fulfillment." },
  "MIC.5.2": { score: 8.0, role: "Birthplace Prophecy", doctrines: ["prophecy", "incarnation", "messianic"], note: "Geographic precision 700 years before fulfillment." },
  "JHN.1.1": { score: 9.5, role: "Logos Prologue", doctrines: ["divinity", "word", "creation"], note: "Establishes Messiah's eternal divine identity." },
  "JHN.1.29": { score: 9.0, role: "Lamb Identification", doctrines: ["atonement", "typology", "messianic"], note: "Explicitly connects the Levitical lamb system to Jesus." },
  "JHN.3.16": { score: 10.0, role: "Gospel Summary", doctrines: ["love", "salvation", "faith"], note: "The most recognizable verse — structural gospel summary." },
  "ROM.3.23": { score: 8.5, role: "Universal Diagnosis", doctrines: ["sin", "judgment", "need"], note: "Paul's universal verdict — the problem before the solution." },
  "ROM.6.23": { score: 8.5, role: "Wages vs Gift", doctrines: ["sin", "death", "grace", "life"], note: "The sharpest contrast: what sin earns vs what grace gives." },
  "ROM.8.1": { score: 9.5, role: "No Condemnation", doctrines: ["justification", "freedom", "covenant"], note: "The legal verdict of the gospel — standing not striving." },
  "1CO.5.7": { score: 8.0, role: "Passover Fulfillment", doctrines: ["typology", "atonement", "passover"], note: "Paul's explicit typological connection: Passover → Christ." },
  "1CO.15.3": { score: 9.0, role: "Gospel Creed", doctrines: ["atonement", "resurrection", "scripture"], note: "Earliest recorded gospel summary — pre-Pauline creed." },
  "EPH.2.8": { score: 9.5, role: "Grace by Faith", doctrines: ["grace", "faith", "salvation"], note: "Clearest statement of salvation's basis — not works, gift." },
  "EPH.2.9": { score: 8.5, role: "Works Excluded", doctrines: ["works", "grace", "boasting"], note: "Works explicitly excluded from salvation's basis." },
  "HEB.11.1": { score: 8.5, role: "Faith Definition", doctrines: ["faith", "hope", "assurance"], note: "The Bible's own definition of faith." },
  "JAS.2.17": { score: 8.0, role: "Living Faith", doctrines: ["faith", "works", "evidence"], note: "The evidence test for genuine faith." },
  "REV.21.1": { score: 9.0, role: "New Creation", doctrines: ["restoration", "eschatology", "hope"], note: "The completion of the Genesis 1 arc — creation renewed." },
  "PSA.23.1": { score: 8.5, role: "Shepherd Intimacy", doctrines: ["guidance", "provision", "trust"], note: "Most memorized verse — shepherd-covenant intimacy." },
  "PRO.3.5": { score: 7.5, role: "Trust Command", doctrines: ["trust", "wisdom", "guidance"], note: "Core wisdom posture: lean on God not self." },
  "ISA.41.10": { score: 8.0, role: "Fear Not Promise", doctrines: ["fear", "courage", "presence"], note: "God's covenant assurance in threat." },
  "2TI.1.7": { score: 7.5, role: "Spirit of Power", doctrines: ["fear", "power", "spirit"], note: "Discipleship posture — not timidity but courageous love." },
  "GEN.15.6": { score: 9.0, role: "Faith Righteousness", doctrines: ["faith", "righteousness", "covenant"], note: "OT foundation for NT justification by faith." }
};

const HIDDEN_CONNECTIONS_DATA = [
  {
    title: "Joseph ↔ Messiah",
    type: "typological",
    description: "Joseph's life mirrors the messianic pattern in striking structural parallels.",
    pairs: [
      { leftNote: "Joseph beloved of his father, sent to his brothers", rightNote: "Messiah sent from the Father to his own people", leftVerseId: null, rightVerseId: "JHN.1.1" },
      { leftNote: "Joseph rejected and sold for silver by his own brothers", rightNote: "Messiah rejected by his people, betrayed for 30 pieces", leftVerseId: null, rightVerseId: "ISA.53.5" },
      { leftNote: "Joseph goes down into the pit, appears dead", rightNote: "Messiah descends into death, buried", leftVerseId: null, rightVerseId: "1CO.15.3" },
      { leftNote: "Joseph raised to second highest throne, brings salvation to the nations", rightNote: "Messiah raised, seated at right hand, saves all nations", leftVerseId: null, rightVerseId: "ROM.8.1" }
    ]
  },
  {
    title: "Exodus ↔ Salvation Pattern",
    type: "structural",
    description: "The Exodus from Egypt is the structural template for spiritual salvation.",
    pairs: [
      { leftNote: "Israel enslaved in Egypt — bondage they cannot escape", rightNote: "Humanity enslaved to sin — cannot self-liberate", leftVerseId: "EXO.12.13", rightVerseId: "ROM.3.23" },
      { leftNote: "Passover blood on doorposts — protection through blood", rightNote: "Messiah's blood — the final Passover covering", leftVerseId: "EXO.12.13", rightVerseId: "JHN.1.29" },
      { leftNote: "Exodus into freedom through the Red Sea", rightNote: "Resurrection: death passed through into life", leftVerseId: "EXO.12.13", rightVerseId: "ROM.6.23" },
      { leftNote: "Mosaic covenant at Sinai — law given to the redeemed", rightNote: "New covenant — Spirit written on hearts", leftVerseId: "LEV.17.11", rightVerseId: "ROM.8.1" }
    ]
  },
  {
    title: "First Adam ↔ Last Adam",
    type: "typological",
    description: "Romans 5 and 1 Corintians 15 explicitly use Adam as the type of Messiah — the first and last Adam.",
    pairs: [
      { leftNote: "Adam in a garden — faced a test from the enemy", rightNote: "Messiah in Gethsemane/wilderness — faced the same test", leftVerseId: "GEN.3.15", rightVerseId: "JHN.1.1" },
      { leftNote: "Adam's disobedience brought sin and death to all", rightNote: "Messiah's obedience brings righteousness and life to all who believe", leftVerseId: "GEN.3.15", rightVerseId: "ROM.8.1" },
      { leftNote: "Through one man's failure — all enter condemnation", rightNote: "Through one man's gift — grace abounds to the many", leftVerseId: "ROM.3.23", rightVerseId: "ROM.8.1" }
    ]
  },
  {
    title: "Genesis 1 ↔ John 1 Echo",
    type: "literary",
    description: "John opens his gospel with a deliberate echo of Genesis 1 — 'In the beginning.' The parallel is architecturally intentional.",
    pairs: [
      { leftNote: "Genesis 1:1 — 'In the beginning God created'", rightNote: "John 1:1 — 'In the beginning was the Word'", leftVerseId: "GEN.1.1", rightVerseId: "JHN.1.1" },
      { leftNote: "God spoke — word brought light into darkness", rightNote: "The Word is the light of humanity — the same creative force", leftVerseId: "GEN.1.1", rightVerseId: "JHN.1.1" },
      { leftNote: "First creation — heaven and earth called into being", rightNote: "New creation — new heaven and earth promised", leftVerseId: "GEN.1.1", rightVerseId: "REV.21.1" }
    ]
  },
  {
    title: "Isaiah 53 ↔ Gospel Passion",
    type: "prophetic",
    description: "Isaiah 53 reads like an eyewitness account of the crucifixion — yet written 700 years before.",
    pairs: [
      { leftNote: "Isaiah 53:3 — despised and rejected of men", rightNote: "John 1:11 — 'He came to his own and his own did not receive him'", leftVerseId: "ISA.53.5", rightVerseId: "JHN.1.29" },
      { leftNote: "Isaiah 53:5 — pierced for our transgressions", rightNote: "Romans 5:8 — 'God shows his love: while we were sinners, Christ died'", leftVerseId: "ISA.53.5", rightVerseId: "1CO.15.3" },
      { leftNote: "Isaiah 53:10 — when his soul makes an offering for guilt", rightNote: "1 Corinthians 15:3 — 'Christ died for our sins according to the Scriptures'", leftVerseId: "ISA.53.5", rightVerseId: "1CO.15.3" }
    ]
  }
];

// ── INTELLIGENCE LAYER ENDPOINTS ──────────────────────────────────────

app.get("/api/v1/truth-trace/:verseId", (req, res) => {
  const verse = getVerseById(req.params.verseId);
  if (!verse) return res.status(404).json({ error: "Verse not found" });

  const whyItMatters = WHY_IT_MATTERS_MAP[verse.id] || null;
  const contextIntegrity = buildContextIntegrityPayload(verse);
  const misuse = MISUSE_DETECTION_DATA[verse.id] || null;
  const weight = VERSE_CENTRALITY[verse.id] || null;
  const parallelLinks = findParallelPassagesForVerse(verse.id);
  const prophecyLinks = PROPHECY_FULFILLMENT_PAIRS.filter(
    (p) => p.prophecyVerseId === verse.id || p.fulfillmentVerseId === verse.id
  );

  const doctrinesLinked = [];
  Object.entries(DOCTRINE_MAP).forEach(([key, doc]) => {
    const allIds = [...doc.keyVerses, ...doc.supportingVerses, ...doc.debatedPassages];
    if (allIds.includes(verse.id)) {
      doctrinesLinked.push({ key, name: doc.name });
    }
  });

  const symbolAppearances = [];
  Object.entries(SYMBOL_MAP).forEach(([symbol, data]) => {
    const appears = data.developmentArc.some((entry) => entry.verseId === verse.id);
    if (appears) symbolAppearances.push(symbol);
  });

  return res.json({
    verseId: verse.id,
    reference: verse.reference,
    text: verse.text,
    sourceVerification: {
      translation: verse.translation,
      originalLanguage: verse.original.language,
      originalText: verse.original.text,
      strongsEntries: verse.original.strongs || []
    },
    interpretationPathway: verse.keyLayers,
    historicalContext: {
      timeline: verse.contextTimeline,
      era: BIBLICAL_ERA_MAP[verse.book] || "Unknown"
    },
    crossReferences: verse.crossReferences,
    whyItMatters,
    misuse,
    parallelLinks,
    prophecyLinks,
    doctrinesLinked,
    symbolAppearances,
    verseWeight: weight,
    contextIntegrity: {
      isCommonlyMisquoted: contextIntegrity.isCommonlyMisquoted,
      contextWarning: contextIntegrity.contextWarning,
      bookPurpose: contextIntegrity.bookPurpose
    }
  });
});

app.get("/api/v1/why-it-matters/:verseId", (req, res) => {
  const verse = getVerseById(req.params.verseId);
  if (!verse) return res.status(404).json({ error: "Verse not found" });

  const data = WHY_IT_MATTERS_MAP[verse.id];
  const fallback = {
    whatItMeans: verse.keyLayers.literal,
    whyItMatters: verse.keyLayers.historical,
    howItApplies: verse.keyLayers.symbolic
  };

  return res.json({
    verseId: verse.id,
    reference: verse.reference,
    text: verse.text,
    ...(data || fallback)
  });
});

app.get("/api/v1/concept-dna", (req, res) => {
  const concept = String(req.query.concept || "").trim();
  if (!concept) return res.status(400).json({ error: "concept parameter is required" });

  const normalized = normalizedString(concept);

  const coreVerses = scriptureData.verses.filter(
    (v) => v.themes.some((t) => normalizedString(t) === normalized)
  );

  const supportingVerses = scriptureData.verses.filter(
    (v) =>
      !coreVerses.includes(v) &&
      (normalizedString(v.text).includes(normalized) ||
        v.themes.some((t) => normalizedString(t).includes(normalized)))
  );

  const firstAppearance = sortedCanonicalVerses().find(
    (v) =>
      v.themes.some((t) => normalizedString(t).includes(normalized)) ||
      normalizedString(v.text).includes(normalized)
  );

  const allPeople = uniqueStrings(coreVerses.flatMap((v) => v.people));
  const allEvents = uniqueStrings(coreVerses.flatMap((v) => v.events));

  const symbolData = SYMBOL_MAP[normalized] || null;
  const doctrineKey = Object.keys(DOCTRINE_MAP).find(
    (k) => normalizedString(k) === normalized || normalizedString(DOCTRINE_MAP[k].name) === normalized
  );
  const doctrineData = doctrineKey ? DOCTRINE_MAP[doctrineKey] : null;

  const eraBreakdown = {};
  coreVerses.forEach((v) => {
    const era = BIBLICAL_ERA_MAP[v.book] || "Unknown";
    if (!eraBreakdown[era]) eraBreakdown[era] = 0;
    eraBreakdown[era]++;
  });

  const conflictsLinked = SPIRITUAL_CONFLICTS.filter(
    (c) =>
      normalizedString(c.sideA.label).includes(normalized) ||
      normalizedString(c.sideB.label).includes(normalized) ||
      normalizedString(c.title).includes(normalized)
  );

  return res.json({
    concept,
    profile: {
      firstAppearance: firstAppearance
        ? { reference: firstAppearance.reference, text: firstAppearance.text, book: firstAppearance.book, era: BIBLICAL_ERA_MAP[firstAppearance.book] || "Unknown" }
        : null,
      coreVersesCount: coreVerses.length,
      supportingVersesCount: supportingVerses.length,
      eraDistribution: eraBreakdown,
      keyPeople: allPeople.slice(0, 6),
      keyEvents: allEvents.slice(0, 6),
      symbolicMeanings: symbolData ? symbolData.symbolMeanings : [],
      doctrineDefinition: doctrineData ? doctrineData.definition : null,
      conflictTensions: conflictsLinked.map((c) => c.title)
    },
    coreVerses: coreVerses.map(mapSummary),
    supportingVerses: supportingVerses.slice(0, 5).map(mapSummary),
    symbolProfile: symbolData
  });
});

app.get("/api/v1/conflicts", (req, res) => {
  const id = String(req.query.id || "").trim();
  if (id) {
    const conflict = SPIRITUAL_CONFLICTS.find((c) => c.id === id);
    if (!conflict) return res.status(404).json({ error: `Conflict "${id}" not found.` });
    const enrichSide = (side) => ({
      ...side,
      verseObjects: (side.keyVerses || []).map((vid) => getVerseById(vid)).filter(Boolean).map(mapSummary)
    });
    return res.json({
      ...conflict,
      sideA: enrichSide(conflict.sideA),
      sideB: enrichSide(conflict.sideB),
      resolutionVerse: getVerseById(conflict.resolutionVerseId) ? mapSummary(getVerseById(conflict.resolutionVerseId)) : null
    });
  }
  return res.json({
    conflicts: SPIRITUAL_CONFLICTS.map((c) => ({
      id: c.id, title: c.title, tension: c.tension
    }))
  });
});

app.get("/api/v1/misuse-check/:verseId", (req, res) => {
  const verse = getVerseById(req.params.verseId);
  if (!verse) return res.status(404).json({ error: "Verse not found" });

  const data = MISUSE_DETECTION_DATA[verse.id];
  if (!data) {
    return res.json({
      verseId: verse.id,
      reference: verse.reference,
      misuseFlagged: false,
      message: "No common misuse pattern detected for this verse.",
      contextWarning: COMMONLY_MISQUOTED.has(verse.id)
        ? `${verse.reference} is frequently quoted outside its context.`
        : null
    });
  }

  return res.json({
    verseId: verse.id,
    reference: verse.reference,
    text: verse.text,
    misuseFlagged: true,
    ...data,
    balancingVerseObjects: (data.balancingVerses || []).map((id) => getVerseById(id)).filter(Boolean).map(mapSummary)
  });
});

app.get("/api/v1/verse-weight", (req, res) => {
  const topic = normalizedString(req.query.topic || "");

  if (topic) {
    const doctrineKey = Object.keys(DOCTRINE_MAP).find(
      (k) => normalizedString(k).includes(topic) || normalizedString(DOCTRINE_MAP[k].name).includes(topic)
    );
    const relevantIds = doctrineKey
      ? [...new Set([...DOCTRINE_MAP[doctrineKey].keyVerses, ...DOCTRINE_MAP[doctrineKey].supportingVerses])]
      : scriptureData.verses
          .filter((v) => v.themes.some((t) => normalizedString(t).includes(topic)))
          .map((v) => v.id);

    const ranked = relevantIds
      .map((id) => {
        const verse = getVerseById(id);
        const weight = VERSE_CENTRALITY[id];
        return verse && weight ? { ...mapSummary(verse), weight } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.weight.score - a.weight.score);

    return res.json({ topic, ranked });
  }

  const all = Object.entries(VERSE_CENTRALITY)
    .map(([id, weight]) => {
      const verse = getVerseById(id);
      return verse ? { ...mapSummary(verse), weight } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.weight.score - a.weight.score);

  return res.json({ topic: null, ranked: all });
});

app.post("/api/v1/full-counsel", (req, res) => {
  const { topic = "" } = req.body || {};
  const normalized = normalizedString(topic);
  if (!normalized) return res.status(400).json({ error: "topic required" });

  const allVerses = scriptureData.verses;

  const coreVerses = allVerses.filter((v) =>
    v.themes.some((t) => normalizedString(t) === normalized)
  );

  const supportingVerses = allVerses.filter(
    (v) =>
      !coreVerses.includes(v) &&
      (normalizedString(v.text).includes(normalized) ||
        v.themes.some((t) => normalizedString(t).includes(normalized)))
  );

  const relatedConflicts = SPIRITUAL_CONFLICTS.filter(
    (c) =>
      normalizedString(c.title).includes(normalized) ||
      normalizedString(c.sideA.label).includes(normalized) ||
      normalizedString(c.sideB.label).includes(normalized)
  );

  const relatedDoctrines = Object.entries(DOCTRINE_MAP)
    .filter(([k, d]) => {
      const allIds = [...d.keyVerses, ...d.supportingVerses, ...d.debatedPassages];
      return (
        normalizedString(d.name).includes(normalized) ||
        d.timeline.some((t) => allIds.some((id) => coreVerses.find((v) => v.id === id)))
      );
    })
    .map(([key, d]) => ({ key, name: d.name, definition: d.definition }));

  const debatedVerses = allVerses.filter((v) =>
    Object.values(DOCTRINE_MAP).some((d) => d.debatedPassages.includes(v.id) && coreVerses.some((cv) => cv.id !== v.id))
  );

  const misusedWithinScope = coreVerses
    .filter((v) => MISUSE_DETECTION_DATA[v.id])
    .map((v) => ({ reference: v.reference, commonMisuse: MISUSE_DETECTION_DATA[v.id].commonMisuse }));

  return res.json({
    topic,
    summary: `Full biblical counsel on "${topic}" — ${coreVerses.length} core verses, ${supportingVerses.length} supporting verses across ${[...new Set(coreVerses.map((v) => v.book))].length} books.`,
    coreVerses: coreVerses.map(mapSummary),
    supportingVerses: supportingVerses.slice(0, 8).map(mapSummary),
    debatedVerses: debatedVerses.map(mapSummary),
    relatedConflicts: relatedConflicts.map((c) => ({ id: c.id, title: c.title, resolution: c.resolution })),
    relatedDoctrines,
    misusedWithinScope,
    balancingPerspective: relatedConflicts.length > 0
      ? relatedConflicts.map((c) => `${c.sideA.label} vs ${c.sideB.label}: ${c.resolution}`).join(" | ")
      : null
  });
});

app.get("/api/v1/cross-covenant", (req, res) => {
  const concept = normalizedString(req.query.concept || "");
  if (!concept) {
    return res.json({
      concepts: CROSS_COVENANT_DATA.map((c) => c.concept)
    });
  }
  const entry = CROSS_COVENANT_DATA.find((c) => normalizedString(c.concept).includes(concept));
  if (!entry) return res.status(404).json({ error: `No cross-covenant data for "${concept}".` });

  const enriched = {
    ...entry,
    oldCovenant: {
      ...entry.oldCovenant,
      verseObject: getVerseById(entry.oldCovenant.keyVerseId) ? mapSummary(getVerseById(entry.oldCovenant.keyVerseId)) : null
    },
    newCovenant: {
      ...entry.newCovenant,
      verseObject: getVerseById(entry.newCovenant.keyVerseId) ? mapSummary(getVerseById(entry.newCovenant.keyVerseId)) : null
    },
    connectingVerse: getVerseById(entry.connectingVerseId) ? mapSummary(getVerseById(entry.connectingVerseId)) : null
  };
  return res.json(enriched);
});

app.get("/api/v1/narrative-flow", (req, res) => {
  const arcName = String(req.query.arc || "").trim();

  const enrichArc = (arc) => ({
    ...arc,
    nodes: arc.nodes.map((n) => {
      const verse = getVerseById(n.verseId);
      return { ...n, reference: verse ? verse.reference : n.verseId, text: verse ? verse.text : null };
    })
  });

  if (arcName) {
    const arc = NARRATIVE_FLOW_DATA.find((a) => a.arcName.toLowerCase().includes(arcName.toLowerCase()));
    if (!arc) return res.status(404).json({ error: `Arc "${arcName}" not found.` });
    return res.json(enrichArc(arc));
  }

  return res.json({ arcs: NARRATIVE_FLOW_DATA.map(enrichArc) });
});

app.get("/api/v1/symbols", (req, res) => {
  const symbol = normalizedString(req.query.symbol || "");
  if (!symbol) {
    return res.json({
      symbols: Object.keys(SYMBOL_MAP).map((s) => ({
        symbol: s,
        definition: SYMBOL_MAP[s].definition,
        firstBook: SYMBOL_MAP[s].firstBook
      }))
    });
  }
  const data = SYMBOL_MAP[symbol] || Object.entries(SYMBOL_MAP).find(([k]) => k.includes(symbol))?.[1];
  if (!data) return res.status(404).json({ error: `Symbol "${symbol}" not found.` });

  const enriched = {
    ...data,
    developmentArc: data.developmentArc.map((entry) => {
      const verse = getVerseById(entry.verseId);
      return { ...entry, reference: verse ? verse.reference : entry.verseId, text: verse ? verse.text : null };
    })
  };
  return res.json({ symbol, ...enriched });
});

app.get("/api/v1/hidden-connections", (req, res) => {
  const type = String(req.query.type || "").trim();
  let data = HIDDEN_CONNECTIONS_DATA;
  if (type) {
    data = HIDDEN_CONNECTIONS_DATA.filter((c) => c.type === type || c.title.toLowerCase().includes(type.toLowerCase()));
  }

  const enriched = data.map((connection) => ({
    ...connection,
    pairs: connection.pairs.map((pair) => {
      const leftVerse = pair.leftVerseId ? getVerseById(pair.leftVerseId) : null;
      const rightVerse = pair.rightVerseId ? getVerseById(pair.rightVerseId) : null;
      return {
        ...pair,
        leftReference: leftVerse ? leftVerse.reference : null,
        leftText: leftVerse ? leftVerse.text : null,
        rightReference: rightVerse ? rightVerse.reference : null,
        rightText: rightVerse ? rightVerse.text : null
      };
    })
  }));

  return res.json({ connections: enriched });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Scripture Key server running on http://localhost:${PORT}`);
});
