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
    contextGuard = true
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

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Scripture Key server running on http://localhost:${PORT}`);
});
