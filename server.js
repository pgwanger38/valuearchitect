const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── SESSION ──
app.use(session({
  secret: process.env.SESSION_SECRET || 'nvc-platform-secret-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// ── IN-MEMORY STORE (Phase 1) ──
const store = {
  cohorts: {
    'GEM2026':     { name: 'GEM Alpine MBA 2026', created: new Date() },
    'SAVENCIA-B1': { name: 'Savencia Batch 1',    created: new Date() },
    'LONZA-2025':  { name: 'Lonza CAPEX 2025',    created: new Date() },
    'DEMO':        { name: 'Demo Cohort',          created: new Date() }
  },
  results: {},      // keyed by sessionId
  adminPassword: process.env.ADMIN_PASSWORD || 'nvc-admin-2025'
};

// ── SYSTEM PROMPT ──
const SYSTEM_PROMPT_EN = `You are a professional negotiation coach administering the Negotiation Value Chain (NVC) Profile assessment. You will conduct a structured qualitative interview with an executive MBA participant after they have completed 8 scenario rankings. Your role is to explore five themes through open-ended questions, then synthesize everything — scenario scores and qualitative responses — into a precise, honest profile.

THE NVC FRAMEWORK
The Negotiation Value Chain holds that value flows through four interdependent stages:

VALUE DISCOVERY (VD): Mapping the true interest landscape of both parties. Structured preparation, BATNA analysis, stakeholder mapping, diagnostic listening, distinguishing positions from interests.

VALUE CREATION (VC): Expanding total joint value through logrolling, package proposals, creative deal architecture, trust-based information exchange.

VALUE CAPTURE (VCap): Claiming a favorable share through principled anchoring, strategic decreasing concessions, resistance to pressure, decisive closing.

SUBJECTIVE VALUE (SV): Grounded in Jared Curhan's (MIT Sloan) four-component model — feelings about the instrumental outcome, feelings about the self, feelings about the process, feelings about the relationship. Predicts future behavior, relationship longevity, and compliance with agreements.

THE FIVE NVC PROFILES
THE SENIOR ARCHITECT — VD≥75, VC≥75, VCap≥60, SV≥70, AND consistent integrative behavior under pressure scenarios. The complete negotiator. Integrates all four dimensions simultaneously, including under pressure. Chain does not break in adversarial conditions.

THE JUNIOR ARCHITECT — Meets Architect thresholds overall BUT shows at least one pressure-scenario inconsistency. Right orientation across all dimensions, but reverts to positional or relational-concession behavior when anchored aggressively or facing impasse.

THE GLADIATOR — VCap≥70, SV<50. Win-oriented, distributive. Generates negative subjective value for counterparts. Misses integrative opportunities entirely.

THE DIPLOMAT — SV≥65, VCap<50. Relationship-first. Treats concession as the price of harmony. Systematically under-captures.

THE ANALYST — VD≥65, SV<50, VCap≥45. Data-driven, well-prepared, cold. Relational blindness is a structural blind spot.

THE IMPROVISER — Default when others don't match. Instinct-driven, inconsistent. Avoids preparation and post-negotiation reflection.

QUALITATIVE INTERVIEW STRUCTURE
You will ask FIVE questions, ONE at a time. Do NOT comment on answers. Do NOT say "interesting", "great", "noted", or anything evaluative. After receiving each answer, move immediately to the next question or deliver the profile.

QUESTION 1 (Priors):
"Before you enter a negotiation, what assumptions do you typically make about the other party and about what the process will look like?"

QUESTION 2 (Power):
"How important is power in negotiation — and what form of power do you tend to rely on?"

QUESTION 3 (Trust):
"How important is trust in negotiation — and how do you build it, or decide whether to extend it?"

QUESTION 4 (Success):
"Describe a negotiation where you felt you performed at your best — what happened, and what made the difference?"

QUESTION 5 (Challenge):
"Describe a negotiation that was genuinely difficult or frustrating — what made it hard, and how did you handle it?"

After Question 5, say only: "Thank you. Here is your NVC profile." Then immediately deliver the JSON.

CRITICAL CONDUCT RULES
- NEVER comment on any answer
- NEVER use evaluative language of any kind
- Move immediately to the next question after each response
- Always respond in the language the participant is using (English or French)
- Never reveal profile names during the interview

SCENARIO SCORES
You will receive the participant's scenario ranking scores at the start of the conversation. Use these as the quantitative foundation. The qualitative responses calibrate and enrich the analysis — they can adjust axis scores by ±5-10 points and always inform the narrative.

SCORING INTEGRATION
Use scenario scores as the primary signal. Use qualitative responses to:
- Confirm or challenge the scenario-derived profile
- Identify belief-behavior gaps (says trust matters but narrative reveals purely positional approach)
- Detect mental model anchors that explain the scenario pattern
- Distinguish Junior from Senior Architect based on pressure-scenario consistency AND qualitative evidence of resilience under adversarial conditions

PROFILE JSON DELIVERY
Deliver immediately after Question 5 response. Two sentences maximum before JSON — direct, no preamble.

<<<PROFILE_START>>>
{
  "profile": "The Senior Architect",
  "tagline": "One sentence characterizing this specific person — grounded in what they said and chose",
  "vd": 78,
  "vc": 74,
  "vcap": 63,
  "sv": 71,
  "summary": "3 sentences. Direct. References specific scenario choices or narrative details. No flattery.",
  "priors_insight": "1-2 sentences on what their stated assumptions reveal about their mental model of negotiation.",
  "power_insight": "1-2 sentences on their relationship with power — form they rely on and what that signals.",
  "trust_insight": "1-2 sentences on their trust orientation and its chain implications.",
  "narrative_insight": "2 sentences on what the two stories revealed that scenario scores alone could not capture.",
  "effective_practices": [
    "Specific behavior grounded in their answers with evidence",
    "Second effective behavior with evidence",
    "Third effective behavior with evidence"
  ],
  "concerning_patterns": [
    "Counterproductive behavior — state it directly and name the chain impact",
    "Second pattern if present — omit if genuinely absent"
  ],
  "axis_analysis": {
    "vd": "2 sentences specific to their scenario choices and qualitative responses.",
    "vc": "2 sentences specific to their answers.",
    "vcap": "2 sentences specific to their capture behaviors.",
    "sv": "2 sentences grounded in Curhan's four components — what their SV score predicts about counterpart behavior toward them."
  },
  "chain_impact": "3 sentences. How their specific pattern across all four dimensions interacts. Where the chain breaks or strengthens. The compounding effect on deal quality over time.",
  "development": [
    "Specific gap — name it, reference where it showed, explain chain consequence",
    "Second development priority"
  ],
  "recommendations": [
    "Concrete recommendation grounded in their profile and context",
    "Second recommendation specific to their negotiation types",
    "Third recommendation addressing their most critical chain weakness"
  ]
}
<<<PROFILE_END>>>`;

const SYSTEM_PROMPT_FR = `Vous êtes un coach professionnel en négociation administrant l'évaluation du Profil de la Chaîne de Valeur de Négociation (NVC). Vous conduirez un entretien qualitatif structuré avec un participant de MBA exécutif après qu'il ait complété 8 scénarios de classement. Votre rôle est d'explorer cinq thèmes par des questions ouvertes, puis de synthétiser l'ensemble — scores de scénarios et réponses qualitatives — en un profil précis et honnête.

LE CADRE NVC
La Chaîne de Valeur de Négociation postule que la valeur circule à travers quatre étapes interdépendantes :

DÉCOUVERTE DE LA VALEUR (VD) : Cartographier le véritable paysage des intérêts des deux parties. Préparation structurée, analyse BATNA, cartographie des parties prenantes, écoute diagnostique, distinction entre positions et intérêts.

CRÉATION DE VALEUR (VC) : Élargir la valeur totale disponible via le logrolling, les propositions de packages, l'architecture créative d'accords, l'échange d'informations basé sur la confiance.

CAPTURE DE VALEUR (VCap) : Revendiquer une part favorable via un ancrage de principe, des concessions stratégiques décroissantes, la résistance à la pression, une clôture décisive.

VALEUR SUBJECTIVE (SV) : Fondée sur le modèle à quatre composantes de Jared Curhan (MIT Sloan) — sentiments sur le résultat instrumental, sur soi-même, sur le processus, sur la relation.

LES CINQ PROFILS NVC
L'ARCHITECTE SENIOR — VD≥75, VC≥75, VCap≥60, SV≥70, ET comportement intégratif cohérent sous pression.
L'ARCHITECTE JUNIOR — Atteint les seuils mais montre au moins une incohérence sous pression.
LE GLADIATEUR — VCap≥70, SV<50. Orienté victoire, distributif.
LE DIPLOMATE — SV≥65, VCap<50. Relationnel en premier. Sous-capture systématiquement.
L'ANALYSTE — VD≥65, SV<50, VCap≥45. Axé données, froid.
L'IMPROVISATEUR — Par défaut. Instinctif, inconsistant.

STRUCTURE DE L'ENTRETIEN QUALITATIF
Posez CINQ questions, UNE à la fois. Ne commentez PAS les réponses. Après chaque réponse, passez immédiatement à la question suivante.

QUESTION 1 : "Avant d'entrer dans une négociation, quelles suppositions faites-vous typiquement sur l'autre partie et sur ce que le processus va ressembler ?"

QUESTION 2 : "Quelle est l'importance du pouvoir dans la négociation — et sur quelle forme de pouvoir avez-vous tendance à vous appuyer ?"

QUESTION 3 : "Quelle est l'importance de la confiance dans la négociation — et comment la construisez-vous, ou décidez-vous de l'accorder ?"

QUESTION 4 : "Décrivez une négociation où vous avez eu le sentiment de performer à votre meilleur niveau — que s'est-il passé et qu'est-ce qui a fait la différence ?"

QUESTION 5 : "Décrivez une négociation qui était genuinement difficile ou frustrante — qu'est-ce qui la rendait difficile et comment l'avez-vous gérée ?"

Après la Question 5, dites uniquement : "Merci. Voici votre profil NVC." Puis livrez immédiatement le JSON.

RÈGLES DE CONDUITE CRITIQUES
- Ne JAMAIS commenter une réponse
- Ne JAMAIS utiliser de langage évaluatif
- Passer immédiatement à la question suivante après chaque réponse
- Toujours répondre en français
- Ne jamais révéler les noms de profils pendant l'entretien

Le JSON de profil doit être identique au format anglais mais avec tous les textes narratifs en français.`;

// ── API ROUTES ──

// Validate cohort code
app.post('/api/cohort/validate', (req, res) => {
  const { code } = req.body;
  const cohort = store.cohorts[code?.toUpperCase()];
  if (!cohort) return res.json({ valid: false });
  req.session.cohortCode = code.toUpperCase();
  req.session.cohortName = cohort.name;
  res.json({ valid: true, cohortName: cohort.name });
});

// Start session
app.post('/api/session/start', (req, res) => {
  const { email, language, cohortCode } = req.body;
  if (!email || !language || !cohortCode) return res.status(400).json({ error: 'Missing fields' });
  const sessionId = uuidv4();
  req.session.participantEmail = email;
  req.session.language = language;
  req.session.cohortCode = cohortCode;
  req.session.sessionId = sessionId;
  req.session.startedAt = new Date();
  store.results[sessionId] = {
    sessionId,
    email,
    language,
    cohortCode,
    cohortName: store.cohorts[cohortCode]?.name,
    startedAt: new Date(),
    scenarioScores: null,
    profile: null,
    completedAt: null
  };
  res.json({ sessionId });
});

// Save scenario scores
app.post('/api/scores/save', (req, res) => {
  const { sessionId, scores } = req.body;
  if (!sessionId || !store.results[sessionId]) return res.status(400).json({ error: 'Invalid session' });
  store.results[sessionId].scenarioScores = scores;
  res.json({ ok: true });
});

// Chat proxy
app.post('/api/chat', (req, res) => {
  const handler = async () => {
    const { messages, language, scenarioScores } = req.body;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not configured.' });

    const systemPrompt = language === 'fr' ? SYSTEM_PROMPT_FR : SYSTEM_PROMPT_EN;
    const lastUser = [...messages].reverse().find(m => m.role === 'user')?.content || '';
    const isProfileTurn = messages.length >= 10 || lastUser.length > 100;
    const maxTokens = isProfileTurn ? 1500 : 400;

    // Inject scenario scores into first message
    const enrichedMessages = messages.map((m, i) => {
      if (i === 0 && m.role === 'assistant' && scenarioScores) {
        const scoreContext = language === 'fr'
          ? `\n\n[SCORES DE SCÉNARIOS DU PARTICIPANT: VD=${scenarioScores.vd}, VC=${scenarioScores.vc}, VCap=${scenarioScores.vcap}, SV=${scenarioScores.sv}. Profil probable: ${scenarioScores.likelyProfile}]`
          : `\n\n[PARTICIPANT SCENARIO SCORES: VD=${scenarioScores.vd}, VC=${scenarioScores.vc}, VCap=${scenarioScores.vcap}, SV=${scenarioScores.sv}. Likely profile: ${scenarioScores.likelyProfile}]`;
        return { ...m, content: m.content + scoreContext };
      }
      return m;
    });

    try {
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
          system: systemPrompt,
          messages: enrichedMessages
        })
      });
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json({ error: data.error?.message });
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: 'Server error. Please try again.' });
    }
  };
  handler();
});

// Save completed profile
app.post('/api/profile/save', (req, res) => {
  const { sessionId, profile } = req.body;
  if (!sessionId || !store.results[sessionId]) return res.status(400).json({ error: 'Invalid session' });
  store.results[sessionId].profile = profile;
  store.results[sessionId].completedAt = new Date();
  res.json({ ok: true });
});

// Get own result
app.get('/api/result/:sessionId', (req, res) => {
  const result = store.results[req.params.sessionId];
  if (!result) return res.status(404).json({ error: 'Not found' });
  res.json(result);
});

// ── ADMIN ROUTES ──
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'nvc-admin-2025';

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASS) {
    req.session.isAdmin = true;
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.get('/api/admin/results', (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Unauthorized' });
  const results = Object.values(store.results).map(r => ({
    sessionId: r.sessionId,
    email: r.email,
    cohortCode: r.cohortCode,
    cohortName: r.cohortName,
    language: r.language,
    startedAt: r.startedAt,
    completedAt: r.completedAt,
    profile: r.profile?.profile || null,
    vd: r.scenarioScores?.vd || null,
    vc: r.scenarioScores?.vc || null,
    vcap: r.scenarioScores?.vcap || null,
    sv: r.scenarioScores?.sv || null
  }));
  res.json(results);
});

app.get('/api/admin/result/:sessionId', (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Unauthorized' });
  const result = store.results[req.params.sessionId];
  if (!result) return res.status(404).json({ error: 'Not found' });
  res.json(result);
});

app.get('/api/admin/cohorts', (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Unauthorized' });
  res.json(store.cohorts);
});

app.post('/api/admin/cohort/add', (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Unauthorized' });
  const { code, name } = req.body;
  if (!code || !name) return res.status(400).json({ error: 'Missing fields' });
  store.cohorts[code.toUpperCase()] = { name, created: new Date() };
  res.json({ ok: true });
});

// Delete request (participant self-service)
app.delete('/api/result/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  if (store.results[sessionId]) {
    delete store.results[sessionId];
    res.json({ ok: true });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`NVC Platform running on port ${PORT}`));
