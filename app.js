const QUESTION_COUNT = 10;
const OPTION_COUNT = 4;
const CORRECT_ADVANCE_DELAY = 2500;
const WRONG_ADVANCE_DELAY = 4200;
const STORAGE_KEY = "flag-capital-quiz-progress";
const DATA_URL = "./data/countriesWithCapital.json";
const FLAG_BASE_PATH = "./data/flags/SVG";
const DEFAULT_MODE = "flag-to-country";
const DEFAULT_REGION = "world";
const REGION_OPTIONS = ["world", "Africa", "Americas", "Asia", "Europe", "Oceania"];

function createDefaultProgress() {
  return {
    roundsPlayed: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    bestScores: {},
    streaks: {
      current: 0,
      best: 0
    },
    countryStats: {}
  };
}

function normalizeProgress(progress) {
  return {
    roundsPlayed: Number(progress?.roundsPlayed) || 0,
    correctAnswers: Number(progress?.correctAnswers) || 0,
    wrongAnswers: Number(progress?.wrongAnswers) || 0,
    bestScores: progress?.bestScores && typeof progress.bestScores === "object" ? progress.bestScores : {},
    streaks: {
      current: Number(progress?.streaks?.current) || 0,
      best: Number(progress?.streaks?.best) || 0
    },
    countryStats:
      progress?.countryStats && typeof progress.countryStats === "object" ? progress.countryStats : {}
  };
}

function loadProgress() {
  try {
    const rawProgress = window.localStorage.getItem(STORAGE_KEY);

    if (!rawProgress) {
      return createDefaultProgress();
    }

    return normalizeProgress(JSON.parse(rawProgress));
  } catch (error) {
    console.warn("Could not load local progress.", error);
    return createDefaultProgress();
  }
}

const GAME_MODES = {
  "flag-to-country": {
    label: "Flag to Country",
    description: "Look at the flag and pick the right country.",
    prompt: () => "Which country does this flag belong to?",
    optionLabel: (country) => country.name,
    optionKey: (country) => country.name,
    revealAnswer: (country) => country.name,
    renderVisual: (country) => {
      elements.flagImage.src = country.flag;
      elements.flagImage.alt = `Flag of ${country.name}`;
      elements.flagImage.classList.remove("hidden");
      elements.countryName.classList.add("hidden");
      elements.countryName.textContent = "";
      elements.answerButtons.classList.remove("answers-flags");
    },
    renderOption: (button, country) => {
      button.textContent = country.name;
    }
  },
  "country-to-capital": {
    label: "Country to Capital",
    description: "Read the country name and choose the correct capital city.",
    prompt: (country) => `What is the capital of ${country.name}?`,
    optionLabel: (country) => country.capital,
    optionKey: (country) => country.capital,
    revealAnswer: (country) => country.capital,
    renderVisual: (country) => {
      elements.flagImage.classList.add("hidden");
      elements.flagImage.removeAttribute("src");
      elements.flagImage.alt = "";
      elements.countryName.textContent = country.name;
      elements.countryName.classList.remove("hidden");
      elements.answerButtons.classList.remove("answers-flags");
    },
    renderOption: (button, country) => {
      button.textContent = country.capital;
    }
  },
  "capital-to-country": {
    label: "Capital to Country",
    description: "Read the capital city and choose the correct country.",
    prompt: (country) => `Which country has the capital ${country.capital}?`,
    optionLabel: (country) => country.name,
    optionKey: (country) => country.name,
    revealAnswer: (country) => country.name,
    renderVisual: (country) => {
      elements.flagImage.classList.add("hidden");
      elements.flagImage.removeAttribute("src");
      elements.flagImage.alt = "";
      elements.countryName.textContent = country.capital;
      elements.countryName.classList.remove("hidden");
      elements.answerButtons.classList.remove("answers-flags");
    },
    renderOption: (button, country) => {
      button.textContent = country.name;
    }
  },
  "country-to-flag": {
    label: "Country to Flag",
    description: "Read the country name and choose the correct flag.",
    prompt: (country) => `Which flag belongs to ${country.name}?`,
    optionLabel: (country) => country.name,
    optionKey: (country) => country.iso2,
    revealAnswer: (country) => country.name,
    renderVisual: (country) => {
      elements.flagImage.classList.add("hidden");
      elements.flagImage.removeAttribute("src");
      elements.flagImage.alt = "";
      elements.countryName.textContent = country.name;
      elements.countryName.classList.remove("hidden");
      elements.answerButtons.classList.add("answers-flags");
    },
    renderOption: (button, country) => {
      button.classList.add("answer-button-flag");
      button.setAttribute("aria-label", `Flag of ${country.name}`);
      const image = document.createElement("img");
      image.className = "answer-flag-image";
      image.src = country.flag;
      image.alt = `Flag of ${country.name}`;
      button.appendChild(image);
    }
  }
};

const elements = {
  statusArea: document.getElementById("status-area"),
  loadingState: document.getElementById("loading-state"),
  errorState: document.getElementById("error-state"),
  startState: document.getElementById("start-state"),
  quizState: document.getElementById("quiz-state"),
  resultsState: document.getElementById("results-state"),
  modeDescription: document.getElementById("mode-description"),
  modeButtons: [...document.querySelectorAll(".mode-pill")],
  regionButtons: [...document.querySelectorAll(".filter-pill")],
  startTitle: document.getElementById("start-title"),
  startMessage: document.getElementById("start-message"),
  startButton: document.getElementById("start-button"),
  practiceButton: document.getElementById("practice-button"),
  bestScoreStat: document.getElementById("best-score-stat"),
  roundsPlayedStat: document.getElementById("rounds-played-stat"),
  currentStreakStat: document.getElementById("current-streak-stat"),
  bestStreakStat: document.getElementById("best-streak-stat"),
  mistakesSummary: document.getElementById("mistakes-summary"),
  questionNumber: document.getElementById("question-number"),
  score: document.getElementById("score"),
  progressBar: document.getElementById("progress-bar"),
  prompt: document.getElementById("prompt"),
  flagImage: document.getElementById("flag-image"),
  countryName: document.getElementById("country-name"),
  answerButtons: document.getElementById("answer-buttons"),
  feedback: document.getElementById("feedback"),
  autoAdvanceTrack: document.getElementById("auto-advance-track"),
  autoAdvanceBar: document.getElementById("auto-advance-bar"),
  restartCurrentButton: document.getElementById("restart-current-button"),
  resultsLabel: document.getElementById("results-label"),
  finalScore: document.getElementById("final-score"),
  resultsMessage: document.getElementById("results-message"),
  resultsProgressSummary: document.getElementById("results-progress-summary"),
  practiceResultsButton: document.getElementById("practice-results-button"),
  restartButton: document.getElementById("restart-button")
};

const state = {
  countryPool: [],
  questions: [],
  currentQuestionIndex: 0,
  currentQuestionCount: QUESTION_COUNT,
  currentMode: DEFAULT_MODE,
  currentRegion: DEFAULT_REGION,
  score: 0,
  answered: false,
  advanceTimeoutId: null,
  practiceMode: false,
  progress: loadProgress()
};

function saveProgress() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
  } catch (error) {
    console.warn("Could not save local progress.", error);
  }
}

function clearAdvanceTimeout() {
  if (state.advanceTimeoutId) {
    clearTimeout(state.advanceTimeoutId);
    state.advanceTimeoutId = null;
  }

  resetAutoAdvanceBar();
}

function resetAutoAdvanceBar() {
  elements.autoAdvanceTrack.classList.add("hidden");
  elements.autoAdvanceBar.classList.remove("feedback-success", "feedback-error");
  elements.autoAdvanceBar.style.transition = "none";
  elements.autoAdvanceBar.style.transform = "scaleX(1)";
}

function startAutoAdvanceBar(tone, delay) {
  resetAutoAdvanceBar();
  elements.autoAdvanceBar.classList.add(tone === "error" ? "feedback-error" : "feedback-success");
  elements.autoAdvanceTrack.classList.remove("hidden");
  elements.autoAdvanceBar.getBoundingClientRect();
  elements.autoAdvanceBar.style.transition = `transform ${delay}ms linear`;
  elements.autoAdvanceBar.style.transform = "scaleX(0)";
}

function shuffle(items) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function setFeedback(message, tone = "") {
  elements.feedback.textContent = message;
  elements.feedback.classList.remove("feedback-success", "feedback-error");

  if (tone === "success") {
    elements.feedback.classList.add("feedback-success");
  }

  if (tone === "error") {
    elements.feedback.classList.add("feedback-error");
  }
}

function getModeConfig(mode = state.currentMode) {
  return GAME_MODES[mode];
}

function getRegionLabel(region = state.currentRegion) {
  return region === "world" ? "World" : region;
}

function getScoreKey(mode = state.currentMode, region = state.currentRegion) {
  return `${mode}::${region}`;
}

function getOptionLabel(country, mode = state.currentMode) {
  return getModeConfig(mode).optionLabel(country);
}

function getOptionKey(country, mode = state.currentMode) {
  const modeConfig = getModeConfig(mode);
  return modeConfig.optionKey ? modeConfig.optionKey(country) : modeConfig.optionLabel(country);
}

function buildCountryPool(rawCountries) {
  return rawCountries
    .filter((country) => country.iso2 && country.name && country.capital)
    .map((country) => ({
      name: country.name,
      capital: country.capital,
      iso2: country.iso2.toUpperCase(),
      region: country.region,
      flag: `${FLAG_BASE_PATH}/${country.iso2.toUpperCase()}.svg`
    }))
    .filter(
      (country, index, countries) =>
        countries.findIndex((candidate) => candidate.iso2 === country.iso2) === index
    );
}

function getFilteredCountryPool() {
  if (state.currentRegion === "world") {
    return state.countryPool;
  }

  return state.countryPool.filter((country) => country.region === state.currentRegion);
}

function getCountryProgress(iso2) {
  if (!state.progress.countryStats[iso2]) {
    state.progress.countryStats[iso2] = {
      correct: 0,
      wrong: 0
    };
  }

  return state.progress.countryStats[iso2];
}

function getMistakeScore(country) {
  const countryProgress = state.progress.countryStats[country.iso2];

  if (!countryProgress) {
    return 0;
  }

  return Math.max(0, countryProgress.wrong - countryProgress.correct);
}

function getMistakeEntries(countryPool = getFilteredCountryPool()) {
  return countryPool
    .map((country) => ({
      ...country,
      mistakeScore: getMistakeScore(country)
    }))
    .filter((country) => country.mistakeScore > 0)
    .sort(
      (left, right) =>
        right.mistakeScore - left.mistakeScore || left.name.localeCompare(right.name)
    );
}

function getPracticeCountryPool(countryPool = getFilteredCountryPool()) {
  return getMistakeEntries(countryPool)
    .slice(0, QUESTION_COUNT)
    .map(({ mistakeScore, ...country }) => country);
}

function recordAnswer(correctCountry, isCorrect) {
  const countryProgress = getCountryProgress(correctCountry.iso2);

  if (isCorrect) {
    state.progress.correctAnswers += 1;
    state.progress.streaks.current += 1;
    state.progress.streaks.best = Math.max(
      state.progress.streaks.best,
      state.progress.streaks.current
    );
    countryProgress.correct += 1;
  } else {
    state.progress.wrongAnswers += 1;
    state.progress.streaks.current = 0;
    countryProgress.wrong += 1;
  }

  saveProgress();
}

function recordRound() {
  state.progress.roundsPlayed += 1;

  if (!state.practiceMode) {
    const scoreKey = getScoreKey();
    state.progress.bestScores[scoreKey] = Math.max(
      state.progress.bestScores[scoreKey] || 0,
      state.score
    );
  }

  saveProgress();
}

function createQuestion(correctCountry, countryPool, mode) {
  const correctKey = getOptionKey(correctCountry, mode);
  const usedLabels = new Set([correctKey]);
  const wrongOptions = [];

  shuffle(countryPool).forEach((country) => {
    if (wrongOptions.length >= OPTION_COUNT - 1) {
      return;
    }

    const label = getOptionKey(country, mode);

    if (country.iso2 === correctCountry.iso2 || usedLabels.has(label)) {
      return;
    }

    usedLabels.add(label);
    wrongOptions.push(country);
  });

  if (wrongOptions.length < OPTION_COUNT - 1) {
    throw new Error(`Not enough answer options for mode ${mode}.`);
  }

  const options = shuffle([correctCountry, ...wrongOptions]);

  return {
    correctCountry,
    options
  };
}

function createQuestionSet(targetPool, optionPool, mode, questionCount) {
  const questions = [];

  shuffle(targetPool).forEach((country) => {
    if (questions.length >= questionCount) {
      return;
    }

    try {
      questions.push(createQuestion(country, optionPool, mode));
    } catch (error) {
      console.warn(error);
    }
  });

  if (questions.length < questionCount) {
    throw new Error(`Not enough valid questions to build the ${mode} round.`);
  }

  return questions;
}

function updateHeader() {
  const questionNumber = Math.min(state.currentQuestionIndex + 1, state.currentQuestionCount);
  elements.questionNumber.textContent = String(questionNumber);
  elements.score.textContent = String(state.score);
  elements.progressBar.style.width = `${(questionNumber / state.currentQuestionCount) * 100}%`;
}

function renderQuestion() {
  const question = state.questions[state.currentQuestionIndex];
  const mode = getModeConfig();

  state.answered = false;
  updateHeader();
  resetAutoAdvanceBar();

  elements.prompt.textContent = mode.prompt(question.correctCountry);
  mode.renderVisual(question.correctCountry);
  elements.answerButtons.innerHTML = "";
  setFeedback("Choose an answer to continue.");

  question.options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-button";
    button.dataset.iso2 = option.iso2;
    mode.renderOption(button, option);
    button.addEventListener("click", () => handleAnswer(button, option, question.correctCountry));
    elements.answerButtons.appendChild(button);
  });
}

function handleAnswer(selectedButton, selectedCountry, correctCountry) {
  if (state.answered) {
    return;
  }

  const mode = getModeConfig();
  state.answered = true;

  const isCorrect = selectedCountry.iso2 === correctCountry.iso2;
  const buttons = [...elements.answerButtons.querySelectorAll(".answer-button")];

  recordAnswer(correctCountry, isCorrect);

  buttons.forEach((button) => {
    button.disabled = true;

    if (button.dataset.iso2 === correctCountry.iso2) {
      button.classList.add("correct");
    }
  });

  if (isCorrect) {
    state.score += 1;
    elements.score.textContent = String(state.score);
    selectedButton.classList.add("answer-hit-correct");
    setFeedback("Correct. Next question coming up...", "success");
    startAutoAdvanceBar("success", CORRECT_ADVANCE_DELAY);
    state.advanceTimeoutId = window.setTimeout(goToNextQuestion, CORRECT_ADVANCE_DELAY);
  } else {
    selectedButton.classList.add("wrong");
    selectedButton.classList.add("answer-hit-wrong");
    const correctButton = buttons.find((button) => button.dataset.iso2 === correctCountry.iso2);

    if (correctButton) {
      correctButton.classList.add("answer-reveal-correct");
    }

    setFeedback(`Not quite. The correct answer was ${mode.revealAnswer(correctCountry)}.`, "error");
    startAutoAdvanceBar("error", WRONG_ADVANCE_DELAY);
    state.advanceTimeoutId = window.setTimeout(goToNextQuestion, WRONG_ADVANCE_DELAY);
  }
}

function getResultsMessage(score) {
  if (score === state.currentQuestionCount) {
    return "Perfect round. You nailed every question.";
  }

  if (score >= Math.max(6, state.currentQuestionCount - 2)) {
    return "Strong round. A couple more and this set will feel easy.";
  }

  if (score >= Math.ceil(state.currentQuestionCount / 2)) {
    return "Good progress. Another round should help the tricky ones stick.";
  }

  return "Good start. Repeating short rounds is a great way to learn faster.";
}

function formatTopMistakes(countryPool = getFilteredCountryPool()) {
  const topMistakes = getMistakeEntries(countryPool).slice(0, 3);

  if (!topMistakes.length) {
    return "No active mistake list here yet. A few rounds will start building personalized practice.";
  }

  return `Most missed here: ${topMistakes
    .map((country) => `${country.name} (${country.mistakeScore})`)
    .join(", ")}.`;
}

function showResults() {
  const regionLabel = getRegionLabel();
  const practicePool = getPracticeCountryPool();
  clearAdvanceTimeout();
  elements.statusArea.classList.add("hidden");
  elements.startState.classList.add("hidden");
  elements.quizState.classList.add("hidden");
  elements.resultsState.classList.remove("hidden");
  elements.resultsLabel.textContent = state.practiceMode
    ? `Practice complete · ${getModeConfig().label} · ${regionLabel}`
    : `Round complete · ${getModeConfig().label} · ${regionLabel}`;
  elements.finalScore.textContent = `${state.score} / ${state.currentQuestionCount}`;
  elements.resultsMessage.textContent = getResultsMessage(state.score);
  elements.resultsProgressSummary.textContent = state.practiceMode
    ? `${formatTopMistakes()} ${practicePool.length ? "You can keep drilling the countries that still have practice debt." : "You cleared your current mistake list for this filter."}`
    : `Best score for this set: ${state.progress.bestScores[getScoreKey()] || 0} / ${QUESTION_COUNT}. ${formatTopMistakes()}`;
  elements.practiceResultsButton.disabled = practicePool.length === 0;
  elements.progressBar.style.width = "100%";
}

function syncModeUi() {
  const mode = getModeConfig();
  const regionLabel = getRegionLabel();
  const filteredCount = getFilteredCountryPool().length;
  const bestScore = state.progress.bestScores[getScoreKey()] || 0;
  const practicePool = getPracticeCountryPool();

  elements.modeDescription.textContent = `${mode.description} Choose World or focus on one continent.`;
  elements.startTitle.textContent = `${mode.label} · ${regionLabel}`;
  elements.startMessage.textContent = `${mode.description} ${regionLabel} gives you ${filteredCount} possible countries for a fresh 10-question round.`;
  elements.startButton.textContent = `Start ${mode.label}`;
  elements.bestScoreStat.textContent = `${bestScore} / ${QUESTION_COUNT}`;
  elements.roundsPlayedStat.textContent = String(state.progress.roundsPlayed);
  elements.currentStreakStat.textContent = String(state.progress.streaks.current);
  elements.bestStreakStat.textContent = String(state.progress.streaks.best);
  elements.mistakesSummary.textContent = formatTopMistakes();
  elements.practiceButton.textContent = practicePool.length
    ? `Practice mistakes (${practicePool.length})`
    : "Practice mistakes";
  elements.practiceButton.disabled = practicePool.length === 0;
  elements.practiceResultsButton.disabled = practicePool.length === 0;
  elements.modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === state.currentMode;
    button.classList.toggle("mode-pill-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  elements.regionButtons.forEach((button) => {
    const isActive = button.dataset.region === state.currentRegion;
    button.classList.toggle("filter-pill-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function showStartScreen() {
  clearAdvanceTimeout();
  state.practiceMode = false;
  elements.statusArea.classList.add("hidden");
  elements.loadingState.classList.add("hidden");
  elements.errorState.classList.add("hidden");
  elements.quizState.classList.add("hidden");
  elements.resultsState.classList.add("hidden");
  elements.startState.classList.remove("hidden");
  syncModeUi();
}

function startGame(options = {}) {
  const practiceMode = Boolean(options.practiceMode);
  clearAdvanceTimeout();
  const filteredCountryPool = getFilteredCountryPool();
  const targetPool = practiceMode ? getPracticeCountryPool(filteredCountryPool) : filteredCountryPool;

  if (filteredCountryPool.length < OPTION_COUNT) {
    showError(`There are not enough countries in ${getRegionLabel()} to build 4 answer options.`);
    return;
  }

  if (!targetPool.length) {
    showError(`There are no saved mistakes to practice yet for ${getRegionLabel()}.`);
    return;
  }

  state.currentQuestionIndex = 0;
  state.currentQuestionCount = Math.min(QUESTION_COUNT, targetPool.length);
  state.score = 0;
  state.practiceMode = practiceMode;
  state.questions = createQuestionSet(
    targetPool,
    filteredCountryPool,
    state.currentMode,
    state.currentQuestionCount
  );

  elements.statusArea.classList.remove("hidden");
  elements.errorState.classList.add("hidden");
  elements.startState.classList.add("hidden");
  elements.resultsState.classList.add("hidden");
  elements.quizState.classList.remove("hidden");
  syncModeUi();
  renderQuestion();
}

function switchMode(mode) {
  if (!GAME_MODES[mode] || state.currentMode === mode) {
    return;
  }

  state.currentMode = mode;
  syncModeUi();

  if (state.countryPool.length && !elements.startState.classList.contains("hidden")) {
    return;
  }

  if (state.countryPool.length) {
    startGame();
  }
}

function switchRegion(region) {
  if (!REGION_OPTIONS.includes(region) || state.currentRegion === region) {
    return;
  }

  state.currentRegion = region;
  syncModeUi();

  if (state.countryPool.length && !elements.startState.classList.contains("hidden")) {
    return;
  }

  if (state.countryPool.length) {
    startGame();
  }
}

function showError(message) {
  clearAdvanceTimeout();
  state.practiceMode = false;
  elements.statusArea.classList.add("hidden");
  elements.loadingState.classList.add("hidden");
  elements.startState.classList.add("hidden");
  elements.quizState.classList.add("hidden");
  elements.resultsState.classList.add("hidden");
  elements.errorState.textContent = message;
  elements.errorState.classList.remove("hidden");
}

async function loadCountries() {
  const response = await fetch(DATA_URL);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

async function init() {
  try {
    const rawCountries = await loadCountries();
    const countryPool = buildCountryPool(rawCountries);

    if (countryPool.length < OPTION_COUNT) {
      throw new Error("Not enough country data to create multiple-choice questions.");
    }

    state.countryPool = countryPool;
    elements.loadingState.classList.add("hidden");
    showStartScreen();
  } catch (error) {
    showError(
      "The game could not load the country data. If you opened the page directly from your files, try serving it with a small local web server or open the GitHub Pages version."
    );
    console.error(error);
  }
}

function goToNextQuestion() {
  state.advanceTimeoutId = null;
  state.currentQuestionIndex += 1;

  if (state.currentQuestionIndex >= state.currentQuestionCount) {
    recordRound();
    showResults();
    return;
  }

  renderQuestion();
}

elements.modeButtons.forEach((button) => {
  button.addEventListener("click", () => switchMode(button.dataset.mode));
});

elements.regionButtons.forEach((button) => {
  button.addEventListener("click", () => switchRegion(button.dataset.region));
});

elements.startButton.addEventListener("click", () => startGame());
elements.practiceButton.addEventListener("click", () => startGame({ practiceMode: true }));
elements.restartCurrentButton.addEventListener("click", () => startGame());
elements.restartButton.addEventListener("click", () => startGame());
elements.practiceResultsButton.addEventListener("click", () => startGame({ practiceMode: true }));

init();
