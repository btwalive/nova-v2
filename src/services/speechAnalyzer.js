/**
 * Advanced Speech & Communication Evaluation Engine
 * Official IELTS Speaking Assessment & CEFR Standard Alignment Engine
 * Laser-focused on 1st & 2nd Intro Audios + Extempore Topic Audio.
 * Strict, un-curved grading: Short/hesitant speech (<30 words) or filler stutters fall into A1/A2 level (15 - 48%).
 * Only fluent, detailed speakers with professional vocabulary score B2 or C1.
 */

const HEAVY_FILLERS = ['um', 'uh', 'er', 'ah', 'mmm'];
const LIGHT_FILLERS = ['like', 'you know', 'i mean', 'basically', 'actually', 'literally', 'sort of', 'kind of', 'so yeah'];

const DETAILED_GRAMMAR_RULES = [
  // Subject-Verb Disagreement
  { pattern: /\b(he|she|it)\s+(do|don't)\b/gi, error: 'Subject-Verb Disagreement', suggestion: 'Use "does" / "doesn\'t"' },
  { pattern: /\b(he|she|it)\s+(have)\b/gi, error: 'Subject-Verb Disagreement', suggestion: 'Use "has"' },
  { pattern: /\b(he|she|it)\s+(were|are)\b/gi, error: 'Subject-Verb Disagreement', suggestion: 'Use "was" / "is"' },
  { pattern: /\b(they|we|you|i)\s+(is)\b/gi, error: 'Subject-Verb Disagreement', suggestion: 'Use "are" / "am"' },
  { pattern: /\b(they|we|you)\s+(was)\b/gi, error: 'Past Tense Disagreement', suggestion: 'Use "were"' },
  
  // Tense & Auxiliary Verb Mistakes
  { pattern: /\b(didn't|don't|doesn't)\s+(saw|went|came|ate|took|done|had)\b/gi, error: 'Double Past Tense', suggestion: 'Use base verb (e.g. didn\'t see)' },
  { pattern: /\b(is|are|was|were|am)\s+(go|come|take|make|do|say|give)\b/gi, error: 'Missing Continuous Tense (-ing)', suggestion: 'Use continuous verb (e.g. "is going")' },
  { pattern: /\b(will|shall|can|could|should|would|may|might|must)\s+(went|came|saw|done|taken)\b/gi, error: 'Modal Verb Base Form Violation', suggestion: 'Use base infinitive verb (e.g. "will go")' },
  
  // Redundant & Preposition Mistakes
  { pattern: /\b(return|revert)\s+back\b/gi, error: 'Redundant Phrase', suggestion: 'Use "return" or "revert" without "back"' },
  { pattern: /\b(repeat)\s+again\b/gi, error: 'Redundant Phrase', suggestion: 'Use "repeat" without "again"' },
  { pattern: /\b(discuss)\s+about\b/gi, error: 'Preposition Overuse', suggestion: 'Use "discuss" directly without "about"' },
  { pattern: /\b(could|should|would)\s+of\b/gi, error: 'Grammar Syntax Error', suggestion: 'Use "could have"' },
  { pattern: /\b(don't|doesn't|didn't|no)\s+have\s+no\b/gi, error: 'Double Negative', suggestion: 'Use "don\'t have any"' },
  { pattern: /\b(more|most)\s+(better|faster|smarter|harder|easier|bigger)\b/gi, error: 'Double Comparative', suggestion: 'Use "better" directly' }
];

const PLACEHOLDER_TRANSCRIPT_RE = /^\[.*\]$/;

/**
 * Map numerical 0-100 score to official IELTS Band & CEFR Level standard
 */
export function getIeltsCefrMapping(score) {
  if (score >= 80) return { ieltsBand: "Band 8.0 - 9.0", cefrLevel: "C2", levelTitle: "Mastery / Native-like", recommendation: "Strong Hire (Tier 1)" };
  if (score >= 68) return { ieltsBand: "Band 7.0 - 7.5", cefrLevel: "C1", levelTitle: "Advanced / Fluent", recommendation: "Hire (Customer Facing)" };
  if (score >= 52) return { ieltsBand: "Band 6.0 - 6.5", cefrLevel: "B2", levelTitle: "Upper-Intermediate", recommendation: "Hire (General Communication)" };
  if (score >= 38) return { ieltsBand: "Band 4.5 - 5.5", cefrLevel: "B1 / A2", levelTitle: "Intermediate / Weak Communication", recommendation: "Do Not Hire" };
  if (score >= 20) return { ieltsBand: "Band 3.0 - 4.0", cefrLevel: "A2", levelTitle: "Elementary / Poor Communication", recommendation: "Do Not Hire" };
  return { ieltsBand: "Band 1.0 - 2.5", cefrLevel: "A1", levelTitle: "Beginner / Unintelligible", recommendation: "Do Not Hire" };
}

/**
 * Identify primary target spontaneous audio files:
 * 1. First 2 Intro Audios (q_intro_f1, q_intro_f2 / q_intro_e1, q_intro_e2)
 * 2. Topic Audio (q_ext_1 / extempore)
 */
function isPrimaryTargetAudio(res, index) {
  const qId = String(res.questionId || '').toLowerCase();
  const secId = String(res.sectionId || '').toLowerCase();
  const title = String(res.sectionTitle || '').toLowerCase();

  if (index === 0 || index === 1) return true;
  if (qId.startsWith('q_intro') || secId.includes('intro') || title.includes('introductory') || title.includes('work experience')) {
    return true;
  }
  if (qId.startsWith('q_ext') || secId.includes('extempore') || title.includes('extempore') || title.includes('topic')) {
    return true;
  }

  return false;
}

function classifyTaskType(res, index) {
  const sectionType = String(res.sectionType || '').toLowerCase();
  const sectionId = String(res.sectionId || '').toLowerCase();
  const sectionTitle = String(res.sectionTitle || '').toLowerCase();
  const questionId = String(res.questionId || '').toLowerCase();
  const hasExpected = !!(res.expectedText || '').trim();

  if (['reading', 'listen_repeat', 'read_aloud', 'scripted'].includes(sectionType)) {
    return 'scripted';
  }
  if (['speaking', 'extempore', 'audio_comprehension', 'free', 'intro'].includes(sectionType)) {
    return 'free';
  }

  if (
    sectionId.includes('read') ||
    sectionId.includes('listen_repeat') ||
    sectionId.includes('sec_listen') ||
    questionId.startsWith('q_read') ||
    questionId.startsWith('q_lr') ||
    sectionTitle.includes('reading aloud') ||
    sectionTitle.includes('listen & repeat') ||
    sectionTitle.includes('listen and repeat')
  ) {
    return 'scripted';
  }

  if (isPrimaryTargetAudio(res, index)) {
    return 'free';
  }

  if (hasExpected) return 'scripted';
  return 'free';
}

function calculateTextSimilarity(candidateText, expectedText) {
  if (!candidateText || !expectedText) return 0;

  const cleanCandidate = candidateText.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const cleanExpected = expectedText.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

  if (cleanCandidate === cleanExpected) return 100;

  const candidateWords = cleanCandidate.split(/\s+/).filter(Boolean);
  const expectedWords = cleanExpected.split(/\s+/).filter(Boolean);

  if (expectedWords.length === 0) return 0;

  let matches = 0;
  const expectedVisited = new Array(expectedWords.length).fill(false);

  for (const cWord of candidateWords) {
    for (let i = 0; i < expectedWords.length; i++) {
      if (!expectedVisited[i] && expectedWords[i] === cWord) {
        matches++;
        expectedVisited[i] = true;
        break;
      }
    }
  }

  const precision = (matches / Math.max(candidateWords.length, 1)) * 100;
  const recall = (matches / Math.max(expectedWords.length, 1)) * 100;

  if (precision + recall === 0) return 0;
  return Math.round((2 * precision * recall) / (precision + recall));
}

export function calculatePaceWPM(wordCount, durationSeconds) {
  if (!durationSeconds || durationSeconds <= 0 || !wordCount) return 0;
  const minutes = durationSeconds / 60;
  return Math.round(wordCount / minutes);
}

export function evaluatePaceScore(wpm) {
  if (wpm === 0) return { score: 10, feedback: "No audio or speech detected" };
  if (wpm >= 125 && wpm <= 165) {
    return { score: 80, feedback: "Optimal speaking rate" };
  } else if (wpm >= 100 && wpm < 125) {
    return { score: 60, feedback: "Slightly slow speaking rate" };
  } else if (wpm > 165 && wpm <= 185) {
    return { score: 55, feedback: "Fast speaking pace" };
  } else if (wpm >= 60 && wpm < 100) {
    return { score: 35, feedback: "Hesitant speaking pace" };
  } else {
    return { score: 20, feedback: "Severe pauses and broken speaking rate" };
  }
}

function normalizeTranscript(raw) {
  const t = (raw || '').trim();
  if (!t || PLACEHOLDER_TRANSCRIPT_RE.test(t)) return '';
  return t;
}

function evaluateSingleResponse(res, index) {
  const taskType = classifyTaskType(res, index);
  const isTargetAudio = isPrimaryTargetAudio(res, index);
  const transcript = normalizeTranscript(res.transcript);
  const expectedText = (res.expectedText || '').trim();
  const duration = res.durationSeconds || 10;

  const words = transcript.toLowerCase().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const wpm = calculatePaceWPM(wordCount, duration);

  let heavyFillersInClip = 0;
  let lightFillersInClip = 0;
  let repeatedWordStutters = 0;
  let clipFillerCounts = {};
  let wordRepetitionList = [];

  words.forEach((w, idx) => {
    if (HEAVY_FILLERS.includes(w) || LIGHT_FILLERS.includes(w)) {
      if (HEAVY_FILLERS.includes(w)) heavyFillersInClip++;
      if (LIGHT_FILLERS.includes(w)) lightFillersInClip++;
      clipFillerCounts[w] = (clipFillerCounts[w] || 0) + 1;
    }

    if (idx > 0 && w === words[idx - 1] && w.length >= 1) {
      repeatedWordStutters++;
      const repKey = `repeated word: "${w} ${w}"`;
      clipFillerCounts[repKey] = (clipFillerCounts[repKey] || 0) + 1;
      wordRepetitionList.push({ word: w, phrase: `"${w} ${w}"` });
    }
  });

  const paceEval = evaluatePaceScore(wpm);
  const paceScore = paceEval.score;

  let clipGrammarErrors = [];
  DETAILED_GRAMMAR_RULES.forEach(rule => {
    let match;
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    while ((match = regex.exec(transcript)) !== null) {
      clipGrammarErrors.push({
        questionId: res.questionId || `q_${index + 1}`,
        sectionTitle: res.sectionTitle || `Question ${index + 1}`,
        spokenPhrase: match[0],
        errorType: rule.error,
        suggestion: rule.suggestion
      });
    }
  });

  // ---- SCRIPTED: read aloud / listen & repeat ----
  if (taskType === 'scripted') {
    const accuracy = expectedText
      ? calculateTextSimilarity(transcript, expectedText)
      : (wordCount >= 4 ? 30 : 0);

    const articulationScore = Math.round(accuracy * 0.85 + paceScore * 0.15);

    return {
      taskType: 'scripted',
      isPrimaryTargetAudio: false,
      countsTowardCommunication: false,
      questionId: res.questionId || `q_${index + 1}`,
      sectionId: res.sectionId,
      sectionTitle: res.sectionTitle || `Question ${index + 1}`,
      sectionType: res.sectionType || null,
      transcript: transcript || '(No spoken words recognized)',
      expectedText,
      durationSeconds: duration,
      wpm,
      fillerCounts: clipFillerCounts,
      wordRepetitionList,
      grammarErrors: clipGrammarErrors,
      wordCount,
      scores: {
        pronunciation: accuracy,
        fluency: null,
        vocabulary: null,
        grammar: null,
        pace: paceScore,
        accuracy,
        articulation: articulationScore
      }
    };
  }

  // ---- UN-CURVED FREE-THINKING SPONTANEOUS SPEECH EVALUATION ----
  
  // 1. PRONUNCIATION / SPEECH SUBSTANCE (P) - Strict word count thresholds
  let pronunciationScore = 15;
  if (wordCount >= 75) pronunciationScore = 80;
  else if (wordCount >= 50) pronunciationScore = 65;
  else if (wordCount >= 30) pronunciationScore = 48;
  else if (wordCount >= 15) pronunciationScore = 32;
  else if (wordCount >= 5) pronunciationScore = 20;
  else pronunciationScore = 10;

  // 2. FLUENCY & COHERENCE (FC) - Baseline 35 (A2), strictly penalized for stutters/fillers
  let fluencyScore = 35;
  if (wordCount >= 50) fluencyScore += 30;
  else if (wordCount >= 25) fluencyScore += 15;
  else if (wordCount < 15) fluencyScore -= 10;

  const disfluencyDeduction = (heavyFillersInClip * 15) + (lightFillersInClip * 8) + (repeatedWordStutters * 18);
  fluencyScore = Math.max(10, Math.min(90, fluencyScore - disfluencyDeduction));

  // 3. VOCABULARY & LEXICAL RESOURCE (LR) - Baseline 25 (A2)
  const uniqueWords = new Set(words).size;
  const vocabDiversity = wordCount > 0 ? (uniqueWords / wordCount) * 100 : 0;
  let vocabularyScore = 25;
  if (wordCount >= 40) vocabularyScore = Math.round(vocabDiversity * 0.4 + 30);
  else if (wordCount >= 20) vocabularyScore = Math.round(vocabDiversity * 0.3 + 20);
  else vocabularyScore = 20;
  vocabularyScore = Math.max(10, Math.min(88, vocabularyScore));

  // 4. GRAMMATICAL RANGE & ACCURACY (GRA) - Baseline 35 (A2)
  let grammarScore = 35;
  if (wordCount >= 45 && clipGrammarErrors.length === 0) grammarScore = 75;
  else if (wordCount >= 25 && clipGrammarErrors.length === 0) grammarScore = 55;
  else if (wordCount < 15) grammarScore = 25;

  const grammarDeduction = clipGrammarErrors.length * 20;
  grammarScore = Math.max(10, Math.min(92, grammarScore - grammarDeduction));

  // Silent / empty clip
  if (!transcript || wordCount === 0) {
    pronunciationScore = 10;
    fluencyScore = 10;
    vocabularyScore = 10;
    grammarScore = 10;
  }

  return {
    taskType: 'free',
    isPrimaryTargetAudio,
    countsTowardCommunication: true,
    questionId: res.questionId || `q_${index + 1}`,
    sectionId: res.sectionId,
    sectionTitle: res.sectionTitle || `Question ${index + 1}`,
    sectionType: res.sectionType || null,
    transcript: transcript || '(No spoken words recognized)',
    expectedText: '',
    durationSeconds: duration,
    wpm,
    fillerCounts: clipFillerCounts,
    wordRepetitionList,
    grammarErrors: clipGrammarErrors,
    wordCount,
    scores: {
      pronunciation: pronunciationScore,
      fluency: fluencyScore,
      vocabulary: vocabularyScore,
      grammar: grammarScore,
      pace: paceScore
    }
  };
}

function average(nums) {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

/**
 * Speech evaluation laser-focused on 1st & 2nd intro audios + extempore topic audio.
 * Strict un-curved scoring ensuring weak speakers fall into A1/A2 (10-45%), and only true caliber candidates reach B2/C1.
 */
export function evaluateVoiceSubmission(sectionResponses) {
  if (!sectionResponses || sectionResponses.length === 0) {
    const mapping = getIeltsCefrMapping(0);
    return {
      overallScore: 0,
      ieltsBand: mapping.ieltsBand,
      cefrLevel: mapping.cefrLevel,
      levelTitle: mapping.levelTitle,
      recommendation: mapping.recommendation,
      scores: { pronunciation: 0, fluency: 0, vocabulary: 0, grammar: 0, pace: 0, wpm: 0, scriptedAccuracy: null },
      summaryFeedback: "No valid responses provided for evaluation.",
      feedbackPoints: ["Candidate did not submit recorded audio."],
      grammarErrorsList: [],
      fillerWordsSummary: {},
      wordRepetitionSummary: [],
      evaluatedQuestions: [],
      scoringMeta: { freeThinkingCount: 0, scriptedCount: 0, note: 'No responses' }
    };
  }

  const evaluatedQuestions = sectionResponses.map((res, i) => evaluateSingleResponse(res, i));
  
  // Isolate primary target spontaneous audio files (1st & 2nd intro + topic audio)
  const primaryAudios = evaluatedQuestions.filter(q => q.isPrimaryTargetAudio);
  const sourceForComms = primaryAudios.length > 0 ? primaryAudios : evaluatedQuestions.filter(q => q.countsTowardCommunication);

  const avgPronunciation = average(sourceForComms.map((q) => q.scores.pronunciation || 0));
  const avgFluency = average(sourceForComms.map((q) => q.scores.fluency ?? q.scores.pace ?? 0));
  const avgVocabulary = average(sourceForComms.map((q) => q.scores.vocabulary ?? 0));
  const avgGrammar = average(sourceForComms.map((q) => q.scores.grammar ?? 0));
  const avgWPM = average(sourceForComms.map((q) => q.wpm || 0));

  let communicationScore = Math.round(
    (avgPronunciation * 0.25) +
    (avgFluency * 0.25) +
    (avgGrammar * 0.25) +
    (avgVocabulary * 0.25)
  );

  let overallScore = communicationScore;

  // Check completeness ratio for the 3 primary target spontaneous audios
  const validPrimarySpoken = sourceForComms.filter(q => q.wordCount >= 10);
  const expectedPrimaryCount = 3; // 1st intro + 2nd intro + topic audio
  let isIncomplete = false;

  if (validPrimarySpoken.length < expectedPrimaryCount) {
    isIncomplete = true;
    const completenessRatio = validPrimarySpoken.length / expectedPrimaryCount;
    overallScore = Math.round(overallScore * completenessRatio);
  }

  const mapping = getIeltsCefrMapping(overallScore);

  let globalGrammarErrors = [];
  let globalFillerCounts = {};
  let globalWordRepetitions = [];
  let totalWordsSpoken = 0;
  let allUniqueWordsSet = new Set();

  sourceForComms.forEach((q) => {
    totalWordsSpoken += q.wordCount || 0;
    (q.transcript || '').toLowerCase().split(/\s+/).filter(Boolean).forEach((w) => allUniqueWordsSet.add(w));
    (q.grammarErrors || []).forEach((e) => globalGrammarErrors.push(e));
    (q.wordRepetitionList || []).forEach((r) => globalWordRepetitions.push({ ...r, sectionTitle: q.sectionTitle }));
    Object.entries(q.fillerCounts || {}).forEach(([k, v]) => {
      globalFillerCounts[k] = (globalFillerCounts[k] || 0) + v;
    });
  });

  let feedbackPoints = [];
  feedbackPoints.push(`Un-curved Evaluation: Primary analysis on 1st & 2nd intro audios + topic speaking audio.`);

  if (isIncomplete) {
    feedbackPoints.push(`⚠️ INCOMPLETE TEST: Candidate completed only ${validPrimarySpoken.length} of ${expectedPrimaryCount} primary spontaneous audio files.`);
  }

  if (globalWordRepetitions.length > 0) {
    feedbackPoints.push(`Disfluency (Stutters): Detected ${globalWordRepetitions.length} word repetitions (e.g. ${globalWordRepetitions.slice(0, 3).map(r => r.phrase).join(', ')}).`);
  }

  const totalFillersSpoken = Object.values(globalFillerCounts).reduce((a, b) => a + b, 0);
  if (totalFillersSpoken > 0) {
    feedbackPoints.push(`Fluency (FC): Spoke ${totalFillersSpoken} filler words / hesitations in primary spontaneous audios.`);
  }
  if (globalGrammarErrors.length > 0) {
    feedbackPoints.push(`Grammar (GRA): Detected ${globalGrammarErrors.length} grammatical or agreement errors in primary spontaneous speech.`);
  }

  let summaryFeedback = `IELTS ${mapping.ieltsBand} (${mapping.cefrLevel} ${mapping.levelTitle}) - ${mapping.recommendation}`;
  if (isIncomplete) {
    summaryFeedback += ` [Incomplete Primary Audios: ${validPrimarySpoken.length}/${expectedPrimaryCount} Attempted]`;
  }

  return {
    overallScore,
    ieltsBand: mapping.ieltsBand,
    cefrLevel: mapping.cefrLevel,
    levelTitle: mapping.levelTitle,
    recommendation: isIncomplete ? "Do Not Hire (Incomplete Primary Audios)" : mapping.recommendation,
    isIncomplete,
    scores: {
      pronunciation: avgPronunciation,
      fluency: avgFluency,
      vocabulary: avgVocabulary,
      grammar: avgGrammar,
      pace: avgFluency,
      wpm: avgWPM
    },
    vocabularyStats: {
      totalWordsSpoken,
      uniqueWordsCount: allUniqueWordsSet.size,
      diversityPercentage: totalWordsSpoken > 0 ? Math.round((allUniqueWordsSet.size / totalWordsSpoken) * 100) : 0
    },
    grammarErrorsList: globalGrammarErrors,
    fillerWordsSummary: globalFillerCounts,
    wordRepetitionSummary: globalWordRepetitions,
    summaryFeedback,
    feedbackPoints,
    evaluatedQuestions,
    scoringMeta: {
      primaryAudiosAnalyzed: sourceForComms.length,
      validPrimarySpokenCount: validPrimarySpoken.length
    }
  };
}
