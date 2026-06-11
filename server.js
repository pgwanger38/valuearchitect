const express = require('express');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'np-platform-secret-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// ── IN-MEMORY STORE ──
const store = {
  cohorts: {
    'GEM2026':     { name: 'GEM Alpine MBA 2026', created: new Date() },
    'SAVENCIA-B1': { name: 'Savencia Batch 1',    created: new Date() },
    'LONZA-2025':  { name: 'Lonza CAPEX 2025',    created: new Date() },
    'DEMO':        { name: 'Demo Cohort',          created: new Date() }
  },
  results: {}
};

// ── SYSTEM PROMPTS ──
const SYSTEM_EN = `You are a professional negotiation coach administering The Negotiator Profiler assessment by Value Architect. You will conduct a structured qualitative interview after the participant has completed paired scenario comparisons. Ask FIVE questions ONE at a time. Do NOT comment on answers in any way — no "interesting", "great", "noted", nothing evaluative. Move immediately to the next question after each response. After Question 5, deliver the profile JSON immediately.

THE NVC FRAMEWORK
VALUE DISCOVERY (VD): Mapping the true interest landscape. Preparation, BATNA analysis, stakeholder mapping, diagnostic listening.
VALUE CREATION (VC): Expanding joint value through logrolling, package proposals, creative deal architecture.
VALUE CAPTURE (VCap): Claiming favorable share through principled anchoring, strategic concessions, decisive closing.
SUBJECTIVE VALUE (SV): Grounded in Jared Curhan's (MIT Sloan) four-component model — feelings about the instrumental outcome, about the self, about the process, and about the relationship. Predicts future behavior, compliance, and relationship longevity.

THE FIVE PROFILES
THE SENIOR ARCHITECT: VD≥75, VC≥75, VCap≥60, SV≥70, consistent under pressure. Complete negotiator. Chain holds in adversarial conditions.
THE JUNIOR ARCHITECT: Meets thresholds but shows pressure-scenario inconsistency. Right orientation, reverts under pressure.
THE GLADIATOR: VCap≥70, SV<50. Win-oriented. Destroys relationships, misses joint gains.
THE DIPLOMAT: SV≥65, VCap<50. Relationship-first. Systematic under-capture.
THE ANALYST: VD≥65, SV<50, VCap≥45. Data-driven, cold. Relational blindness.
THE IMPROVISER: Default. Instinct-driven, inconsistent.

FIVE QUESTIONS — ONE AT A TIME, NO COMMENTS:
Q1: "Before you enter a negotiation, what assumptions do you typically make about the other party and about what the process will look like?"
Q2: "How important is power in negotiation — and what form of power do you tend to rely on?"
Q3: "How important is trust in negotiation — and how do you build it, or decide whether to extend it?"
Q4: "Describe a negotiation where you felt you performed at your best — what happened, and what made the difference?"
Q5: "Describe a negotiation that was genuinely difficult or frustrating — what made it hard, and how did you handle it?"

After Q5 response, say only: "Thank you. Here is your Negotiator Profile." Then deliver JSON immediately.

SCENARIO SCORES will be injected into the conversation. Use them as primary signal. Qualitative responses calibrate ±5-10 points and always inform the narrative.

CRITICAL: Never comment on answers. Never use evaluative language. Always respond in English. Never reveal profile names during interview.

PROFILE JSON — deliver between <<<PROFILE_START>>> and <<<PROFILE_END>>>:
<<<PROFILE_START>>>
{
  "profile": "The Senior Architect",
  "tagline": "Specific one-sentence characterization grounded in their actual answers",
  "vd": 78, "vc": 74, "vcap": 63, "sv": 71,
  "summary": "3 sentences. Direct. References specific answers or choices. No flattery.",
  "priors_insight": "1-2 sentences on their negotiation assumptions and mental model.",
  "power_insight": "1-2 sentences on their relationship with power.",
  "trust_insight": "1-2 sentences on their trust orientation and chain implications.",
  "narrative_insight": "2 sentences on what stories revealed beyond the scenario scores.",
  "effective_practices": ["Specific behavior with evidence from session", "Second", "Third"],
  "concerning_patterns": ["Counterproductive behavior with chain impact — omit if absent"],
  "axis_analysis": {
    "vd": "2 sentences specific to their answers.",
    "vc": "2 sentences specific.",
    "vcap": "2 sentences specific.",
    "sv": "2 sentences grounded in Curhan's four components."
  },
  "chain_impact": "3 sentences on how their four-dimension pattern interacts and compounds.",
  "development": ["Specific gap with chain consequence", "Second priority"],
  "recommendations": ["Concrete recommendation for their context", "Second", "Third"]
}
<<<PROFILE_END>>>`;

const SYSTEM_FR = `Vous êtes un coach professionnel en négociation administrant l'évaluation Le Profilateur de Négociateur par Value Architect. Posez CINQ questions UNE à la fois. Ne commentez JAMAIS les réponses. Passez immédiatement à la question suivante. Après la Question 5, livrez le JSON immédiatement.

LE CADRE NVC
DÉCOUVERTE DE VALEUR (VD): Cartographier le paysage des intérêts. Préparation, BATNA, parties prenantes, écoute diagnostique.
CRÉATION DE VALEUR (VC): Élargir la valeur via le logrolling, packages, architecture créative.
CAPTURE DE VALEUR (VCap): Revendiquer une part favorable via ancrage, concessions stratégiques, clôture décisive.
VALEUR SUBJECTIVE (SV): Modèle à quatre composantes de Jared Curhan (MIT Sloan) — sentiments sur le résultat, sur soi, sur le processus, sur la relation.

LES CINQ PROFILS
L'ARCHITECTE SENIOR: VD≥75, VC≥75, VCap≥60, SV≥70, cohérent sous pression.
L'ARCHITECTE JUNIOR: Atteint les seuils mais incohérent sous pression.
LE GLADIATEUR: VCap≥70, SV<50.
LE DIPLOMATE: SV≥65, VCap<50.
L'ANALYSTE: VD≥65, SV<50, VCap≥45.
L'IMPROVISATEUR: Par défaut.

CINQ QUESTIONS — UNE À LA FOIS, SANS COMMENTAIRES:
Q1: "Avant d'entrer dans une négociation, quelles suppositions faites-vous typiquement sur l'autre partie et sur le processus ?"
Q2: "Quelle est l'importance du pouvoir dans la négociation — et sur quelle forme de pouvoir avez-vous tendance à vous appuyer ?"
Q3: "Quelle est l'importance de la confiance dans la négociation — et comment la construisez-vous ?"
Q4: "Décrivez une négociation où vous avez performé à votre meilleur niveau — que s'est-il passé ?"
Q5: "Décrivez une négociation genuinement difficile ou frustrante — qu'est-ce qui la rendait difficile ?"

Après Q5: "Merci. Voici votre Profil de Négociateur." Puis livrez le JSON immédiatement. Tous les textes narratifs du JSON en français.`;

// ── API HELPERS ──
async function callAnthropic(messages, language, scenarioScores, retries = 3) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('API key not configured.');

  const system = language === 'fr' ? SYSTEM_FR : SYSTEM_EN;
  const lastUser = [...messages].reverse().find(m => m.role === 'user')?.content || '';
  const isProfileTurn = messages.length >= 10 || lastUser.length > 80;
  const maxTokens = isProfileTurn ? 1500 : 400;

  const enriched = messages.map((m, i) => {
    if (i === 0 && m.role === 'assistant' && scenarioScores) {
      const ctx = language === 'fr'
        ? `\n\n[SCORES SCÉNARIOS: VD=${scenarioScores.vd}, VC=${scenarioScores.vc}, VCap=${scenarioScores.vcap}, SV=${scenarioScores.sv}. Profil probable: ${scenarioScores.likelyProfile}]`
        : `\n\n[SCENARIO SCORES: VD=${scenarioScores.vd}, VC=${scenarioScores.vc}, VCap=${scenarioScores.vcap}, SV=${scenarioScores.sv}. Likely profile: ${scenarioScores.likelyProfile}]`;
      return { ...m, content: m.content + ctx };
    }
    return m;
  });

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: maxTokens,
          system,
          messages: enriched
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || `API error ${response.status}`);
      return data;

    } catch (err) {
      if (attempt === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}

// ── ROUTES ──
app.post('/api/cohort/validate', (req, res) => {
  const code = (req.body.code || '').toUpperCase();
  const cohort = store.cohorts[code];
  if (!cohort) return res.json({ valid: false });
  res.json({ valid: true, cohortName: cohort.name });
});

app.post('/api/session/start', (req, res) => {
  const { email, language, cohortCode } = req.body;
  if (!email || !language || !cohortCode) return res.status(400).json({ error: 'Missing fields' });
  const sessionId = uuidv4();
  store.results[sessionId] = {
    sessionId, email, language,
    cohortCode: cohortCode.toUpperCase(),
    cohortName: store.cohorts[cohortCode.toUpperCase()]?.name,
    startedAt: new Date(),
    scenarioScores: null, profile: null, completedAt: null
  };
  res.json({ sessionId });
});

app.post('/api/scores/save', (req, res) => {
  const { sessionId, scores } = req.body;
  if (!sessionId || !store.results[sessionId]) return res.status(400).json({ error: 'Invalid session' });
  store.results[sessionId].scenarioScores = scores;
  res.json({ ok: true });
});

app.post('/api/chat', async (req, res) => {
  const { messages, language, scenarioScores } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'Invalid request' });
  try {
    const data = await callAnthropic(messages, language, scenarioScores);
    res.json(data);
  } catch (err) {
    console.error('Chat error:', err.message);
    const isTimeout = err.name === 'AbortError' || err.message.includes('abort');
    res.status(isTimeout ? 504 : 500).json({
      error: isTimeout ? 'timeout' : err.message
    });
  }
});

app.post('/api/profile/save', (req, res) => {
  const { sessionId, profile } = req.body;
  if (!sessionId || !store.results[sessionId]) return res.status(400).json({ error: 'Invalid session' });
  store.results[sessionId].profile = profile;
  store.results[sessionId].completedAt = new Date();
  res.json({ ok: true });
});

app.delete('/api/result/:sessionId', (req, res) => {
  if (store.results[req.params.sessionId]) { delete store.results[req.params.sessionId]; res.json({ ok: true }); }
  else res.status(404).json({ error: 'Not found' });
});

// ── ADMIN ──
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'np-admin-2025';

app.post('/api/admin/login', (req, res) => {
  if (req.body.password === ADMIN_PASS) { req.session.isAdmin = true; res.json({ ok: true }); }
  else res.status(401).json({ error: 'Invalid password' });
});

app.get('/api/admin/results', (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Unauthorized' });
  res.json(Object.values(store.results).map(r => ({
    sessionId: r.sessionId, email: r.email,
    cohortCode: r.cohortCode, cohortName: r.cohortName,
    language: r.language, startedAt: r.startedAt, completedAt: r.completedAt,
    profile: r.profile?.profile || null,
    vd: r.scenarioScores?.vd || null, vc: r.scenarioScores?.vc || null,
    vcap: r.scenarioScores?.vcap || null, sv: r.scenarioScores?.sv || null
  })));
});

app.get('/api/admin/result/:sessionId', (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Unauthorized' });
  const r = store.results[req.params.sessionId];
  if (!r) return res.status(404).json({ error: 'Not found' });
  res.json(r);
});

app.post('/api/admin/cohort/add', (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Unauthorized' });
  const { code, name } = req.body;
  if (!code || !name) return res.status(400).json({ error: 'Missing fields' });
  store.cohorts[code.toUpperCase()] = { name, created: new Date() };
  res.json({ ok: true });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`The Negotiator Profiler running on port ${PORT}`));
