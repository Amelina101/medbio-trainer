const seedCards = [
  {id: crypto.randomUUID(), category:"Medical English", front:"Heart /hɑːrt/", back:"Сердце. Latin: cor, cordis n.", score:0},
  {id: crypto.randomUUID(), category:"Latin", front:"Cor, cordis n.", back:"Сердце. English: heart.", score:0},
  {id: crypto.randomUUID(), category:"Биология", front:"Главная функция митохондрий", back:"Синтез ATP в процессе клеточного дыхания.", score:0},
  {id: crypto.randomUUID(), category:"Анатомия", front:"Aorta /eɪˈɔːrtə/", back:"Аорта — крупнейшая артерия организма. Latin: aorta.", score:0}
];

const lessons = [
  {
    title:"Клеточная мембрана",
    body:`<p><b>Цель:</b> понять строение и функции плазматической мембраны.</p>
    <p>Мембрана состоит главным образом из фосфолипидного бислоя, белков и углеводных компонентов.</p>
    <ul><li>Барьерная функция</li><li>Транспорт веществ</li><li>Рецепция сигналов</li></ul>`
  },
  {
    title:"Митохондрии",
    body:`<p><b>Mitochondrion</b> /ˌmaɪ.təˈkɒn.dri.ən/ — митохондрия.</p>
    <p>Основная роль — окисление органических веществ и синтез ATP.</p>`
  },
  {
    title:"Сердце: основы анатомии",
    body:`<p><b>Heart</b> /hɑːrt/ — сердце. <b>Cor, cordis n.</b></p>
    <p>Сердце имеет четыре камеры: два предсердия и два желудочка.</p>`
  }
];

const quiz = [
  {q:"Где происходит основной синтез ATP?", options:["Ядро","Митохондрии","Лизосомы","Аппарат Гольджи"], answer:1},
  {q:"Как по-латыни «сердце»?", options:["Pulmo","Hepar","Cor","Ren"], answer:2},
  {q:"Что образует основу клеточной мембраны?", options:["ДНК","Фосфолипидный бислой","Целлюлоза","Гликоген"], answer:1}
];

let cards = JSON.parse(localStorage.getItem("medbio_cards")) || seedCards;
let stats = JSON.parse(localStorage.getItem("medbio_stats")) || {tests:0,best:0};
let currentCard = 0;
let quizIndex = 0;
let quizScore = 0;

function save() {
  localStorage.setItem("medbio_cards", JSON.stringify(cards));
  localStorage.setItem("medbio_stats", JSON.stringify(stats));
}

document.querySelectorAll(".bottom-nav button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".bottom-nav button").forEach(b => b.classList.remove("active"));
    document.getElementById(btn.dataset.page).classList.add("active");
    btn.classList.add("active");
    if (btn.dataset.page === "progress") renderProgress();
    if (btn.dataset.page === "quiz") startQuiz();
  });
});

function renderLessons() {
  const box = document.getElementById("lessonList");
  box.innerHTML = "";
  lessons.forEach((lesson, i) => {
    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = `<h3 class="lesson-title">${lesson.title}</h3><div class="lesson-body hidden">${lesson.body}</div>`;
    el.querySelector(".lesson-title").onclick = () => el.querySelector(".lesson-body").classList.toggle("hidden");
    box.appendChild(el);
  });
}

function renderCard() {
  const front = document.getElementById("flashFront");
  const back = document.getElementById("flashBack");
  const cat = document.getElementById("flashCategory");
  const actions = document.getElementById("answerActions");
  back.classList.add("hidden");
  actions.classList.add("hidden");
  document.getElementById("showAnswerBtn").classList.remove("hidden");

  if (!cards.length) {
    front.textContent = "Карточек пока нет";
    back.textContent = "";
    cat.textContent = "";
    return;
  }
  currentCard %= cards.length;
  const card = cards[currentCard];
  front.textContent = card.front;
  back.textContent = card.back;
  cat.textContent = card.category;
}

document.getElementById("addCardBtn").onclick = () => {
  const category = document.getElementById("cardCategory").value;
  const front = document.getElementById("cardFront").value.trim();
  const back = document.getElementById("cardBack").value.trim();
  if (!front || !back) return alert("Заполни вопрос и ответ.");
  cards.push({id:crypto.randomUUID(), category, front, back, score:0});
  document.getElementById("cardFront").value = "";
  document.getElementById("cardBack").value = "";
  save(); renderCard();
};

document.getElementById("showAnswerBtn").onclick = () => {
  document.getElementById("flashBack").classList.remove("hidden");
  document.getElementById("answerActions").classList.remove("hidden");
  document.getElementById("showAnswerBtn").classList.add("hidden");
};

document.querySelectorAll("#answerActions button").forEach(btn => {
  btn.onclick = () => {
    if (!cards.length) return;
    const card = cards[currentCard];
    if (btn.dataset.score === "easy") card.score = Math.min(5,(card.score||0)+1);
    if (btn.dataset.score === "hard") card.score = Math.max(0,(card.score||0));
    if (btn.dataset.score === "again") card.score = Math.max(0,(card.score||0)-1);
    currentCard = (currentCard + 1) % cards.length;
    save(); renderCard();
  };
});

function startQuiz() {
  quizIndex = 0; quizScore = 0;
  document.getElementById("quizResult").classList.add("hidden");
  renderQuestion();
}

function renderQuestion() {
  const box = document.getElementById("quizBox");
  if (quizIndex >= quiz.length) {
    const percent = Math.round(quizScore / quiz.length * 100);
    stats.tests += 1;
    stats.best = Math.max(stats.best, percent);
    save();
    box.innerHTML = "<h3>Тест завершён</h3>";
    const result = document.getElementById("quizResult");
    result.innerHTML = `<h3>Результат: ${quizScore}/${quiz.length} (${percent}%)</h3><button id="againQuiz">Пройти ещё раз</button>`;
    result.classList.remove("hidden");
    document.getElementById("againQuiz").onclick = startQuiz;
    return;
  }

  const item = quiz[quizIndex];
  box.innerHTML = `<div class="tag">Вопрос ${quizIndex+1} из ${quiz.length}</div><h3>${item.q}</h3>`;
  item.options.forEach((opt, index) => {
    const btn = document.createElement("button");
    btn.className = "option";
    btn.textContent = opt;
    btn.onclick = () => {
      box.querySelectorAll(".option").forEach(b => b.disabled = true);
      if (index === item.answer) {
        btn.classList.add("correct"); quizScore++;
      } else {
        btn.classList.add("wrong");
        box.querySelectorAll(".option")[item.answer].classList.add("correct");
      }
      setTimeout(() => { quizIndex++; renderQuestion(); }, 700);
    };
    box.appendChild(btn);
  });
}

function renderProgress() {
  document.getElementById("totalCards").textContent = cards.length;
  document.getElementById("knownCards").textContent = cards.filter(c => (c.score||0) >= 3).length;
  document.getElementById("testsDone").textContent = stats.tests;
  document.getElementById("bestScore").textContent = stats.best + "%";
}

document.getElementById("resetBtn").onclick = () => {
  if (!confirm("Удалить весь прогресс и карточки?")) return;
  localStorage.clear();
  cards = [...seedCards];
  stats = {tests:0,best:0};
  save(); renderCard(); renderProgress();
};

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");

let deferredPrompt;
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault(); deferredPrompt = e;
  document.getElementById("installBtn").classList.remove("hidden");
});
document.getElementById("installBtn").onclick = async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
};

renderLessons();
renderCard();
