const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const dataPath = path.join(__dirname, "data", "scripture-phase1.json");
const scriptureData = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

function getVerseById(verseId) {
  return scriptureData.verses.find((verse) => verse.id === verseId);
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

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Scripture Key server running on http://localhost:${PORT}`);
});
