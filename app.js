
const STORAGE_KEY="medbio_v02";
const lessons=[
{id:"cell-membrane",category:"cell",title:"Клеточная мембрана",level:"Базовый",duration:20,content:`<h2>Клеточная мембрана</h2><p><b>Цель:</b> понять строение мембраны и механизмы транспорта веществ.</p><h3>Основные компоненты</h3><table><tr><th>Компонент</th><th>Функция</th></tr><tr><td>Фосфолипиды</td><td>Образуют бислой</td></tr><tr><td>Белки</td><td>Транспорт и рецепция</td></tr><tr><td>Холестерин</td><td>Регулирует текучесть</td></tr></table><p><b>Cell membrane</b> /sel ˈmem.breɪn/ — клеточная мембрана.</p>`},
{id:"mitochondria",category:"cell",title:"Митохондрии",level:"Базовый",duration:20,content:`<h2>Митохондрии</h2><p>Участвуют в клеточном дыхании и синтезе ATP.</p><ul><li>наружная мембрана;</li><li>внутренняя мембрана;</li><li>кристы;</li><li>матрикс.</li></ul><p><b>Mitochondrion</b> /ˌmaɪ.təˈkɒn.dri.ən/ — митохондрия.</p>`},
{id:"mitosis-meiosis",category:"genetics",title:"Митоз и мейоз",level:"Олимпиадный",duration:30,content:`<h2>Митоз и мейоз</h2><p><b>Митоз</b> сохраняет число хромосом. <b>Мейоз</b> уменьшает его вдвое.</p><table><tr><th>Признак</th><th>Митоз</th><th>Мейоз</th></tr><tr><td>Делений</td><td>1</td><td>2</td></tr><tr><td>Клеток</td><td>2</td><td>4</td></tr><tr><td>Кроссинговер</td><td>Нет</td><td>Есть</td></tr></table>`},
{id:"heart",category:"anatomy",title:"Сердце: камеры и клапаны",level:"Медицинский",duration:25,content:`<h2>Сердце</h2><p><b>Heart</b> /hɑːrt/ — сердце. <b>Cor, cordis n.</b></p><p>Сердце состоит из двух предсердий и двух желудочков.</p><ul><li>трёхстворчатый клапан;</li><li>митральный клапан;</li><li>клапан аорты;</li><li>клапан лёгочного ствола.</li></ul>`},
{id:"blood-flow",category:"physiology",title:"Круги кровообращения",level:"Медицинский",duration:25,content:`<h2>Круги кровообращения</h2><p>Большой круг начинается в левом желудочке и заканчивается в правом предсердии.</p><p>Малый круг начинается в правом желудочке и заканчивается в левом предсердии.</p>`}
];
const seedCards=[
{id:"c1",category:"Medical English",front:"Heart",pronunciation:"/hɑːrt/",back:"Сердце. Latin: cor, cordis n.",interval:1,nextReview:0,mastery:0},
{id:"c2",category:"Latin",front:"Cor, cordis n.",pronunciation:"/kor/",back:"Сердце. English: heart.",interval:1,nextReview:0,mastery:0},
{id:"c3",category:"Биология",front:"Главная функция митохондрий",pronunciation:"",back:"Синтез ATP в процессе клеточного дыхания.",interval:1,nextReview:0,mastery:0},
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
function load(){try{return {...defaults,...JSON.parse(localStorage.getItem(STORAGE_KEY))}}catch(e){return structuredClone(defaults)}}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function goTo(page){document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));document.getElementById(page).classList.add("active");document.querySelectorAll(".bottom-nav button").forEach(b=>b.classList.toggle("active",b.dataset.page===page));if(page==="progress")renderProgress();if(page==="cards")buildDeck();if(page==="quiz")startQuiz();scrollTo(0,0)}
document.querySelectorAll("[data-page]").forEach(b=>b.onclick=()=>goTo(b.dataset.page));
document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>goTo(b.dataset.go));
document.getElementById("startTodayBtn").onclick=()=>goTo("lessons");

function renderHome(){const days=new Set(state.sessions.map(s=>s.date)).size,p=Math.min(100,Math.round(Math.min(5,days)/5*100));weekPercent.textContent=p+"%";weekBar.style.width=p+"%"}
function renderLessons(){const f=lessonFilter.value;lessonList.innerHTML="";lessons.filter(l=>f==="all"||l.category===f).forEach(l=>{const d=document.createElement("div");d.className="card lesson-card";d.innerHTML=`<div class="lesson-meta"><span class="pill">${l.level}</span><span class="pill">${l.duration} мин</span>${state.completedLessons.includes(l.id)?'<span class="pill">✓ завершён</span>':""}</div><h3>${l.title}</h3>`;d.onclick=()=>openLesson(l.id);lessonList.appendChild(d)})}
lessonFilter.onchange=renderLessons;
function openLesson(id){activeLessonId=id;lessonArticle.innerHTML=lessons.find(l=>l.id===id).content;goTo("lessonView")}
backToLessons.onclick=()=>goTo("lessons");
completeLessonBtn.onclick=()=>{if(activeLessonId&&!state.completedLessons.includes(activeLessonId)){state.completedLessons.push(activeLessonId);state.sessions.push({date:new Date().toISOString().slice(0,10),type:"lesson"});save();renderLessons();renderHome()}alert("Урок отмечен как завершённый.")};

function buildDeck(){const c=reviewCategory.value,now=Date.now();reviewDeck=state.cards.filter(x=>(c==="all"||x.category===c)&&(!x.nextReview||x.nextReview<=now));if(!reviewDeck.length)reviewDeck=state.cards.filter(x=>c==="all"||x.category===c);currentCardIndex=0;dueCount.textContent=`${reviewDeck.length} к повторению`;renderCard()}
reviewCategory.onchange=buildDeck;
shuffleBtn.onclick=()=>{reviewDeck.sort(()=>Math.random()-.5);renderCard()};
function renderCard(){flashBack.classList.add("hidden");answerActions.classList.add("hidden");showAnswerBtn.classList.remove("hidden");if(!reviewDeck.length){flashFront.textContent="Карточек нет";flashPronunciation.textContent="";flashCategory.textContent="";return}const c=reviewDeck[currentCardIndex%reviewDeck.length];flashFront.textContent=c.front;flashPronunciation.textContent=c.pronunciation||"";flashBack.textContent=c.back;flashCategory.textContent=c.category}
showAnswerBtn.onclick=()=>{flashBack.classList.remove("hidden");answerActions.classList.remove("hidden");showAnswerBtn.classList.add("hidden")};
document.querySelectorAll("#answerActions button").forEach(b=>b.onclick=()=>{if(!reviewDeck.length)return;const c=reviewDeck[currentCardIndex],s=b.dataset.score;if(s==="again"){c.interval=1;c.mastery=Math.max(0,(c.mastery||0)-1)}if(s==="hard")c.interval=Math.max(1,Math.round((c.interval||1)*1.5));if(s==="easy"){c.interval=Math.max(2,Math.round((c.interval||1)*2.2));c.mastery=Math.min(5,(c.mastery||0)+1)}c.nextReview=Date.now()+c.interval*86400000;state.sessions.push({date:new Date().toISOString().slice(0,10),type:"card"});reviewDeck.splice(currentCardIndex,1);save();dueCount.textContent=`${reviewDeck.length} к повторению`;renderCard();renderHome()});
addCardBtn.onclick=()=>{const f=cardFront.value.trim(),b=cardBack.value.trim();if(!f||!b)return alert("Заполни термин и ответ.");state.cards.push({id:crypto.randomUUID(),category:cardCategory.value,front:f,pronunciation:cardPronunciation.value.trim(),back:b,interval:1,nextReview:0,mastery:0});cardFront.value=cardPronunciation.value=cardBack.value="";save();buildDeck()};

function startQuiz(){const c=quizCategory.value;quizQuestions=quizBank.filter(q=>c==="all"||q.category===c).sort(()=>Math.random()-.5).slice(0,5);quizIndex=0;quizScore=0;quizResult.classList.add("hidden");renderQuestion()}
quizCategory.onchange=startQuiz;
function renderQuestion(){if(quizIndex>=quizQuestions.length){const p=quizQuestions.length?Math.round(quizScore/quizQuestions.length*100):0;state.quizHistory.unshift({date:new Date().toLocaleDateString("ru-RU"),score:p});state.quizHistory=state.quizHistory.slice(0,10);state.sessions.push({date:new Date().toISOString().slice(0,10),type:"quiz"});save();renderHome();quizBox.innerHTML="<h3>Тест завершён</h3>";quizResult.innerHTML=`<h3>Результат: ${quizScore}/${quizQuestions.length} — ${p}%</h3><button id="againQuiz">Пройти ещё раз</button>`;quizResult.classList.remove("hidden");againQuiz.onclick=startQuiz;return}const item=quizQuestions[quizIndex];quizBox.innerHTML=`<div class="tag">Вопрос ${quizIndex+1} из ${quizQuestions.length}</div><h3>${item.q}</h3>`;item.options.forEach((o,i)=>{const b=document.createElement("button");b.className="option";b.textContent=o;b.onclick=()=>{quizBox.querySelectorAll(".option").forEach(x=>x.disabled=true);if(i===item.answer){b.classList.add("correct");quizScore++}else{b.classList.add("wrong");quizBox.querySelectorAll(".option")[item.answer].classList.add("correct")}setTimeout(()=>{quizIndex++;renderQuestion()},650)};quizBox.appendChild(b)})}

function renderProgress(){completedLessons.textContent=state.completedLessons.length;totalCards.textContent=state.cards.length;masteredCards.textContent=state.cards.filter(c=>(c.mastery||0)>=3).length;bestScore.textContent=(state.quizHistory.length?Math.max(...state.quizHistory.map(x=>x.score)):0)+"%";historyList.innerHTML=state.quizHistory.length?state.quizHistory.map(h=>`<div class="history-item"><span>${h.date}</span><strong>${h.score}%</strong></div>`).join(""):"<p class='muted'>Тесты пока не пройдены.</p>"}
exportBtn.onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`medbio-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)};
importInput.onchange=async e=>{try{const data=JSON.parse(await e.target.files[0].text());if(!data.cards)throw 0;state={...defaults,...data};save();renderAll();alert("Данные восстановлены.")}catch{alert("Не удалось прочитать резервную копию.")}};
resetBtn.onclick=()=>{if(confirm("Удалить весь прогресс?")){localStorage.removeItem(STORAGE_KEY);state=structuredClone(defaults);save();renderAll()}};
function renderAll(){renderHome();renderLessons();buildDeck();renderProgress()}
if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js");
renderAll();
