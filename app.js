const QUESTION_COUNT = 10;
const OPTION_COUNT = 4;
const AUTO_ADVANCE_DELAY = 2500;
const DATA_URL = "./data/countriesWithCapital.json";
const FLAG_BASE_PATH = "./data/flags/SVG";
const DEFAULT_MODE = "flag-to-country";
const DEFAULT_REGION = "world";
const REGION_OPTIONS = ["world", "Africa", "Americas", "Asia", "Europe", "Oceania"];

const GAME_MODES = {
  "flag-to-country": {
    label: "Flag to Country",
    description: "Look at the flag and pick the right country.",
    prompt: () => "Which country does this flag belong to?",
    optionLabel: (country) => country.name,
    revealAnswer: (country) => country.name,
    renderVisual: (country) => {
      elements.flagImage.src = country.flag;
      elements.flagImage.alt = `Flag of ${country.name}`;
      elements.flagImage.classList.remove("hidden");
      elements.countryName.classList.add("hidden");
      elements.countryName.textContent = "";
    }
  },
  "country-to-capital": {
    label: "Country to Capital",
    description: "Read the country name and choose the correct capital city.",
    prompt: (country) => `What is the capital of ${country.name}?`,
    optionLabel: (country) => country.capital,
    revealAnswer: (country) => country.capital,
    renderVisual: (country) => {
      elements.flagImage.classList.add("hidden");
      elements.flagImage.removeAttribute("src");
      elements.flagImage.alt = "";
      elements.countryName.textContent = country.name;
      elements.countryName.classList.remove("hidden");
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
  restartButton: document.getElementById("restart-button")
};

const state = {
  countryPool: [],
  questions: [],
  currentQuestionIndex: 0,
  currentMode: DEFAULT_MODE,
  currentRegion: DEFAULT_REGION,
  score: 0,
  answered: false,
  advanceTimeoutId: null
};

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

function startAutoAdvanceBar(tone) {
  resetAutoAdvanceBar();
  elements.autoAdvanceBar.classList.add(tone === "error" ? "feedback-error" : "feedback-success");
  elements.autoAdvanceTrack.classList.remove("hidden");
  elements.autoAdvanceBar.getBoundingClientRect();
  elements.autoAdvanceBar.style.transition = `transform ${AUTO_ADVANCE_DELAY}ms linear`;
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

function getOptionLabel(country, mode = state.currentMode) {
  return getModeConfig(mode).optionLabel(country);
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

function createQuestion(correctCountry, countryPool, mode) {
  const correctLabel = getOptionLabel(correctCountry, mode);
  const usedLabels = new Set([correctLabel]);
  const wrongOptions = [];

  shuffle(countryPool).forEach((country) => {
    if (wrongOptions.length >= OPTION_COUNT - 1) {
      return;
    }

    const label = getOptionLabel(country, mode);

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

function createQuestionSet(countryPool, mode) {
  const questions = [];

  shuffle(countryPool).forEach((country) => {
    if (questions.length >= QUESTION_COUNT) {
      return;
    }

    try {
      questions.push(createQuestion(country, countryPool, mode));
    } catch (error) {
      console.warn(error);
    }
  });

  if (questions.length < QUESTION_COUNT) {
    throw new Error(`Not enough valid questions to build the ${mode} round.`);
  }

  return questions;
}

function updateHeader() {
  const questionNumber = Math.min(state.currentQuestionIndex + 1, QUESTION_COUNT);
  elements.questionNumber.textContent = String(questionNumber);
  elements.score.textContent = String(state.score);
  elements.progressBar.style.width = `${(questionNumber / QUESTION_COUNT) * 100}%`;
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
    button.textContent = getOptionLabel(option);
    button.dataset.iso2 = option.iso2;
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

  buttons.forEach((button) => {
    button.disabled = true;

    if (button.dataset.iso2 === correctCountry.iso2) {
      button.classList.add("correct");
    }
  });

  if (isCorrect) {
    state.score += 1;
    elements.score.textContent = String(state.score);
    setFeedback("Correct. Next question coming up...", "success");
    startAutoAdvanceBar("success");
  } else {
    selectedButton.classList.add("wrong");
    setFeedback(`Not quite. The correct answer was ${mode.revealAnswer(correctCountry)}.`, "error");
    startAutoAdvanceBar("error");
  }

  state.advanceTimeoutId = window.setTimeout(goToNextQuestion, AUTO_ADVANCE_DELAY);
}

function getResultsMessage(score) {
  if (score === QUESTION_COUNT) {
    return "Perfect round. You nailed every question.";
  }

  if (score >= 8) {
    return "Strong round. A couple more and this set will feel easy.";
  }

  if (score >= 5) {
    return "Good progress. Another round should help the tricky ones stick.";
  }

  return "Good start. Repeating short rounds is a great way to learn faster.";
}

function showResults() {
  const regionLabel = getRegionLabel();
  clearAdvanceTimeout();
  elements.statusArea.classList.add("hidden");
  elements.startState.classList.add("hidden");
  elements.quizState.classList.add("hidden");
  elements.resultsState.classList.remove("hidden");
  elements.resultsLabel.textContent = `Round complete · ${getModeConfig().label} · ${regionLabel}`;
  elements.finalScore.textContent = String(state.score);
  elements.resultsMessage.textContent = getResultsMessage(state.score);
  elements.progressBar.style.width = "100%";
}

function syncModeUi() {
  const mode = getModeConfig();
  const regionLabel = getRegionLabel();
  const filteredCount = getFilteredCountryPool().length;

  elements.modeDescription.textContent = `${mode.description} Choose World or focus on one continent.`;
  elements.startTitle.textContent = `${mode.label} · ${regionLabel}`;
  elements.startMessage.textContent = `${mode.description} ${regionLabel} gives you ${filteredCount} possible countries for a fresh 10-question round.`;
  elements.startButton.textContent = `Start ${mode.label}`;
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
  elements.statusArea.classList.add("hidden");
  elements.loadingState.classList.add("hidden");
  elements.errorState.classList.add("hidden");
  elements.quizState.classList.add("hidden");
  elements.resultsState.classList.add("hidden");
  elements.startState.classList.remove("hidden");
  syncModeUi();
}

function startGame() {
  clearAdvanceTimeout();
  const filteredCountryPool = getFilteredCountryPool();

  if (filteredCountryPool.length < QUESTION_COUNT) {
    showError(`There are not enough countries in ${getRegionLabel()} to start a ${QUESTION_COUNT}-question round.`);
    return;
  }

  state.currentQuestionIndex = 0;
  state.score = 0;
  state.questions = createQuestionSet(filteredCountryPool, state.currentMode);

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

    if (countryPool.length < QUESTION_COUNT) {
      throw new Error("Not enough country data to create a full round.");
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

  if (state.currentQuestionIndex >= QUESTION_COUNT) {
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

elements.startButton.addEventListener("click", startGame);
elements.restartCurrentButton.addEventListener("click", startGame);
elements.restartButton.addEventListener("click", startGame);

init();
