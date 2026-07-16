
const STORAGE_KEY="medbio_v03";
const lessons=[
{id:"cell-membrane",category:"cell",title:"Клеточная мембрана",level:"Биология",duration:20,content:`<h2>Клеточная мембрана</h2><p><b>Цель:</b> понять строение мембраны и механизмы транспорта веществ.</p><h3>Основные компоненты</h3><table><tr><th>Компонент</th><th>Функция</th></tr><tr><td>Фосфолипиды</td><td>Образуют бислой</td></tr><tr><td>Белки</td><td>Транспорт и рецепция</td></tr><tr><td>Холестерин</td><td>Регулирует текучесть</td></tr></table><p><b>Cell membrane</b> /sel ˈmem.breɪn/ — клеточная мембрана.</p>`},
{id:"mitochondria",category:"cell",title:"Митохондрии",level:"Биология",duration:20,content:`<h2>Митохондрии</h2><p>Митохондрии участвуют в клеточном дыхании и синтезе ATP.</p><ul><li>наружная мембрана;</li><li>внутренняя мембрана;</li><li>кристы;</li><li>матрикс.</li></ul><p><b>Mitochondrion</b> /ˌmaɪ.təˈkɒn.dri.ən/ — митохондрия.</p>`},
{id:"mitosis-meiosis",category:"genetics",title:"Митоз и мейоз",level:"Генетика",duration:30,content:`<h2>Митоз и мейоз</h2><p><b>Митоз</b> сохраняет число хромосом. <b>Мейоз</b> уменьшает его вдвое.</p><table><tr><th>Признак</th><th>Митоз</th><th>Мейоз</th></tr><tr><td>Делений</td><td>1</td><td>2</td></tr><tr><td>Клеток</td><td>2</td><td>4</td></tr><tr><td>Кроссинговер</td><td>Нет</td><td>Есть</td></tr></table>`},
{id:"heart",category:"anatomy",title:"Сердце: камеры и клапаны",level:"Анатомия",duration:25,content:`<h2>Сердце</h2><p><b>Heart</b> /hɑːrt/ — сердце. <b>Cor, cordis n.</b></p><p>Сердце состоит из двух предсердий и двух желудочков.</p><ul><li>трёхстворчатый клапан;</li><li>митральный клапан;</li><li>клапан аорты;</li><li>клапан лёгочного ствола.</li></ul>`},
{id:"blood-flow",category:"physiology",title:"Круги кровообращения",level:"Физиология",duration:25,content:`<h2>Круги кровообращения</h2><p>Большой круг начинается в левом желудочке и заканчивается в правом предсердии.</p><p>Малый круг начинается в правом желудочке и заканчивается в левом предсердии.</p>`}
];
const seedCards=[
{id:"c1",category:"Medical English",front:"Heart",pronunciation:"/hɑːrt/",back:"Сердце. Latin: cor, cordis n.",interval:1,nextReview:0,mastery:0},
{id:"c2",category:"Latin",front:"Cor, cordis n.",pronunciation:"/kor/",back:"Сердце. English: heart.",interval:1,nextReview:0,mastery:0},
{id:"c3",category:"Биология",front:"Что такое хлоропласт?",pronunciation:"",back:"Органоид клеток растений и водорослей, в котором происходит фотосинтез.",interval:1,nextReview:0,mastery:0},
{id:"c4",category:"Анатомия",front:"Aorta",pronunciation:"/eɪˈɔːrtə/",back:"Аорта — крупнейшая артерия организма.",interval:1,nextReview:0,mastery:0},
{id:"c5",category:"Medical English",front:"Lung",pronunciation:"/lʌŋ/",back:"Лёгкое. Latin: pulmo, pulmonis m.",interval:1,nextReview:0,mastery:0}
];
const quizBank=[
{category:"cell",q:"Что образует основу клеточной мембраны?",options:["ДНК","Фосфолипидный бислой","Гликоген","Целлюлоза"],answer:1},
{category:"cell",q:"Где происходит основной синтез ATP?",options:["Ядро","Митохондрии","Лизосомы","Рибосомы"],answer:1},
{category:"genetics",q:"Когда происходит кроссинговер?",options:["Профаза I мейоза","Телофаза митоза","Интерфаза","Метафаза митоза"],answer:0},
{category:"anatomy",q:"Как по-латыни «сердце»?",options:["Pulmo","Ren","Cor","Hepar"],answer:2},
{category:"anatomy",q:"Сколько камер у сердца человека?",options:["2","3","4","5"],answer:2},
{category:"anatomy",q:"Из какого желудочка начинается большой круг?",options:["Правого","Левого","Из обоих","Ни из одного"],answer:1}
];
const defaults={cards:seedCards,completedLessons:[],sessions:[],quizHistory:[]};
let state=load(),reviewDeck=[],currentCardIndex=0,activeLessonId=null,quizQuestions=[],quizIndex=0,quizScore=0;
function load(){try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY));return saved?{...defaults,...saved,cards:saved.cards||seedCards}:structuredClone(defaults)}catch{return structuredClone(defaults)}}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function goTo(page){document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));document.getElementById(page).classList.add("active");document.querySelectorAll(".bottom-nav button").forEach(b=>b.classList.toggle("active",b.dataset.page===page));if(page==="progress")renderProgress();if(page==="cards")buildDeck();if(page==="quiz")startQuiz();scrollTo({top:0,behavior:"smooth"})}
document.querySelectorAll("[data-page]").forEach(b=>b.onclick=()=>goTo(b.dataset.page));
document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>goTo(b.dataset.go));

function renderHome(){
  const completed=state.completedLessons.length;
  const overall=Math.min(100,Math.round((completed/lessons.length)*100));
  document.getElementById("homeCardsCount").textContent=`${state.cards.length} карточек`;
  document.getElementById("homeProgress").textContent=overall+"%";
  document.getElementById("dailyMinutes").textContent=Math.min(30,15+completed*3);
  document.getElementById("dailyBar").style.width=Math.min(100,50+completed*10)+"%";
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
lessonFilter.onchange=renderLessons;
function openLesson(id){activeLessonId=id;lessonArticle.innerHTML=lessons.find(l=>l.id===id).content;goTo("lessonView")}
backToLessons.onclick=()=>goTo("lessons");
completeLessonBtn.onclick=()=>{if(activeLessonId&&!state.completedLessons.includes(activeLessonId)){state.completedLessons.push(activeLessonId);state.sessions.push({date:new Date().toISOString().slice(0,10),type:"lesson"});save();renderLessons();renderHome()}alert("Урок отмечен как завершённый.")};

function buildDeck(){
  const category=reviewCategory.value,now=Date.now();
  reviewDeck=state.cards.filter(c=>(category==="all"||c.category===category)&&(!c.nextReview||c.nextReview<=now));
  if(!reviewDeck.length)reviewDeck=state.cards.filter(c=>category==="all"||c.category===category);
  currentCardIndex=0;dueCount.textContent=`${reviewDeck.length} к повторению`;renderCard();
}
reviewCategory.onchange=buildDeck;
function renderCard(){
  flashBack.classList.add("hidden");answerActions.classList.add("hidden");showAnswerBtn.classList.remove("hidden");
  if(!reviewDeck.length){flashFront.textContent="Карточек нет";flashPronunciation.textContent="";flashCategory.textContent="";return}
  const c=reviewDeck[currentCardIndex%reviewDeck.length];
  flashFront.textContent=c.front;flashPronunciation.textContent=c.pronunciation||"";flashBack.textContent=c.back;flashCategory.textContent=c.category;
}
showAnswerBtn.onclick=()=>{flashBack.classList.remove("hidden");answerActions.classList.remove("hidden");showAnswerBtn.classList.add("hidden")};
document.querySelectorAll("#answerActions button").forEach(b=>b.onclick=()=>{
  if(!reviewDeck.length)return;const c=reviewDeck[currentCardIndex],s=b.dataset.score;
  if(s==="again"){c.interval=1;c.mastery=Math.max(0,(c.mastery||0)-1)}
  if(s==="hard")c.interval=Math.max(1,Math.round((c.interval||1)*1.5));
  if(s==="easy"){c.interval=Math.max(2,Math.round((c.interval||1)*2.2));c.mastery=Math.min(5,(c.mastery||0)+1)}
  c.nextReview=Date.now()+c.interval*86400000;state.sessions.push({date:new Date().toISOString().slice(0,10),type:"card"});reviewDeck.splice(currentCardIndex,1);save();dueCount.textContent=`${reviewDeck.length} к повторению`;renderCard();renderHome();
});
addCardBtn.onclick=()=>{
  const f=cardFront.value.trim(),b=cardBack.value.trim();if(!f||!b)return alert("Заполни термин и ответ.");
  state.cards.push({id:crypto.randomUUID(),category:cardCategory.value,front:f,pronunciation:cardPronunciation.value.trim(),back:b,interval:1,nextReview:0,mastery:0});
  cardFront.value=cardPronunciation.value=cardBack.value="";save();buildDeck();renderHome();
};

function startQuiz(){
  const category=quizCategory.value;quizQuestions=quizBank.filter(q=>category==="all"||q.category===category).sort(()=>Math.random()-.5).slice(0,5);
  quizIndex=0;quizScore=0;quizResult.classList.add("hidden");renderQuestion();
}
quizCategory.onchange=startQuiz;
function renderQuestion(){
  if(quizIndex>=quizQuestions.length){
    const p=quizQuestions.length?Math.round(quizScore/quizQuestions.length*100):0;
    state.quizHistory.unshift({date:new Date().toLocaleDateString("ru-RU"),score:p});state.quizHistory=state.quizHistory.slice(0,10);
    state.sessions.push({date:new Date().toISOString().slice(0,10),type:"quiz"});save();renderHome();
    quizBox.innerHTML="<h3>Тест завершён</h3>";quizResult.innerHTML=`<h3>Результат: ${quizScore}/${quizQuestions.length} — ${p}%</h3><button id="againQuiz" class="gold-button">Пройти ещё раз</button>`;
    quizResult.classList.remove("hidden");againQuiz.onclick=startQuiz;return;
  }
  const item=quizQuestions[quizIndex];quizBox.innerHTML=`<span class="section-label">Вопрос ${quizIndex+1} из ${quizQuestions.length}</span><h3>${item.q}</h3>`;
  item.options.forEach((o,i)=>{const b=document.createElement("button");b.className="option";b.textContent=o;b.onclick=()=>{quizBox.querySelectorAll(".option").forEach(x=>x.disabled=true);if(i===item.answer){b.classList.add("correct");quizScore++}else{b.classList.add("wrong");quizBox.querySelectorAll(".option")[item.answer].classList.add("correct")}setTimeout(()=>{quizIndex++;renderQuestion()},650)};quizBox.appendChild(b)});
}
function renderProgress(){
  const overall=Math.min(100,Math.round((state.completedLessons.length/lessons.length)*100));
  overallProgress.textContent=overall+"%";document.querySelector(".ring-progress").style.background=`conic-gradient(var(--gold-soft) 0 ${overall}%,rgba(255,255,255,.07) ${overall}% 100%)`;
  completedLessons.textContent=state.completedLessons.length;totalCards.textContent=state.cards.length;bestScore.textContent=(state.quizHistory.length?Math.max(...state.quizHistory.map(x=>x.score)):0)+"%";
  historyList.innerHTML=state.quizHistory.length?state.quizHistory.map(h=>`<div class="history-item"><span>${h.date}</span><strong>${h.score}%</strong></div>`).join(""):"<p style='color:var(--muted)'>Тесты пока не пройдены.</p>";
}
exportBtn.onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`medbio-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)};
importInput.onchange=async e=>{try{const data=JSON.parse(await e.target.files[0].text());if(!data.cards)throw 0;state={...defaults,...data};save();renderAll();alert("Данные восстановлены.")}catch{alert("Не удалось прочитать резервную копию.")}};
resetBtn.onclick=()=>{if(confirm("Удалить весь прогресс?")){localStorage.removeItem(STORAGE_KEY);state=structuredClone(defaults);save();renderAll()}};
function renderAll(){renderHome();renderLessons();buildDeck();renderProgress()}
if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js");
renderAll();
