(function(){
"use strict";

const STYLE_PROMPTS={
  brand:"СТИЛЬ: от лица бренда, первое лицо множественного числа (мы, наша платформа, у нас). Никогда «казино предлагает», всегда «мы предлагаем».",
  expert:"СТИЛЬ: от эксперта, первое лицо единственного числа (я протестировал, по моему опыту, я рекомендую).",
  team:"СТИЛЬ: от команды (наша команда проверила, мы протестировали, наша редакция рекомендует).",
  player:"СТИЛЬ: от игрока, личный опыт и впечатления (я играл, мне понравилось, я зарегистрировался).",
  third:"СТИЛЬ: третье лицо, нейтрально и объективно (казино предлагает, платформа обеспечивает, игроки могут). Без «мы» и «я»."
};
const TONES={neutral:"нейтральный, информативный",formal:"формальный, деловой",casual:"разговорный, дружелюбный",selling:"продающий, с CTA и выгодами",expert:"экспертный, аналитический, с данными"};

function $(id){return document.getElementById(id)}
function val(id,def){const el=$(id);return el?el.value:def}
function checked(id,def){const el=$(id);return el?el.checked:def}

function rulesFromUI(){
  return Object.assign({},AWP.DEFAULT_RULES,{
    chapterMode:checked("awp-chapter-mode",true),
    maxFixRounds:parseInt(val("awp-fix-rounds","2"))||0,
    brandName:val("awp-brand","").trim(),
    keysCountHeadings:checked("awp-keys-headings",false),
    strongPerParagraph:parseInt(val("awp-strong","1")),
    keysMaxPerParagraph:parseInt(val("awp-keys-per-para","1")),
    wordsMin:parseInt(val("awp-words-min","0"))||0,
    wordsMax:parseInt(val("awp-words-max","0"))||0,
    structureStrict:checked("awp-structure",true),
    bannedWords:checked("awp-banned",true)
  });
}

function buildCtx(){
  const rules=rulesFromUI();
  const lang=(typeof LANGS!=="undefined"&&LANGS.find(l=>l.c===val("lang","")))?.n||val("lang","");
  return{
    topic:val("topic",""),
    lang,
    country:val("country",""),
    currency:val("currency",""),
    license:val("license","")==="Не вставлять информацию о лицензии"?"не упоминать":val("license",""),
    tone:TONES[val("tone","neutral")]||"нейтральный",
    stylePrompt:STYLE_PROMPTS[typeof selectedStyle!=="undefined"?selectedStyle:"third"]||STYLE_PROMPTS.third,
    chapters:(typeof chapters!=="undefined"?chapters:[]).map(c=>({heading:c.heading,title:c.title,structure:c.structure})),
    keywords:(typeof keywords!=="undefined"?keywords:[]).map(k=>({word:k.word,count:k.count})),
    lsi:typeof lsiWords!=="undefined"?lsiWords.slice():[],
    source:val("source",""),
    notes:val("notes",""),
    filesPrompt:typeof getFilesPrompt==="function"?getFilesPrompt():"",
    ctaButtons:typeof ctaButtons!=="undefined"?ctaButtons.slice():[],
    rules
  };
}

function setOverlay(title,sub){const t=$("overlay-title"),s=$("overlay-sub");if(t&&title)t.textContent=title;if(s&&sub)s.textContent=sub}

async function generateSmart(){
  const rules=rulesFromUI();
  if(!rules.chapterMode||!(typeof chapters!=="undefined"&&chapters.length)){return generate()}
  const overlay=$("overlay"),errBox=$("error-box");
  errBox&&errBox.classList.add("hidden");
  const p=typeof PROVIDERS!=="undefined"?PROVIDERS.find(x=>x.id===selectedProvider):null;
  setOverlay("Поглавная генерация...","Подготовка плана");
  const pv=$("overlay-provider");if(pv)pv.textContent=`${p?p.n:""} • ${val("model-select","")}`;
  overlay.classList.remove("hidden");
  try{
    const ctx=buildCtx();
    const result=await AWP.generateByChapters(ctx,prompt=>callAI(prompt),ev=>{
      if(ev.stage==="write")setOverlay(`Глава ${ev.chapter+1} из ${ev.total}`,`Пишу: ${ev.title}`);
      if(ev.stage==="fix")setOverlay(`Глава ${ev.chapter+1} из ${ev.total}`,`Правка ${ev.round}: ${ev.issues.filter(i=>i.severity==="error").length} ошибок`);
      if(ev.stage==="global")setOverlay("Сборка статьи","Проверяю ключи по всей статье");
      if(ev.stage==="globalfix")setOverlay("Сборка статьи",`Довожу ключи: ${ev.deltas.map(d=>`${d.word} ${d.delta>0?"+":""}${d.delta}`).join(", ")}`);
    });
    generatedCode=result.code;
    if(typeof enableOutputTabs==="function")enableOutputTabs();
    lastGenProv=selectedProvider;lastGenModel=val("model-select","");
    if(typeof addArticleToHistory==="function")addArticleToHistory(val("topic",""),selectedProvider,lastGenModel,result.code);
    overlay.classList.add("hidden");
    switchTab("split",null);
    renderValidation(result.validation,result.report);
  }catch(e){
    overlay.classList.add("hidden");
    if(errBox){errBox.textContent="⚠ "+e.message;errBox.classList.remove("hidden")}else alert("⚠ "+e.message);
  }
}

function currentCode(){const a=$("split-area");return (a&&a.value)||generatedCode||""}
function setCode(code){generatedCode=code;const a=$("split-area"),c=$("code-area");if(a){a.value=code;if(typeof updateSplitLines==="function")updateSplitLines();if(typeof updateSplitPreview==="function")updateSplitPreview()}if(c){c.value=code;if(typeof updateLines==="function")updateLines()}}

function runValidator(){
  const code=currentCode();
  if(!code){alert("Сначала сгенерируйте или вставьте статью");return}
  const ctx=buildCtx();
  const res=AWP.validate(code,Object.assign({},ctx.rules,{keywords:ctx.keywords,chapters:ctx.chapters}));
  renderValidation(res,null);
}

function renderValidation(res,report){
  const panel=$("awp-panel"),out=$("awp-results");
  if(!panel||!out)return;
  panel.classList.remove("hidden");
  const color=res.score>=85?"#22c55e":res.score>=60?"#f59e0b":"#ef4444";
  let h=`<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
    <div style="font-size:26px;font-weight:800;color:${color}">${res.score}</div>
    <div style="font-size:12px;color:#94a3b8">${res.totalWords} слов • ошибок ${res.errors} • предупреждений ${res.warnings}</div>
    <div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">
      <button class="btn btn-sm" onclick="AWP_UI.applyAutofix()">🧹 Автофикс</button>
      <button class="btn btn-sm" onclick="AWP_UI.fixWithAI()" style="background:#a855f7;color:#fff">🤖 Исправить через AI</button>
      <button class="btn btn-sm" onclick="AWP_UI.runValidator()" style="background:#1e293b;color:#e2e8f0">↻ Проверить снова</button>
    </div></div>`;
  if(res.keyStats.length){
    h+=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:4px;margin-bottom:8px">`;
    res.keyStats.forEach(k=>{const ok=k.standalone===k.need;h+=`<div style="padding:6px 8px;border-radius:6px;background:${ok?"rgba(34,197,94,.08)":"rgba(239,68,68,.1)"};border:1px solid ${ok?"rgba(34,197,94,.3)":"rgba(239,68,68,.3)"};font-size:12px"><b>${k.word}</b> <span style="float:right;color:${ok?"#22c55e":"#fca5a5"}">${k.standalone}/${k.need}</span>${k.nested?`<div style="font-size:10px;color:#64748b">+${k.nested} внутри длинных ключей</div>`:""}${k.inHead?`<div style="font-size:10px;color:#64748b">в заголовках: ${k.inHead}</div>`:""}</div>`});
    h+=`</div>`;
  }
  if(!res.issues.length)h+=`<div style="color:#22c55e;font-size:13px">Нарушений не найдено.</div>`;
  else{
    h+=`<div style="display:flex;flex-direction:column;gap:3px">`;
    res.issues.forEach(i=>{
      const c=i.severity==="error"?"#fca5a5":"#fcd34d";
      h+=`<div onclick="AWP_UI.jumpTo(${i.blockIndex===null?-1:i.blockIndex})" style="display:flex;gap:8px;align-items:flex-start;padding:6px 8px;border-radius:6px;background:#0a1220;border:1px solid #1e293b;font-size:12px;cursor:${i.blockIndex===null?"default":"pointer"}">
        <span style="color:${c};font-weight:700;min-width:50px">${i.severity==="error"?"ошибка":"совет"}</span>
        <span style="flex:1;color:#e2e8f0">${i.message}${i.snippet?`<div style="color:#64748b;font-size:11px;margin-top:2px">${escapeHtml(i.snippet)}…</div>`:""}</span>
        ${i.autofix?`<span style="font-size:10px;color:#22d3ee">авто</span>`:""}
      </div>`;
    });
    h+=`</div>`;
  }
  if(report&&report.length){
    h+=`<details style="margin-top:8px;font-size:11px;color:#94a3b8"><summary style="cursor:pointer">Журнал по главам</summary>`+report.map(r=>`<div style="padding:3px 0">${escapeHtml(r.chapter)}: правок ${r.rounds}, осталось замечаний ${r.remaining.length}</div>`).join("")+`</details>`;
  }
  out.innerHTML=h;
  panel.dataset.blocks=JSON.stringify(res.blocks.map(b=>[b.start,b.end]));
}

function escapeHtml(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}

function jumpTo(blockIndex){
  if(blockIndex<0)return;
  const panel=$("awp-panel"),a=$("split-area");
  if(!panel||!a)return;
  let spans=[];try{spans=JSON.parse(panel.dataset.blocks||"[]")}catch(e){}
  const sp=spans[blockIndex];if(!sp)return;
  a.focus();a.setSelectionRange(sp[0],sp[1]);
  const lines=a.value.slice(0,sp[0]).split("\n").length;
  const lh=parseFloat(getComputedStyle(a).lineHeight)||18;
  a.scrollTop=Math.max(0,(lines-3)*lh);
}

function applyAutofix(){
  const code=currentCode();if(!code)return;
  const r=AWP.autofix(code,rulesFromUI());
  setCode(r.code);
  runValidator();
  if(r.log.length)alert("Автофикс:\n• "+r.log.join("\n• "));else alert("Автофикс: нечего исправлять детерминированно");
}

async function fixWithAI(){
  const code=currentCode();if(!code){alert("Нет статьи");return}
  const ctx=buildCtx();
  const cfg=Object.assign({},ctx.rules,{keywords:ctx.keywords,chapters:ctx.chapters});
  let article=AWP.autofix(code,cfg).code;
  let res=AWP.validate(article,cfg);
  if(!res.errors){alert("Ошибок нет, править нечего. Предупреждения AI не трогает.");renderValidation(res,null);return}
  const overlay=$("overlay");setOverlay("Правка через AI...","Собираю проблемные главы");overlay.classList.remove("hidden");
  try{
    const secs=AWP.sections(res.blocks).filter(s=>s.heading);
    const byIndex=new Map();
    res.issues.filter(i=>i.severity==="error"&&i.blockIndex!==null).forEach(i=>{
      const s=secs.find(x=>{const last=x.blocks.length?x.blocks[x.blocks.length-1]:x.heading;return i.blockIndex>=x.heading.index&&i.blockIndex<=last.index});
      if(!s)return;const k=s.heading.index;if(!byIndex.has(k))byIndex.set(k,{sec:s,issues:[]});byIndex.get(k).issues.push(i);
    });
    const targets=[...byIndex.values()].sort((a,b)=>b.sec.heading.start-a.sec.heading.start);
    let n=0;
    for(const t of targets){
      n++;setOverlay("Правка через AI...",`Глава ${n} из ${targets.length}: ${t.sec.heading.text}`);
      const last=t.sec.blocks.length?t.sec.blocks[t.sec.blocks.length-1]:t.sec.heading;
      const start=t.sec.heading.start,end=last.end;
      const secHtml=article.slice(start,end);
      const chapter=ctx.chapters.find(c=>AWP.stripTags(c.title).toLowerCase()===t.sec.heading.text.toLowerCase())||null;
      const planHere=ctx.keywords.filter(k=>AWP.countPhrase(AWP.stripTags(secHtml),k.word)>0).map(k=>({word:k.word,count:AWP.countPhrase(AWP.stripTags(secHtml),k.word)}));
      const fixed=AWP.autofix(AWP.cleanModelOutput(await callAI(AWP.buildFixPrompt(ctx,secHtml,t.issues,chapter,planHere))),cfg).code;
      if(fixed.includes("wp:heading"))article=article.slice(0,start)+fixed+article.slice(end);
    }
    const globalIssues=res.issues.filter(i=>i.severity==="error"&&i.blockIndex===null&&i.rule==="keyCount");
    if(globalIssues.length){
      const r1=AWP.validate(article,cfg);
      const deltas=r1.keyStats.map(k=>({word:k.word,delta:k.need-k.standalone})).filter(d=>d.delta!==0);
      if(deltas.length){
        setOverlay("Правка через AI...","Довожу количество ключей");
        const secs2=AWP.sections(r1.blocks).filter(s=>s.heading&&s.heading.level>1).sort((a,b)=>b.blocks.filter(x=>x.kind==="paragraph").length-a.blocks.filter(x=>x.kind==="paragraph").length);
        const s=secs2[0];
        if(s){const last=s.blocks.length?s.blocks[s.blocks.length-1]:s.heading;const start=s.heading.start,end=last.end;
          const fixed=AWP.autofix(AWP.cleanModelOutput(await callAI(AWP.buildGlobalFixPrompt(ctx,article.slice(start,end),deltas))),cfg).code;
          if(fixed.includes("wp:heading"))article=article.slice(0,start)+fixed+article.slice(end)}
      }
    }
    setCode(article);
    overlay.classList.add("hidden");
    runValidator();
  }catch(e){overlay.classList.add("hidden");alert("⚠ "+e.message)}
}

function injectUI(){
  const genBtn=$("gen-btn");
  if(genBtn&&!$("awp-settings")){
    const sec=document.createElement("div");
    sec.className="sec";sec.id="awp-settings";
    sec.innerHTML=`<div class="sec-title">🧪 Конвейер и валидатор</div>
      <div style="display:flex;flex-direction:column;gap:6px;font-size:12px">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="awp-chapter-mode" checked> Поглавная генерация с проверкой и правкой каждой главы</label>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:6px">
          <div><div style="font-size:10px;color:#64748b">Циклов правки на главу</div><select id="awp-fix-rounds"><option>0</option><option>1</option><option selected>2</option><option>3</option></select></div>
          <div><div style="font-size:10px;color:#64748b">&lt;strong&gt; на абзац</div><select id="awp-strong"><option>0</option><option selected>1</option><option>2</option></select></div>
          <div><div style="font-size:10px;color:#64748b">Ключей на абзац (макс.)</div><select id="awp-keys-per-para"><option selected>1</option><option>2</option><option>3</option></select></div>
          <div><div style="font-size:10px;color:#64748b">Бренд (для лимита 1/абзац)</div><input type="text" id="awp-brand" placeholder="LikesBet"></div>
          <div><div style="font-size:10px;color:#64748b">Слов мин.</div><input type="number" id="awp-words-min" placeholder="1200"></div>
          <div><div style="font-size:10px;color:#64748b">Слов макс.</div><input type="number" id="awp-words-max" placeholder="1500"></div>
        </div>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="awp-structure" checked> Строго проверять структуру глав (P / P+T+P / P+L+P …)</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="awp-keys-headings"> Считать ключи в заголовках</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="awp-banned" checked> Проверять стоп-слова</label>
      </div>`;
    genBtn.parentNode.insertBefore(sec,genBtn);
    genBtn.setAttribute("onclick","AWP_UI.generateSmart()");
  }
  const split=$("page-split");
  if(split&&!$("awp-panel")){
    const bar=split.querySelector("div");
    if(bar){const b=document.createElement("button");b.className="btn btn-sm";b.textContent="✅ Валидатор";b.style.background="#10b981";b.style.color="#0f172a";b.setAttribute("onclick","AWP_UI.runValidator()");bar.insertBefore(b,bar.children[1]||null)}
    const panel=document.createElement("div");panel.id="awp-panel";panel.className="hidden";panel.style.marginBottom="10px";
    panel.innerHTML=`<div class="sec" style="padding:10px"><div class="sec-title" style="display:flex;justify-content:space-between;align-items:center">✅ Валидатор <button onclick="document.getElementById('awp-panel').classList.add('hidden')" style="background:none;border:none;color:#64748b;cursor:pointer">✕</button></div><div id="awp-results"></div></div>`;
    const seo=$("seo-panel");
    if(seo)seo.parentNode.insertBefore(panel,seo);else split.insertBefore(panel,split.children[1]||null);
  }
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",injectUI);else injectUI();
window.AWP_UI={generateSmart,runValidator,applyAutofix,fixWithAI,jumpTo,buildCtx,rulesFromUI};
})();
