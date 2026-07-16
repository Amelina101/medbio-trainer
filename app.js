"use strict";
const STORAGE_KEY="medbio_v03";
const $=id=>document.getElementById(id);
function plural(n,forms){n=Math.abs(Number(n))%100;const n1=n%10;if(n>10&&n<20)return forms[2];if(n1>1&&n1<5)return forms[1];if(n1===1)return forms[0];return forms[2];}
let lessons=[],seedCards=[],quizBank=[]; // учебные данные грузятся из data/*.json
const defaults={cards:[],completedLessons:[],sessions:[],quizHistory:[]};
const DAILY_TARGET_MIN=30;                 // цель на день, минут
const MINUTES_PER={lesson:15,quiz:5,card:2}; // оценка минут за одно действие
const WEIGHTS={lessons:40,tests:35,cards:25}; // вклад в общий прогресс, %
let state=null,reviewDeck=[],currentCardIndex=0,activeLessonId=null,quizQuestions=[],quizIndex=0,quizScore=0;

// Приводит любое (в т.ч. старое или повреждённое) состояние к актуальной схеме,
// не теряя пользовательских данных. Совместимо со STORAGE_KEY medbio_v03.
function normalizeState(raw){
  if(!raw||typeof raw!=="object")raw={};
  const base=structuredClone(defaults);
  const num=(v,d)=>Number.isFinite(+v)?+v:d;
  const str=(v,d="")=>typeof v==="string"?v:d;
  let cards=Array.isArray(raw.cards)?raw.cards:null;
  if(!cards||!cards.length)cards=structuredClone(seedCards);
  const s={...base,...raw};
  s.cards=cards.filter(c=>c&&typeof c==="object").map(c=>({
    id:str(c.id)||crypto.randomUUID(),
    category:str(c.category,"Биология"),
    front:str(c.front),
    pronunciation:str(c.pronunciation),
    back:str(c.back),
    interval:num(c.interval,1),
    nextReview:num(c.nextReview,0),
    mastery:num(c.mastery,0)
  }));
  s.completedLessons=Array.isArray(raw.completedLessons)?raw.completedLessons.filter(x=>typeof x==="string"):[];
  s.sessions=Array.isArray(raw.sessions)?raw.sessions.filter(x=>x&&typeof x==="object"&&typeof x.date==="string"&&typeof x.type==="string"):[];
  s.quizHistory=Array.isArray(raw.quizHistory)?raw.quizHistory.filter(x=>x&&typeof x==="object").map(h=>({
    date:str(h.date),
    score:num(h.score,0),
    category:typeof h.category==="string"?h.category:null // старые записи не знают категорию
  })):[];
  return s;
}
function load(){try{return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY)))}catch{return normalizeState(null)}}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}

function todayStr(){return new Date().toISOString().slice(0,10)}

// Наборы тестов: «Смешанный» + по одному на каждую тему, где есть вопросы.
function testSets(){return ["all",...new Set(quizBank.map(q=>q.category))]}
function strictDueCount(category){
  const now=Date.now();
  return (Array.isArray(state.cards)?state.cards:[])
    .filter(c=>(category==="all"||c.category===category)&&Number(c.nextReview)>0&&Number(c.nextReview)<=now).length;
}

// Единый источник фактической статистики — считается только из state.
function computeStats(){
  const now=Date.now();
  const cards=Array.isArray(state.cards)?state.cards:[];
  const done=Array.isArray(state.completedLessons)?state.completedLessons:[];
  const hist=Array.isArray(state.quizHistory)?state.quizHistory:[];

  const totalLessons=lessons.length;
  const completedLessons=done.filter(id=>lessons.some(l=>l.id===id)).length;
  const lessonProgressPercent=totalLessons?Math.round(completedLessons/totalLessons*100):0;

  const sets=testSets();
  const totalTests=sets.length;
  const completedTests=[...new Set(hist.map(h=>h&&h.category).filter(c=>sets.includes(c)))].length;
  const scores=hist.map(h=>Number(h&&h.score)).filter(Number.isFinite);
  const averageTestScore=scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):0;

  const totalCards=cards.length;
  const learnedCards=cards.filter(c=>Number(c.nextReview)>0).length; // повторяли хотя бы раз
  const dueCards=cards.filter(c=>Number(c.nextReview)>0&&Number(c.nextReview)<=now).length;

  const lp=totalLessons?completedLessons/totalLessons:0;
  const tp=totalTests?completedTests/totalTests:0;
  const cp=totalCards?learnedCards/totalCards:0;
  const overallProgress=Math.round(lp*WEIGHTS.lessons+tp*WEIGHTS.tests+cp*WEIGHTS.cards);

  return {totalLessons,completedLessons,lessonProgressPercent,totalTests,completedTests,
    averageTestScore,totalCards,learnedCards,dueCards,overallProgress};
}

// Дневная активность считается ТОЛЬКО по действиям за сегодняшний календарный день.
function todayActivity(){
  const today=todayStr();
  const todays=(Array.isArray(state.sessions)?state.sessions:[]).filter(s=>s&&s.date===today);
  const minutesRaw=todays.reduce((sum,s)=>sum+(MINUTES_PER[s.type]||0),0);
  const minutes=Math.min(DAILY_TARGET_MIN,minutesRaw);
  const percent=Math.min(100,Math.round(minutesRaw/DAILY_TARGET_MIN*100));
  return {count:todays.length,minutes,target:DAILY_TARGET_MIN,percent,
    lessonToday:todays.some(s=>s.type==="lesson"),
    testToday:todays.some(s=>s.type==="quiz"),
    cardToday:todays.some(s=>s.type==="card")};
}
function goTo(page){document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));document.getElementById(page).classList.add("active");document.querySelectorAll(".bottom-nav button").forEach(b=>b.classList.toggle("active",b.dataset.page===page));if(page==="progress")renderProgress();if(page==="cards")buildDeck();if(page==="quiz")startQuiz();scrollTo({top:0,behavior:"smooth"})}
document.querySelectorAll("[data-page]").forEach(b=>b.onclick=()=>goTo(b.dataset.page));
document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>goTo(b.dataset.go));

function renderHome(){
  const st=computeStats(),day=todayActivity();
  $("homeCardsCount").textContent=`${st.totalCards} ${plural(st.totalCards,["карточка","карточки","карточек"])}`;
  $("homeProgress").textContent=st.overallProgress+"%";
  $("quickLessonsCount").textContent=`${st.totalLessons} ${plural(st.totalLessons,["тема","темы","тем"])}`;
  $("quickTestsCount").textContent=`${st.totalTests} ${plural(st.totalTests,["тест","теста","тестов"])}`;
  $("heroProgressBar").style.width=st.lessonProgressPercent+"%";
  $("heroProgressValue").textContent=st.lessonProgressPercent+"%";
  $("dailyMinutes").textContent=day.minutes;
  $("dailyBar").style.width=day.percent+"%";
}
function renderLessons(){
  const filter=document.getElementById("lessonFilter").value;
  const box=document.getElementById("lessonList");box.innerHTML="";
  lessons.filter(l=>filter==="all"||l.category===filter).forEach(l=>{
    const d=document.createElement("button");d.className="lesson-card glass-card";
    d.innerHTML=`<div class="lesson-thumb"></div><div><h3>${l.title}</h3><p>${l.level} • ${l.duration} минут ${state.completedLessons.includes(l.id)?"• завершён":""}</p></div><div class="lesson-arrow">›</div>`;
    d.onclick=()=>openLesson(l.id);box.appendChild(d);
  });
}
$("lessonFilter").onchange=renderLessons;
function openLesson(id){activeLessonId=id;$("lessonArticle").innerHTML=lessons.find(l=>l.id===id).content;goTo("lessonView")}
$("backToLessons").onclick=()=>goTo("lessons");
$("completeLessonBtn").onclick=()=>{if(activeLessonId&&!state.completedLessons.includes(activeLessonId)){state.completedLessons.push(activeLessonId);state.sessions.push({date:todayStr(),type:"lesson"});save();renderLessons();renderHome();renderProgress()}alert("Урок отмечен как завершённый.")};

function buildDeck(){
  const category=$("reviewCategory").value,now=Date.now();
  const inCat=c=>category==="all"||c.category===category;
  const cards=Array.isArray(state.cards)?state.cards:[];
  // Для изучения показываем и просроченные, и ещё не повторявшиеся карточки.
  reviewDeck=cards.filter(c=>inCat(c)&&(!c.nextReview||Number(c.nextReview)<=now));
  if(!reviewDeck.length)reviewDeck=cards.filter(inCat);
  currentCardIndex=0;
  $("dueCount").textContent=`${strictDueCount(category)} к повторению`; // строго due, не длина колоды
  renderCard();
}
$("reviewCategory").onchange=buildDeck;
function renderCard(){
  $("flashBack").classList.add("hidden");$("answerActions").classList.add("hidden");$("showAnswerBtn").classList.remove("hidden");
  if(!reviewDeck.length){$("flashFront").textContent="Карточек нет";$("flashPronunciation").textContent="";$("flashCategory").textContent="";return}
  const c=reviewDeck[currentCardIndex];
  $("flashFront").textContent=c.front;$("flashPronunciation").textContent=c.pronunciation||"";$("flashBack").textContent=c.back;$("flashCategory").textContent=c.category;
}
$("showAnswerBtn").onclick=()=>{$("flashBack").classList.remove("hidden");$("answerActions").classList.remove("hidden");$("showAnswerBtn").classList.add("hidden")};
document.querySelectorAll("#answerActions button").forEach(b=>b.onclick=()=>{
  if(!reviewDeck.length)return;const c=reviewDeck[currentCardIndex],s=b.dataset.score;
  if(s==="again"){c.interval=1;c.mastery=Math.max(0,(c.mastery||0)-1)}
  if(s==="hard")c.interval=Math.max(1,Math.round((c.interval||1)*1.5));
  if(s==="easy"){c.interval=Math.max(2,Math.round((c.interval||1)*2.2));c.mastery=Math.min(5,(c.mastery||0)+1)}
  c.nextReview=Date.now()+c.interval*86400000;state.sessions.push({date:todayStr(),type:"card"});reviewDeck.splice(currentCardIndex,1);save();
  $("dueCount").textContent=`${strictDueCount($("reviewCategory").value)} к повторению`;renderCard();renderHome();renderProgress();
});
$("addCardBtn").onclick=()=>{
  const f=$("cardFront").value.trim(),b=$("cardBack").value.trim();if(!f||!b)return alert("Заполни термин и ответ.");
  state.cards.push({id:crypto.randomUUID(),category:$("cardCategory").value,front:f,pronunciation:$("cardPronunciation").value.trim(),back:b,interval:1,nextReview:0,mastery:0});
  $("cardFront").value=$("cardPronunciation").value=$("cardBack").value="";save();buildDeck();renderHome();renderProgress();
};

let quizCategoryActive="all";
function startQuiz(){
  quizCategoryActive=$("quizCategory").value;
  quizQuestions=quizBank.filter(q=>quizCategoryActive==="all"||q.category===quizCategoryActive).sort(()=>Math.random()-.5).slice(0,5);
  quizIndex=0;quizScore=0;$("quizResult").classList.add("hidden");renderQuestion();
}
$("quizCategory").onchange=startQuiz;
function renderQuestion(){
  if(quizIndex>=quizQuestions.length){
    const p=quizQuestions.length?Math.round(quizScore/quizQuestions.length*100):0;
    state.quizHistory.unshift({date:new Date().toLocaleDateString("ru-RU"),score:p,category:quizCategoryActive});state.quizHistory=state.quizHistory.slice(0,10);
    state.sessions.push({date:todayStr(),type:"quiz"});save();renderHome();renderProgress();
    $("quizBox").innerHTML="<h3>Тест завершён</h3>";$("quizResult").innerHTML=`<h3>Результат: ${quizScore}/${quizQuestions.length} — ${p}%</h3><button id="againQuiz" class="gold-button">Пройти ещё раз</button>`;
    $("quizResult").classList.remove("hidden");$("againQuiz").onclick=startQuiz;return;
  }
  const item=quizQuestions[quizIndex];$("quizBox").innerHTML=`<span class="section-label">Вопрос ${quizIndex+1} из ${quizQuestions.length}</span><h3>${item.q}</h3>`;
  item.options.forEach((o,i)=>{const b=document.createElement("button");b.className="option";b.textContent=o;b.onclick=()=>{$("quizBox").querySelectorAll(".option").forEach(x=>x.disabled=true);if(i===item.answer){b.classList.add("correct");quizScore++}else{b.classList.add("wrong");$("quizBox").querySelectorAll(".option")[item.answer].classList.add("correct")}setTimeout(()=>{quizIndex++;renderQuestion()},650)};$("quizBox").appendChild(b)});
}
function renderProgress(){
  const st=computeStats();
  $("overallProgress").textContent=st.overallProgress+"%";
  const ring=document.querySelector(".ring-progress");
  if(ring)ring.style.setProperty("--progress",st.overallProgress); // кольцо рисуется из --progress
  $("completedLessons").textContent=st.completedLessons;
  $("dueCardsValue").textContent=st.dueCards;
  $("avgScoreValue").textContent=st.averageTestScore+"%";
  const hist=Array.isArray(state.quizHistory)?state.quizHistory:[];
  $("historyList").innerHTML=hist.length?hist.map(h=>`<div class="history-item"><span>${h.date}</span><strong>${h.score}%</strong></div>`).join(""):"<p style='color:var(--muted)'>Тесты пока не пройдены.</p>";
}
$("exportBtn").onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`medbio-backup-${todayStr()}.json`;a.click();URL.revokeObjectURL(a.href)};
$("importInput").onchange=async e=>{try{const data=JSON.parse(await e.target.files[0].text());if(!data||typeof data!=="object")throw 0;state=normalizeState(data);save();renderAll();alert("Данные восстановлены.")}catch{alert("Не удалось прочитать резервную копию.")}};
$("resetBtn").onclick=()=>{if(confirm("Удалить весь прогресс?")){localStorage.removeItem(STORAGE_KEY);state=normalizeState(null);save();renderAll()}};
function renderAll(){renderHome();renderLessons();buildDeck();renderProgress()}
if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js");

// --- Загрузка учебных данных из data/*.json (устойчиво к сбою: пустой массив вместо падения) ---
async function fetchJSON(url){
  try{const r=await fetch(url);if(!r.ok)throw new Error(url+" -> "+r.status);const d=await r.json();return Array.isArray(d)?d:[];}
  catch(e){console.warn("MedBio: не удалось загрузить",url,e);return[];}
}
async function loadData(){
  const [l,c,q]=await Promise.all([
    fetchJSON("./data/lessons.json"),
    fetchJSON("./data/flashcards.json"),
    fetchJSON("./data/tests.json")
  ]);
  lessons=l;seedCards=c;quizBank=q;
}
(async()=>{ await loadData(); state=load(); renderAll(); })();
