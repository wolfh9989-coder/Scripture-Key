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

app.get("/api/v1/scripture", (req, res) => {
  const summaries = scriptureData.verses.map(mapSummary);
  res.json({ verses: summaries });
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
