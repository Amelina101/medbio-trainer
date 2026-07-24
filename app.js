"use strict";

const STORAGE_KEY = "medbio_v03";
const DAILY_TARGET_MIN = 30;
const MINUTES_PER = { lesson: 15, quiz: 5, card: 2 };
const WEIGHTS = { lessons: 40, tests: 35, cards: 25 };

const $ = (id) => document.getElementById(id);

let modules = [];
let lessons = [];
let seedCards = [];
let quizBank = [];

let state = null;
let activeModuleId = null;
let activeLessonId = null;
let reviewDeck = [];
let currentCardIndex = 0;
let quizCategoryActive = "all";
let quizQuestions = [];
let quizIndex = 0;
let quizScore = 0;
let lessonSearchQuery = "";
let quizAnswerLocked = false;
let weeklyControlActive = false;

const defaults = {
  cards: [],
  completedLessons: [],
  sessions: [],
  quizHistory: [],
  quizMistakes: [],
  quizSettings: {
    length: 10,
    mistakesOnly: false
  },
  lastLessonId: null,
  weeklyControl: {
    lastDate: null,
    bestScore: 0
  }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `card-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function plural(number, forms) {
  const n = Math.abs(Number(number)) % 100;
  const n1 = n % 10;

  if (n > 10 && n < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}

function normalizeState(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const numberOr = (value, fallback) =>
    Number.isFinite(Number(value)) ? Number(value) : fallback;
  const stringOr = (value, fallback = "") =>
    typeof value === "string" ? value : fallback;

  let cards = Array.isArray(source.cards) ? clone(source.cards) : null;
  if (!cards || cards.length === 0) {
    cards = clone(seedCards);
  } else {
    const existingIds = new Set(
      cards.map((card) => card && card.id).filter(Boolean)
    );
    seedCards.forEach((seedCard) => {
      if (!existingIds.has(seedCard.id)) {
        cards.push(clone(seedCard));
      }
    });
  }

  return {
    ...clone(defaults),
    ...source,
    cards: cards
      .filter((card) => card && typeof card === "object")
      .map((card) => ({
        id: stringOr(card.id) || makeId(),
        category: stringOr(card.category, "Биология"),
        front: stringOr(card.front),
        pronunciation: stringOr(card.pronunciation),
        back: stringOr(card.back),
        interval: numberOr(card.interval, 1),
        nextReview: numberOr(card.nextReview, 0),
        mastery: numberOr(card.mastery, 0)
      })),
    completedLessons: Array.isArray(source.completedLessons)
      ? source.completedLessons.filter((id) => typeof id === "string")
      : [],
    sessions: Array.isArray(source.sessions)
      ? source.sessions.filter(
          (item) =>
            item &&
            typeof item === "object" &&
            typeof item.date === "string" &&
            typeof item.type === "string"
        )
      : [],
    quizHistory: Array.isArray(source.quizHistory)
      ? source.quizHistory
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            date: stringOr(item.date),
            score: numberOr(item.score, 0),
            category:
              typeof item.category === "string" ? item.category : null
          }))
      : [],
    quizMistakes: Array.isArray(source.quizMistakes)
      ? [...new Set(source.quizMistakes.filter((id) => typeof id === "string"))]
      : [],
    quizSettings: {
      length: [5, 10, 20].includes(
        numberOr(source.quizSettings && source.quizSettings.length, 10)
      )
        ? numberOr(source.quizSettings && source.quizSettings.length, 10)
        : 10,
      mistakesOnly: Boolean(
        source.quizSettings && source.quizSettings.mistakesOnly
      )
    },
    lastLessonId:
      typeof source.lastLessonId === "string"
        ? source.lastLessonId
        : null,
    weeklyControl: {
      lastDate:
        source.weeklyControl &&
        typeof source.weeklyControl.lastDate === "string"
          ? source.weeklyControl.lastDate
          : null,
      bestScore:
        source.weeklyControl &&
        Number.isFinite(Number(source.weeklyControl.bestScore))
          ? Number(source.weeklyControl.bestScore)
          : 0
    }
  };
}

function loadState() {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch (error) {
    console.warn("MedBio: повреждённое состояние заменено безопасным.", error);
    return normalizeState(null);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function todayStr() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function testSets() {
  return ["all", ...new Set(quizBank.map((question) => question.category))];
}

function strictDueCount(category) {
  const now = Date.now();

  return (Array.isArray(state.cards) ? state.cards : []).filter(
    (card) =>
      (category === "all" || card.category === category) &&
      Number(card.nextReview) > 0 &&
      Number(card.nextReview) <= now
  ).length;
}

function computeStats() {
  const now = Date.now();
  const cards = Array.isArray(state.cards) ? state.cards : [];
  const completedIds = Array.isArray(state.completedLessons)
    ? state.completedLessons
    : [];
  const history = Array.isArray(state.quizHistory) ? state.quizHistory : [];

  const totalLessons = lessons.length;
  const completedLessons = completedIds.filter((id) =>
    lessons.some((lesson) => lesson.id === id)
  ).length;
  const lessonProgressPercent = totalLessons
    ? Math.round((completedLessons / totalLessons) * 100)
    : 0;

  const sets = testSets();
  const totalTests = quizBank.length ? sets.length : 0;
  const completedTests = [
    ...new Set(
      history
        .map((entry) => entry && entry.category)
        .filter((category) => sets.includes(category))
    )
  ].length;

  const scores = history
    .map((entry) => Number(entry && entry.score))
    .filter(Number.isFinite);
  const averageTestScore = scores.length
    ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
    : 0;

  const totalCards = cards.length;
  const learnedCards = cards.filter(
    (card) => Number(card.nextReview) > 0
  ).length;
  const dueCards = cards.filter(
    (card) =>
      Number(card.nextReview) > 0 && Number(card.nextReview) <= now
  ).length;

  const lessonPart = totalLessons ? completedLessons / totalLessons : 0;
  const testPart = totalTests ? completedTests / totalTests : 0;
  const cardPart = totalCards ? learnedCards / totalCards : 0;

  const overallProgress = Math.round(
    lessonPart * WEIGHTS.lessons +
      testPart * WEIGHTS.tests +
      cardPart * WEIGHTS.cards
  );

  return {
    totalLessons,
    completedLessons,
    lessonProgressPercent,
    totalTests,
    completedTests,
    averageTestScore,
    totalCards,
    learnedCards,
    dueCards,
    overallProgress
  };
}

function todayActivity() {
  const today = todayStr();
  const todaySessions = (
    Array.isArray(state.sessions) ? state.sessions : []
  ).filter((session) => session && session.date === today);

  const rawMinutes = todaySessions.reduce(
    (sum, session) => sum + (MINUTES_PER[session.type] || 0),
    0
  );

  return {
    minutes: Math.min(DAILY_TARGET_MIN, rawMinutes),
    percent: Math.min(
      100,
      Math.round((rawMinutes / DAILY_TARGET_MIN) * 100)
    )
  };
}

function activatePage(page) {
  document.querySelectorAll(".page").forEach((element) => {
    element.classList.remove("active");
  });

  const target = $(page);
  if (target) target.classList.add("active");

  document.querySelectorAll(".bottom-nav button").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function goTo(page) {
  activatePage(page);

  if (page === "lessons") {
    activeModuleId = null;
    renderLessons();
  }
  if (page === "progress") renderProgress();
  if (page === "cards") buildDeck();
  if (page === "quiz") startQuiz();
}

function renderHome() {
  const stats = computeStats();
  const day = todayActivity();

  $("homeCardsCount").textContent =
    `${stats.totalCards} ` +
    plural(stats.totalCards, ["карточка", "карточки", "карточек"]);
  $("homeProgress").textContent = `${stats.overallProgress}%`;
  $("quickLessonsCount").textContent =
    `${stats.totalLessons} ` +
    plural(stats.totalLessons, ["тема", "темы", "тем"]);
  $("quickTestsCount").textContent =
    `${stats.totalTests} ` +
    plural(stats.totalTests, ["тест", "теста", "тестов"]);
  $("heroProgressBar").style.width = `${stats.lessonProgressPercent}%`;
  $("heroProgressValue").textContent = `${stats.lessonProgressPercent}%`;
  $("dailyMinutes").textContent = String(day.minutes);
  $("dailyBar").style.width = `${day.percent}%`;

  const continueLesson =
    lessons.find((lesson) => lesson.id === state.lastLessonId) ||
    lessons.find(
      (lesson) => !state.completedLessons.includes(lesson.id)
    ) ||
    lessons[0];

  const heroTitle = document.querySelector("#home .hero-copy h2");
  const heroButton = document.querySelector("#home .hero-copy .gold-button");

  if (continueLesson && heroTitle && heroButton) {
    heroTitle.textContent = continueLesson.title;
    heroButton.textContent = state.completedLessons.includes(continueLesson.id)
      ? "Открыть урок"
      : "Продолжить урок";
    heroButton.onclick = () => openLesson(continueLesson.id);
  }

  renderDailyStudyPlan();
}

function renderModules() {
  const box = $("moduleList");
  box.innerHTML = "";

  const completed = Array.isArray(state.completedLessons)
    ? state.completedLessons
    : [];
  const query = lessonSearchQuery.trim().toLocaleLowerCase("ru");

  const visibleModules = [...modules]
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    .filter((module) => {
      if (!query) return true;

      const ownText = `${module.title || ""} ${module.description || ""}`
        .toLocaleLowerCase("ru");
      const lessonMatch = lessons.some((lesson) => {
        if (lesson.moduleId !== module.id) return false;
        const lessonText = [
          lesson.title,
          lesson.level,
          ...(Array.isArray(lesson.tags) ? lesson.tags : [])
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("ru");
        return lessonText.includes(query);
      });

      return ownText.includes(query) || lessonMatch;
    });

  visibleModules.forEach((module) => {
    const moduleLessons = lessons.filter(
      (lesson) => lesson.moduleId === module.id
    );
    const total = moduleLessons.length;
    const done = moduleLessons.filter((lesson) =>
      completed.includes(lesson.id)
    ).length;
    const percent = total ? Math.round((done / total) * 100) : 0;

    const meta = total
      ? `${total} ${plural(total, [
          "урок",
          "урока",
          "уроков"
        ])} • завершено ${done} • ${percent}%`
      : "Материалы готовятся";

    const button = document.createElement("button");
    button.className = "lesson-card glass-card";
    button.innerHTML = `
      <div class="lesson-thumb"></div>
      <div>
        <h3>${module.title}</h3>
        <p>${module.description || ""}</p>
        <p class="module-meta">${meta}</p>
        <div class="mini-progress">
          <span style="width:${percent}%"></span>
        </div>
      </div>
      <div class="lesson-arrow">›</div>
    `;
    button.onclick = () => openModule(module.id);
    box.appendChild(button);
  });

  if (!visibleModules.length) {
    box.innerHTML =
      '<p class="empty-note">По этому запросу ничего не найдено.</p>';
  }
}

function openModule(id) {
  activeModuleId = id;
  lessonSearchQuery = "";
  const input = $("lessonSearch");
  if (input) input.value = "";
  renderLessons();
}

function backToModules() {
  activeModuleId = null;
  renderLessons();
}

function renderLessons() {
  const showingModules = activeModuleId === null;

  $("moduleList").classList.toggle("hidden", !showingModules);
  $("lessonList").classList.toggle("hidden", showingModules);
  $("modulesBack").classList.toggle("hidden", showingModules);

  const search = $("lessonSearch");
  if (search) {
    search.placeholder = showingModules
      ? "Поиск по 15 модулям и всем урокам"
      : "Поиск внутри выбранного модуля";
  }

  if (showingModules) {
    $("lessonsHeading").textContent = "Модули";

    if (!modules.length) {
      $("moduleList").innerHTML =
        '<p class="empty-note">Не удалось загрузить каталог модулей. Обнови страницу.</p>';
      return;
    }

    renderModules();
    return;
  }

  const module = modules.find((item) => item.id === activeModuleId);
  $("lessonsHeading").textContent = module ? module.title : "Уроки";

  const box = $("lessonList");
  box.innerHTML = "";

  const query = lessonSearchQuery.trim().toLocaleLowerCase("ru");
  const moduleLessons = lessons
    .filter((lesson) => lesson.moduleId === activeModuleId)
    .filter((lesson) => {
      if (!query) return true;
      const text = [
        lesson.title,
        lesson.level,
        lesson.difficulty,
        ...(Array.isArray(lesson.tags) ? lesson.tags : [])
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("ru");
      return text.includes(query);
    })
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

  if (!moduleLessons.length) {
    box.innerHTML =
      '<p class="empty-note">По этому запросу уроков не найдено.</p>';
    return;
  }

  moduleLessons.forEach((lesson) => {
    const button = document.createElement("button");
    button.className = "lesson-card glass-card";
    const isCompleted = state.completedLessons.includes(lesson.id);

    button.innerHTML = `
      <div class="lesson-thumb"></div>
      <div>
        <h3>${lesson.title}</h3>
        <p>
          ${lesson.level || "Биология"} • ${lesson.duration || 0} минут
          ${isCompleted ? " • завершён ✓" : ""}
        </p>
        <p class="module-meta">
          ${lesson.difficulty === "hard" ? "Повышенная сложность" : "Базовая тема"}
        </p>
      </div>
      <div class="lesson-arrow">›</div>
    `;
    button.onclick = () => openLesson(lesson.id);
    box.appendChild(button);
  });
}

function openLesson(id) {
  const lesson = lessons.find((item) => item.id === id);
  if (!lesson) {
    alert("Урок не найден.");
    return;
  }

  activeLessonId = id;
  state.lastLessonId = id;
  saveState();

  $("lessonArticle").innerHTML = lesson.content || "";
  goTo("lessonView");
  updateLessonView();
}

function buildDeck() {
  const category = $("reviewCategory").value;
  const now = Date.now();
  const cards = Array.isArray(state.cards) ? state.cards : [];
  const inCategory = (card) =>
    category === "all" || card.category === category;

  reviewDeck = cards.filter(
    (card) =>
      inCategory(card) &&
      (!card.nextReview || Number(card.nextReview) <= now)
  );

  if (!reviewDeck.length) {
    reviewDeck = cards.filter(inCategory);
  }

  currentCardIndex = 0;
  $("dueCount").textContent = `${strictDueCount(category)} к повторению`;
  renderCard();
}

function renderCard() {
  $("flashBack").classList.add("hidden");
  $("answerActions").classList.add("hidden");
  $("showAnswerBtn").classList.remove("hidden");

  if (!reviewDeck.length) {
    $("flashFront").textContent = "Карточек нет";
    $("flashPronunciation").textContent = "";
    $("flashCategory").textContent = "";
    return;
  }

  const card = reviewDeck[currentCardIndex];
  $("flashFront").textContent = card.front;
  $("flashPronunciation").textContent = card.pronunciation || "";
  $("flashBack").textContent = card.back;
  $("flashCategory").textContent = card.category;
}

function startQuiz() {
  quizCategoryActive = weeklyControlActive
    ? "all"
    : $("quizCategory").value;
  quizAnswerLocked = false;

  const selectedLength = Number(
    ($("quizLength") && $("quizLength").value) ||
      state.quizSettings.length ||
      10
  );
  const mistakesOnly = weeklyControlActive
    ? false
    : Boolean($("mistakesOnly") && $("mistakesOnly").checked);

  const quizLength = weeklyControlActive
    ? 20
    : ([5, 10, 20].includes(selectedLength) ? selectedLength : 10);

  state.quizSettings = {
    length: quizLength,
    mistakesOnly
  };
  saveState();

  let pool = quizBank.filter(
    (question) =>
      quizCategoryActive === "all" ||
      question.category === quizCategoryActive
  );

  if (mistakesOnly) {
    const mistakeIds = new Set(state.quizMistakes);
    pool = pool.filter((question) => mistakeIds.has(question.id));
  }

  quizQuestions = pool
    .map((question) => ({ question, random: Math.random() }))
    .sort((a, b) => a.random - b.random)
    .map((item) => item.question)
    .slice(0, quizLength);

  quizIndex = 0;
  quizScore = 0;
  $("quizResult").classList.add("hidden");
  updateMistakeCounter();

  if (!quizQuestions.length) {
    $("quizBox").innerHTML = mistakesOnly
      ? `<h3>Ошибок для повторения нет</h3>
         <p>Пройди обычный тест или выбери другую тему.</p>`
      : `<h3>Вопросы не загружены</h3>
         <p>Обнови страницу или выбери другую тему.</p>`;
    return;
  }

  renderQuestion();
}

function renderQuestion() {
  quizAnswerLocked = false;

  if (quizIndex >= quizQuestions.length) {
    const percent = Math.round(
      (quizScore / quizQuestions.length) * 100
    );

    state.quizHistory.unshift({
      date: new Date().toLocaleDateString("ru-RU"),
      score: percent,
      category: quizCategoryActive
    });
    state.quizHistory = state.quizHistory.slice(0, 30);
    state.sessions.push({
      date: todayStr(),
      type: weeklyControlActive ? "weekly" : "quiz"
    });

    if (weeklyControlActive) {
      state.weeklyControl.lastDate = todayStr();
      state.weeklyControl.bestScore = Math.max(
        Number(state.weeklyControl.bestScore || 0),
        percent
      );
    }

    const completedWeeklyControl = weeklyControlActive;
    weeklyControlActive = false;

    saveState();
    renderHome();
    renderProgress();
    updateMistakeCounter();

    $("quizBox").innerHTML = completedWeeklyControl
      ? "<h3>Еженедельная контрольная завершена</h3>"
      : "<h3>Тест завершён</h3>";
    $("quizResult").innerHTML = `
      <h3>${completedWeeklyControl ? "Контрольная" : "Результат"}:
        ${quizScore}/${quizQuestions.length} — ${percent}%</h3>
      <p>Ошибок в персональной коллекции: ${state.quizMistakes.length}</p>
      <div class="quiz-result-actions">
        <button id="againQuiz" class="gold-button">Пройти ещё раз</button>
        ${
          state.quizMistakes.length
            ? '<button id="reviewMistakesBtn" class="soft-button">Повторить ошибки</button>'
            : ""
        }
      </div>
    `;
    $("quizResult").classList.remove("hidden");
    $("againQuiz").onclick = startQuiz;

    const reviewButton = $("reviewMistakesBtn");
    if (reviewButton) {
      reviewButton.onclick = () => {
        $("mistakesOnly").checked = true;
        startQuiz();
      };
    }
    return;
  }

  const item = quizQuestions[quizIndex];
  $("quizBox").innerHTML = `
    <div class="quiz-topline">
      <span class="section-label">
        Вопрос ${quizIndex + 1} из ${quizQuestions.length}
      </span>
      <span>${quizScore} правильных</span>
    </div>
    <h3>${item.q}</h3>
  `;

  item.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.className = "option";
    button.textContent = option;

    button.onclick = () => {
      if (quizAnswerLocked) return;
      quizAnswerLocked = true;

      const buttons = $("quizBox").querySelectorAll(".option");
      buttons.forEach((itemButton) => {
        itemButton.disabled = true;
      });

      const isCorrect = index === item.answer;

      if (isCorrect) {
        button.classList.add("correct");
        quizScore += 1;
        state.quizMistakes = state.quizMistakes.filter(
          (id) => id !== item.id
        );
      } else {
        button.classList.add("wrong");
        if (buttons[item.answer]) {
          buttons[item.answer].classList.add("correct");
        }
        if (item.id && !state.quizMistakes.includes(item.id)) {
          state.quizMistakes.push(item.id);
        }
      }

      saveState();
      updateMistakeCounter();

      const feedback = document.createElement("div");
      feedback.className = `quiz-feedback ${
        isCorrect ? "is-correct" : "is-wrong"
      }`;
      feedback.innerHTML = `
        <strong>${isCorrect ? "Верно" : "Нужно повторить"}</strong>
        <p>${item.explanation || "Разбери определение и причинно-следственную связь."}</p>
        <button id="nextQuestionBtn" class="gold-button">
          ${
            quizIndex + 1 < quizQuestions.length
              ? "Следующий вопрос"
              : "Показать результат"
          }
        </button>
      `;
      $("quizBox").appendChild(feedback);

      $("nextQuestionBtn").onclick = () => {
        quizIndex += 1;
        renderQuestion();
      };
    };

    $("quizBox").appendChild(button);
  });
}

function renderProgress() {
  const stats = computeStats();

  $("overallProgress").textContent = `${stats.overallProgress}%`;

  const ring = document.querySelector(".ring-progress");
  if (ring) {
    ring.style.setProperty("--progress", stats.overallProgress);
  }

  $("completedLessons").textContent = String(stats.completedLessons);
  $("dueCardsValue").textContent = String(stats.dueCards);
  $("avgScoreValue").textContent = `${stats.averageTestScore}%`;

  const history = Array.isArray(state.quizHistory)
    ? state.quizHistory
    : [];

  renderModuleProgress();

  $("historyList").innerHTML = history.length
    ? history
        .map(
          (entry) => `
            <div class="history-item">
              <span>${entry.date}</span>
              <strong>${entry.score}%</strong>
            </div>
          `
        )
        .join("")
    : "<p style='color:var(--muted)'>Тесты пока не пройдены.</p>";
}


const CATEGORY_LABELS = {
  cell: "Клетка",
  genetics: "Генетика",
  anatomy: "Анатомия",
  physiology: "Физиология",
  biochemistry: "Биохимия",
  "molecular-biology": "Молекулярная биология",
  botany: "Ботаника",
  zoology: "Зоология",
  evolution: "Эволюция",
  ecology: "Экология",
  "scientific-english": "Scientific English",
  "medical-latin": "Medical Latin",
  vsoh: "ВсОШ",
  pirogov: "Пироговская олимпиада",
  sechenov: "Сеченовская олимпиада"
};

function fillSelect(select, options, preferredValue) {
  if (!select) return;

  select.innerHTML = "";
  options.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  });

  const available = options.some(([value]) => value === preferredValue);
  select.value = available ? preferredValue : options[0][0];
}

function syncDataSelectors() {
  const reviewSelect = $("reviewCategory");
  const quizSelect = $("quizCategory");
  const addCardSelect = $("cardCategory");

  const cardCategories = [
    ...new Set(
      [...seedCards, ...(Array.isArray(state.cards) ? state.cards : [])]
        .map((card) => card && card.category)
        .filter(Boolean)
    )
  ].sort((a, b) => a.localeCompare(b, "ru"));

  fillSelect(
    reviewSelect,
    [["all", "Все"], ...cardCategories.map((category) => [category, category])],
    reviewSelect ? reviewSelect.value : "all"
  );

  const quizCategories = [
    ...new Set(quizBank.map((question) => question.category).filter(Boolean))
  ];

  fillSelect(
    quizSelect,
    [
      ["all", "Смешанный"],
      ...quizCategories.map((category) => [
        category,
        CATEGORY_LABELS[category] || category
      ])
    ],
    quizSelect ? quizSelect.value : "all"
  );

  const addCategories = [
    ...new Set([
      "Биология",
      "Биохимия",
      "Medical English",
      "Scientific English",
      "Latin",
      "Анатомия",
      ...cardCategories
    ])
  ];

  fillSelect(
    addCardSelect,
    addCategories.map((category) => [category, category]),
    addCardSelect ? addCardSelect.value : "Биология"
  );
}


function injectSmartLearningStyles() {
  if ($("smartLearningStyles")) return;

  const style = document.createElement("style");
  style.id = "smartLearningStyles";
  style.textContent = `
    .learning-search {
      margin: 0 0 18px;
      position: relative;
    }
    .learning-search input {
      width: 100%;
      padding-left: 44px;
    }
    .learning-search::before {
      content: "⌕";
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--gold);
      font-size: 21px;
      z-index: 1;
    }
    .mini-progress {
      width: 100%;
      height: 5px;
      margin-top: 10px;
      border-radius: 99px;
      overflow: hidden;
      background: rgba(255,255,255,.07);
    }
    .mini-progress span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg,var(--gold-soft),var(--gold));
    }
    .lesson-navigation {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 14px;
    }
    .quiz-controls {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      align-items: center;
      gap: 10px;
    }
    .quiz-controls select {
      min-width: 112px;
    }
    .mistake-toggle {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 11px 13px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: rgba(9,17,12,.76);
      color: var(--text);
      white-space: nowrap;
    }
    .mistake-toggle input {
      width: 18px;
      height: 18px;
      margin: 0;
    }
    .mistake-count {
      color: var(--gold);
      font-size: 12px;
      white-space: nowrap;
    }
    .quiz-topline {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      color: var(--muted);
      font-size: 12px;
    }
    .quiz-feedback {
      margin-top: 18px;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: 16px;
      line-height: 1.55;
    }
    .quiz-feedback.is-correct {
      background: rgba(72,91,45,.35);
    }
    .quiz-feedback.is-wrong {
      background: rgba(107,61,55,.35);
    }
    .quiz-feedback strong {
      color: var(--gold);
      font-family: 'Cormorant Garamond',serif;
      font-size: 25px;
    }
    .quiz-feedback p {
      color: #d9ddcf;
    }
    .quiz-result-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .study-plan-panel {
      margin: 20px 0;
      padding: 22px;
    }
    .study-plan-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 16px;
    }
    .study-plan-header h3 {
      margin: 0 0 4px;
      font-family: 'Cormorant Garamond',serif;
      font-size: 32px;
    }
    .study-plan-header p {
      margin: 0;
      color: var(--muted);
    }
    .study-streak {
      min-width: 84px;
      padding: 10px 12px;
      border: 1px solid var(--line);
      border-radius: 14px;
      text-align: center;
      color: var(--gold);
      background: rgba(9,17,12,.7);
    }
    .study-streak strong {
      display: block;
      font-size: 23px;
    }
    .study-plan-grid {
      display: grid;
      grid-template-columns: repeat(3,minmax(0,1fr));
      gap: 12px;
    }
    .study-task {
      display: flex;
      min-height: 174px;
      flex-direction: column;
      justify-content: space-between;
      gap: 12px;
      padding: 16px;
      border: 1px solid var(--line);
      border-radius: 17px;
      background: rgba(9,17,12,.55);
    }
    .study-task.done {
      border-color: rgba(176,151,93,.55);
      background: rgba(72,91,45,.22);
    }
    .study-task-label {
      color: var(--gold);
      font-size: 12px;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .study-task h4 {
      margin: 4px 0 6px;
      font-family: 'Cormorant Garamond',serif;
      font-size: 23px;
      line-height: 1.05;
    }
    .study-task p {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
    }
    .weekly-control-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-top: 14px;
      padding: 16px;
      border: 1px solid var(--line);
      border-radius: 17px;
      background: linear-gradient(135deg,rgba(176,151,93,.16),rgba(9,17,12,.6));
    }
    .weekly-control-card h4 {
      margin: 0 0 5px;
      font-family: 'Cormorant Garamond',serif;
      font-size: 24px;
    }
    .weekly-control-card p {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
    }
    .weak-focus {
      margin-top: 14px;
      color: var(--muted);
      font-size: 13px;
    }
    .weak-focus strong {
      color: var(--gold);
    }
    .module-progress-panel {
      margin-top: 18px;
      padding: 24px;
    }
    .module-progress-panel h3 {
      margin-top: 0;
      font-family: 'Cormorant Garamond',serif;
      font-size: 30px;
    }
    .module-progress-list {
      display: grid;
      gap: 14px;
    }
    .module-progress-item {
      display: grid;
      grid-template-columns: minmax(150px,1fr) minmax(120px,2fr) auto;
      align-items: center;
      gap: 14px;
    }
    .module-progress-item strong {
      font-size: 14px;
    }
    .module-progress-item small {
      color: var(--muted);
      white-space: nowrap;
    }
    @media(max-width:760px) {
      .quiz-controls {
        width: 100%;
        justify-content: stretch;
      }
      .quiz-controls select,
      .mistake-toggle {
        flex: 1;
      }
      .study-plan-grid {
        grid-template-columns: 1fr;
      }
      .study-plan-header,
      .weekly-control-card {
        align-items: stretch;
        flex-direction: column;
      }
      .study-streak {
        width: fit-content;
      }
      .module-progress-item {
        grid-template-columns: 1fr auto;
      }
      .module-progress-item .mini-progress {
        grid-column: 1 / -1;
        grid-row: 2;
      }
    }
  `;
  document.head.appendChild(style);
}

function ensureSmartLearningUi() {
  injectSmartLearningStyles();

  const brand = document.querySelector(".brand-kicker");
  if (brand) brand.textContent = "MEDBIO TRAINER • STUDY PLAN V3";

  if (!$("lessonSearch")) {
    const wrapper = document.createElement("div");
    wrapper.className = "learning-search";
    wrapper.innerHTML = `
      <input id="lessonSearch" type="search"
        placeholder="Поиск по 15 модулям и всем урокам"
        autocomplete="off">
    `;
    $("moduleList").before(wrapper);

    $("lessonSearch").addEventListener("input", (event) => {
      lessonSearchQuery = event.target.value || "";
      renderLessons();
    });
  }

  if (!$("lessonNavigation")) {
    const navigation = document.createElement("div");
    navigation.id = "lessonNavigation";
    navigation.className = "lesson-navigation";
    navigation.innerHTML = `
      <button id="previousLessonBtn" class="soft-button">
        ← Предыдущий
      </button>
      <button id="nextLessonBtn" class="gold-button">
        Следующий →
      </button>
    `;
    $("completeLessonBtn").after(navigation);
  }

  if (!$("quizLength")) {
    const heading = document.querySelector("#quiz .page-heading");
    const category = $("quizCategory");
    const controls = document.createElement("div");
    controls.className = "quiz-controls";
    controls.innerHTML = `
      <select id="quizLength" aria-label="Количество вопросов">
        <option value="5">5 вопросов</option>
        <option value="10">10 вопросов</option>
        <option value="20">20 вопросов</option>
      </select>
      <label class="mistake-toggle">
        <input id="mistakesOnly" type="checkbox">
        Только ошибки
      </label>
      <span id="mistakeCount" class="mistake-count"></span>
    `;
    controls.prepend(category);
    heading.appendChild(controls);

    $("quizLength").value = String(state.quizSettings.length);
    $("mistakesOnly").checked = state.quizSettings.mistakesOnly;

    $("quizLength").onchange = () => {
      weeklyControlActive = false;
      startQuiz();
    };
    $("mistakesOnly").onchange = () => {
      weeklyControlActive = false;
      startQuiz();
    };
  }

  if (!$("moduleProgressPanel")) {
    const panel = document.createElement("div");
    panel.id = "moduleProgressPanel";
    panel.className = "glass-card module-progress-panel";
    panel.innerHTML = `
      <h3>Прогресс по модулям</h3>
      <div id="moduleProgressList" class="module-progress-list"></div>
    `;
    document.querySelector("#progress .progress-overview").after(panel);
  }

  const searchButton = document.querySelector(
    '.header-actions .icon-button[aria-label="Поиск"]'
  );
  if (searchButton) {
    searchButton.onclick = () => {
      activatePage("lessons");
      activeModuleId = null;
      renderLessons();
      setTimeout(() => $("lessonSearch") && $("lessonSearch").focus(), 0);
    };
  }
}

function updateLessonView() {
  const lesson = lessons.find((item) => item.id === activeLessonId);
  if (!lesson) return;

  const moduleLessons = lessons
    .filter((item) => item.moduleId === lesson.moduleId)
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  const index = moduleLessons.findIndex((item) => item.id === lesson.id);

  const completeButton = $("completeLessonBtn");
  const completed = state.completedLessons.includes(lesson.id);
  completeButton.textContent = completed
    ? "Урок завершён ✓"
    : "Отметить урок завершённым";
  completeButton.disabled = completed;
  completeButton.classList.toggle("soft-button", completed);
  completeButton.classList.toggle("gold-button", !completed);

  const previousButton = $("previousLessonBtn");
  const nextButton = $("nextLessonBtn");
  const previous = moduleLessons[index - 1];
  const next = moduleLessons[index + 1];

  previousButton.disabled = !previous;
  previousButton.textContent = previous
    ? "← Предыдущий урок"
    : "← Это первый урок";
  previousButton.onclick = previous
    ? () => openLesson(previous.id)
    : null;

  nextButton.disabled = !next;
  nextButton.textContent = next
    ? "Следующий урок →"
    : "Модуль завершён ✓";
  nextButton.onclick = next
    ? () => openLesson(next.id)
    : null;
}

function updateMistakeCounter() {
  const counter = $("mistakeCount");
  if (!counter || !state) return;
  counter.textContent = `${state.quizMistakes.length} ${
    plural(state.quizMistakes.length, ["ошибка", "ошибки", "ошибок"])
  }`;
}

function renderModuleProgress() {
  const box = $("moduleProgressList");
  if (!box || !state) return;

  box.innerHTML = [...modules]
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    .map((module) => {
      const moduleLessons = lessons.filter(
        (lesson) => lesson.moduleId === module.id
      );
      const total = moduleLessons.length;
      const completed = moduleLessons.filter((lesson) =>
        state.completedLessons.includes(lesson.id)
      ).length;
      const percent = total
        ? Math.round((completed / total) * 100)
        : 0;

      return `
        <div class="module-progress-item">
          <strong>${module.title}</strong>
          <div class="mini-progress">
            <span style="width:${percent}%"></span>
          </div>
          <small>${completed}/${total} • ${percent}%</small>
        </div>
      `;
    })
    .join("");
}


function daysBetween(dateA, dateB) {
  const a = new Date(`${dateA}T00:00:00`);
  const b = new Date(`${dateB}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return Infinity;
  return Math.floor((b - a) / 86400000);
}

function studyStreak() {
  const dates = new Set(
    (Array.isArray(state.sessions) ? state.sessions : [])
      .map((item) => item && item.date)
      .filter(Boolean)
  );

  let cursor = new Date();
  if (!dates.has(todayStr())) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (true) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, "0");
    const day = String(cursor.getDate()).padStart(2, "0");
    const key = `${year}-${month}-${day}`;

    if (!dates.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function todaySessionCount(type) {
  return (Array.isArray(state.sessions) ? state.sessions : []).filter(
    (item) => item && item.date === todayStr() && item.type === type
  ).length;
}

function recommendedFocus() {
  const mistakeQuestions = quizBank.filter((question) =>
    state.quizMistakes.includes(question.id)
  );

  if (mistakeQuestions.length) {
    const counts = {};
    mistakeQuestions.forEach((question) => {
      counts[question.category] = (counts[question.category] || 0) + 1;
    });
    const category = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])[0][0];

    const moduleAliases = {
      cell: "cytology"
    };
    const moduleId = moduleAliases[category] || category;
    const relatedModule = modules.find((module) => module.id === moduleId);

    return {
      module: relatedModule,
      reason: `${counts[category]} ${
        plural(counts[category], ["ошибка", "ошибки", "ошибок"])
      } в тестах`
    };
  }

  const ranked = modules
    .map((module) => {
      const moduleLessons = lessons.filter(
        (lesson) => lesson.moduleId === module.id
      );
      const completed = moduleLessons.filter((lesson) =>
        state.completedLessons.includes(lesson.id)
      ).length;
      return {
        module,
        percent: moduleLessons.length
          ? completed / moduleLessons.length
          : 1
      };
    })
    .filter((item) => item.percent < 1)
    .sort((a, b) => a.percent - b.percent);

  return {
    module: ranked.length ? ranked[0].module : modules[0],
    reason: "самый низкий процент завершения"
  };
}

function startRecommendedQuiz() {
  weeklyControlActive = false;
  const focus = recommendedFocus();
  const aliases = { cytology: "cell" };
  const candidate = focus.module
    ? (aliases[focus.module.id] || focus.module.id)
    : "all";
  const category = testSets().includes(candidate) ? candidate : "all";

  $("quizCategory").value = category;
  $("quizLength").value = "5";
  $("mistakesOnly").checked = state.quizMistakes.length > 0;

  activatePage("quiz");
  startQuiz();
}

function startWeeklyControl() {
  weeklyControlActive = true;
  $("quizCategory").value = "all";
  $("quizLength").value = "20";
  $("mistakesOnly").checked = false;

  activatePage("quiz");
  startQuiz();
}

function renderDailyStudyPlan() {
  const grid = $("studyPlanGrid");
  if (!grid || !state) return;

  const focus = recommendedFocus();
  const focusModule = focus.module;
  const focusLessons = focusModule
    ? lessons
        .filter((lesson) => lesson.moduleId === focusModule.id)
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    : lessons;

  const recommendedLesson =
    focusLessons.find(
      (lesson) => !state.completedLessons.includes(lesson.id)
    ) ||
    lessons.find(
      (lesson) => !state.completedLessons.includes(lesson.id)
    ) ||
    lessons[0];

  const dueCards = strictDueCount("all");
  const lessonDone = todaySessionCount("lesson") > 0;
  const cardsDone = todaySessionCount("card") >= 10;
  const quizDone =
    todaySessionCount("quiz") > 0 ||
    todaySessionCount("weekly") > 0;

  const tasks = [
    {
      done: lessonDone,
      label: "1. Теория",
      title: recommendedLesson
        ? recommendedLesson.title
        : "Все уроки завершены",
      text: recommendedLesson && focusModule
        ? `${focusModule.title} • ${recommendedLesson.duration || 30} минут`
        : "Повтори завершённые темы",
      button: lessonDone ? "Выполнено ✓" : "Открыть урок",
      handler: () => recommendedLesson
        ? openLesson(recommendedLesson.id)
        : goTo("lessons")
    },
    {
      done: cardsDone,
      label: "2. Повторение",
      title: "10 карточек",
      text: dueCards
        ? `${dueCards} ${
            plural(dueCards, ["карточка", "карточки", "карточек"])
          } ожидают повторения`
        : "Закрепи термины активным воспроизведением",
      button: cardsDone ? "Выполнено ✓" : "Повторить",
      handler: () => goTo("cards")
    },
    {
      done: quizDone,
      label: "3. Проверка",
      title: state.quizMistakes.length
        ? "Повторить ошибки"
        : "Мини-тест на 5 вопросов",
      text: state.quizMistakes.length
        ? `${state.quizMistakes.length} ${
            plural(state.quizMistakes.length, ["ошибка", "ошибки", "ошибок"])
          } в личной коллекции`
        : "Проверь понимание сегодняшней темы",
      button: quizDone ? "Выполнено ✓" : "Начать тест",
      handler: startRecommendedQuiz
    }
  ];

  grid.innerHTML = "";
  tasks.forEach((task) => {
    const article = document.createElement("article");
    article.className = `study-task ${task.done ? "done" : ""}`;
    article.innerHTML = `
      <div>
        <div class="study-task-label">${task.label}</div>
        <h4>${task.title}</h4>
        <p>${task.text}</p>
      </div>
      <button class="${task.done ? "soft-button" : "gold-button"}">
        ${task.button}
      </button>
    `;
    article.querySelector("button").onclick = task.handler;
    grid.appendChild(article);
  });

  const completedTasks = [lessonDone, cardsDone, quizDone].filter(Boolean).length;
  $("studyPlanSubtitle").textContent =
    completedTasks === 3
      ? "План выполнен — отличный результат"
      : `Выполнено ${completedTasks} из 3 задач`;
  $("studyStreakValue").textContent = String(studyStreak());

  const lastWeekly = state.weeklyControl.lastDate;
  const daysSinceWeekly = lastWeekly
    ? daysBetween(lastWeekly, todayStr())
    : Infinity;
  const weeklyDue = daysSinceWeekly >= 7;
  const weeklyDoneToday = todaySessionCount("weekly") > 0;
  const remainingDays = Number.isFinite(daysSinceWeekly)
    ? Math.max(0, 7 - daysSinceWeekly)
    : 0;

  $("weeklyControlCard").innerHTML = `
    <div>
      <h4>Еженедельная контрольная</h4>
      <p>
        20 смешанных вопросов • лучший результат:
        ${Number(state.weeklyControl.bestScore || 0)}%
        ${
          weeklyDoneToday
            ? " • выполнена сегодня ✓"
            : weeklyDue
              ? " • пора пройти"
              : ` • следующая через ${remainingDays} ${
                  plural(remainingDays, ["день", "дня", "дней"])
                }`
        }
      </p>
    </div>
    <button id="weeklyControlBtn"
      class="${weeklyDoneToday ? "soft-button" : "gold-button"}">
      ${weeklyDoneToday ? "Пройти ещё раз" : "Начать контрольную"}
    </button>
  `;
  $("weeklyControlBtn").onclick = startWeeklyControl;

  $("weakFocus").innerHTML = focusModule
    ? `Рекомендуемый фокус: <strong>${focusModule.title}</strong> —
       ${focus.reason}.`
    : "";
}

function renderAll() {
  renderHome();
  renderLessons();
  buildDeck();
  renderProgress();
}

async function fetchJSON(url) {
  try {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`${url} → HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error(`${url} должен содержать массив`);
    }

    return data;
  } catch (error) {
    console.warn("MedBio: не удалось загрузить данные.", url, error);
    return [];
  }
}

async function loadData() {
  const [loadedLessons, loadedCards, loadedTests, loadedModules] =
    await Promise.all([
      fetchJSON("./data/lessons.json"),
      fetchJSON("./data/flashcards.json"),
      fetchJSON("./data/tests.json"),
      fetchJSON("./data/modules.json")
    ]);

  lessons = loadedLessons;
  seedCards = loadedCards;
  quizBank = loadedTests;
  modules = loadedModules;
}

document.querySelectorAll("[data-page]").forEach((button) => {
  button.onclick = () => goTo(button.dataset.page);
});

document.querySelectorAll("[data-go]").forEach((button) => {
  button.onclick = () => goTo(button.dataset.go);
});

$("modulesBack").onclick = backToModules;

$("backToLessons").onclick = () => {
  activatePage("lessons");
  renderLessons();
};

$("completeLessonBtn").onclick = () => {
  if (!activeLessonId) return;

  if (!state.completedLessons.includes(activeLessonId)) {
    state.completedLessons.push(activeLessonId);
    state.sessions.push({ date: todayStr(), type: "lesson" });
    saveState();
    renderLessons();
    renderHome();
    renderProgress();
    updateLessonView();
    alert("Урок завершён. Прогресс сохранён.");
  }
};

$("reviewCategory").onchange = buildDeck;

$("showAnswerBtn").onclick = () => {
  $("flashBack").classList.remove("hidden");
  $("answerActions").classList.remove("hidden");
  $("showAnswerBtn").classList.add("hidden");
};

document
  .querySelectorAll("#answerActions button")
  .forEach((button) => {
    button.onclick = () => {
      if (!reviewDeck.length) return;

      const card = reviewDeck[currentCardIndex];
      const score = button.dataset.score;

      if (score === "again") {
        card.interval = 1;
        card.mastery = Math.max(0, Number(card.mastery || 0) - 1);
      }

      if (score === "hard") {
        card.interval = Math.max(
          1,
          Math.round(Number(card.interval || 1) * 1.5)
        );
      }

      if (score === "easy") {
        card.interval = Math.max(
          2,
          Math.round(Number(card.interval || 1) * 2.2)
        );
        card.mastery = Math.min(
          5,
          Number(card.mastery || 0) + 1
        );
      }

      card.nextReview = Date.now() + card.interval * 86400000;
      state.sessions.push({ date: todayStr(), type: "card" });
      reviewDeck.splice(currentCardIndex, 1);

      saveState();
      $("dueCount").textContent =
        `${strictDueCount($("reviewCategory").value)} к повторению`;
      renderCard();
      renderHome();
      renderProgress();
      renderDailyStudyPlan();
    };
  });

$("addCardBtn").onclick = () => {
  const front = $("cardFront").value.trim();
  const back = $("cardBack").value.trim();

  if (!front || !back) {
    alert("Заполни термин и ответ.");
    return;
  }

  state.cards.push({
    id: makeId(),
    category: $("cardCategory").value,
    front,
    pronunciation: $("cardPronunciation").value.trim(),
    back,
    interval: 1,
    nextReview: 0,
    mastery: 0
  });

  $("cardFront").value = "";
  $("cardPronunciation").value = "";
  $("cardBack").value = "";

  saveState();
  buildDeck();
  renderHome();
  renderProgress();
};

$("quizCategory").onchange = startQuiz;

$("exportBtn").onclick = () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json"
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `medbio-backup-${todayStr()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
};

$("importInput").onchange = async (event) => {
  try {
    const file = event.target.files[0];
    if (!file) return;

    const imported = JSON.parse(await file.text());
    if (!imported || typeof imported !== "object") {
      throw new Error("Некорректная резервная копия");
    }

    state = normalizeState(imported);
    saveState();
    $("quizLength").value = String(state.quizSettings.length);
    $("mistakesOnly").checked = state.quizSettings.mistakesOnly;
    updateMistakeCounter();
    renderAll();
    alert("Данные восстановлены.");
  } catch (error) {
    console.warn(error);
    alert("Не удалось прочитать резервную копию.");
  }
};

$("resetBtn").onclick = () => {
  if (!confirm("Удалить весь прогресс?")) return;

  localStorage.removeItem(STORAGE_KEY);
  state = normalizeState(null);
  saveState();
  $("quizLength").value = String(state.quizSettings.length);
  $("mistakesOnly").checked = state.quizSettings.mistakesOnly;
  updateMistakeCounter();
  renderAll();
};

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch((error) => {
    console.warn("MedBio: service worker не зарегистрирован.", error);
  });
}

(async function init() {
  await loadData();
  state = loadState();
  ensureSmartLearningUi();
  syncDataSelectors();
  $("quizLength").value = String(state.quizSettings.length);
  $("mistakesOnly").checked = state.quizSettings.mistakesOnly;
  updateMistakeCounter();
  saveState();
  renderAll();
})();
