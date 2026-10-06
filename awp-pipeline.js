(function(global){
"use strict";

const DEFAULT_RULES={
  keysExact:true,
  keysCountHeadings:false,
  keysMaxPerParagraph:1,
  keysNotAtParagraphStart:true,
  keysNotAtParagraphEnd:false,
  strongPerParagraph:1,
  strongNotOnKey:true,
  strongNotAtEnd:true,
  strongNotInLists:true,
  noEmDash:true,
  bannedWords:true,
  brandMaxPerParagraph:1,
  brandName:"",
  noImageAfterHeading:true,
  maxHowTo:1,
  noThead:true,
  noTh:true,
  tableNoStrong:false,
  paragraphMaxChars:0,
  paragraphMinWords:0,
  uniqueParagraphOpenings:true,
  openingWords:2,
  maxParagraphsInRow:2,
  structureStrict:true,
  noEmptyHeadingPairs:true,
  wordsMin:0,
  wordsMax:0,
  maxFixRounds:2,
  chapterMode:true,
  bannedList:["additionally","amplify","archetypal","avail","augment","at the heart of","blend","bolster","boost","catalyst","catalyze","catering","centerpiece","certainly","cohesive","cohesion","conclusion","confluence","conceptualize","comprehensive","core","crucial","culmination","delve","dive","dive into","delve into","digital bazaar","double-edged sword","dynamics","elevate","elucidate","encompass","envisage","emanate","embark","embodiment","embody","ensure","ensuring","epitomize","essence","in essence","esteemed","evoke","evolve","exemplify","extrapolate","facet","facilitating","fusion","groundbreaking","guide","harness","harnessing","harmony","holistic","infuse","inherent","illuminate","immanent","impetus","implications","inflection","instigate","thrill","thrilling","offering","overall","however","iterations","integration","intricacies","intrinsic","landscape","leverage","luminaries","manifestation","meticulous","moreover","mosaic","myriad","navigate","nestled","nuance","paradigm","pinnacle","prerequisite","quintessential","realm","reinforce","remember","resilience","reverberate","resonate","seamlessly","synergy","synthesize","symbiosis","substantiate","subtlety","tapestry","top notch","transformative","underlying","understanding","unify","unity","unlock","unrivaled","unveil","unveiling","unravel","available","smooth experience","smooth gameplay","smoother gameplay","smooth game experience","fast-paced gameplay","immersive","seamless","robust","cutting-edge","state-of-the-art","top-tier","unbeatable","unparalleled","unforgettable","unleash","user-friendly","world-class"],
  bannedPhrases:["discover the ultimate","welcome to the comprehensive guide","explore the exhilarating realm","join the excitement","this section will","this article will","this subsection will","this guide is designed to","section is dedicated","in the following sections","dive into the thrilling","continue enjoying the thrill","it is important to note","it is worth noting","the best part?","the result?"]
};

const STRUCT_MAP={p:["paragraph"],pp:["paragraph","paragraph"],pt:["paragraph","table"],ptp:["paragraph","table","paragraph"],plp:["paragraph","list","paragraph"],pl:["paragraph","list"],ph:["paragraph","html","paragraph"],ptptp:["paragraph","table","paragraph","table","paragraph"],ptpl:["paragraph","table","paragraph","list"],h:["html"]};
const STRUCT_PARAGRAPHS={p:1,pp:2,pt:1,ptp:2,plp:2,pl:1,ph:2,ptptp:3,ptpl:2,h:0};

const ENT={amp:"&",lt:"<",gt:">",quot:'"',apos:"'",nbsp:" ",hellip:"…",mdash:"—",ndash:"–",laquo:"«",raquo:"»",euro:"€",pound:"£",copy:"©",reg:"®",trade:"™"};
function decode(s){return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi,(m,e)=>{if(e[0]==="#"){const n=e[1].toLowerCase()==="x"?parseInt(e.slice(2),16):parseInt(e.slice(1),10);return isNaN(n)?m:String.fromCodePoint(n)}return ENT[e.toLowerCase()]!==undefined?ENT[e.toLowerCase()]:m})}
function stripTags(html){return decode(html.replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<!--[\s\S]*?-->/g," ").replace(/<br\s*\/?>/gi," ").replace(/<\/(p|li|td|th|tr|h[1-6]|div)>/gi," ").replace(/<[^>]+>/g," ")).replace(/\s+/g," ").trim()}
function words(t){return (t.match(/[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu)||[])}
function esc(s){return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}
function phraseRe(ph){return new RegExp("(^|[^\\p{L}\\p{N}])("+esc(ph.trim()).replace(/\s+/g,"\\s+")+")(?=$|[^\\p{L}\\p{N}])","giu")}
function countPhrase(text,ph){const re=phraseRe(ph);let n=0;while(re.exec(text))n++;return n}
function norm(s){return stripTags(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim()}

function parseBlocks(code){
  const re=/<!--\s*(\/)?wp:([a-z0-9][a-z0-9\/-]*)(\s+(\{[\s\S]*?\}))?\s*(\/)?-->/gi;
  const blocks=[];const stack=[];let m;
  while((m=re.exec(code))){
    const closing=!!m[1],name=m[2].replace(/^core\//,""),selfClosing=!!m[5];
    if(closing){
      const open=stack.pop();
      if(!open)continue;
      open.end=m.index+m[0].length;open.inner=code.slice(open.innerStart,m.index);
      if(!stack.length){open.raw=code.slice(open.start,open.end);blocks.push(open)}
      continue;
    }
    const b={name,start:m.index,innerStart:m.index+m[0].length,attrs:null};
    if(m[4]){try{b.attrs=JSON.parse(m[4])}catch(e){b.attrs=null}}
    if(selfClosing){b.end=b.innerStart;b.inner="";b.raw=m[0];if(!stack.length)blocks.push(b);continue}
    stack.push(b);
  }
  blocks.forEach((b,i)=>{
    b.index=i;
    b.text=stripTags(b.inner||"");
    if(b.name==="heading"){const h=b.inner.match(/<h([1-6])/i);b.level=h?parseInt(h[1]):(b.attrs&&b.attrs.level)||2}
    b.kind=classify(b);
  });
  return blocks;
}
function classify(b){
  if(b.name==="heading")return"heading";
  if(b.name==="paragraph")return"paragraph";
  if(b.name==="list")return"list";
  if(b.name==="table")return"table";
  if(b.name==="image")return"image";
  if(b.name==="buttons"||b.name==="button")return"buttons";
  if(b.name==="shortcode")return"shortcode";
  if(/how-to/.test(b.name))return"howto";
  if(b.name==="html"){if(/<table[\s>]/i.test(b.inner))return"table";if(/wp-block-button/i.test(b.inner)&&!/<table|<ul|<ol/i.test(b.inner))return"buttons";return"html"}
  if(/faq/.test(b.name))return"faq";
  return b.name;
}

function sections(blocks){
  const out=[];let cur={heading:null,blocks:[]};
  blocks.forEach(b=>{if(b.kind==="heading"){if(cur.heading||cur.blocks.length)out.push(cur);cur={heading:b,blocks:[]}}else cur.blocks.push(b)});
  if(cur.heading||cur.blocks.length)out.push(cur);
  return out;
}

function paragraphInfo(b,cfg){
  const inner=b.inner.replace(/^\s*<p[^>]*>/i,"").replace(/<\/p>\s*$/i,"");
  const noLinks=inner.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi,"");
  const strongs=[...noLinks.matchAll(/<strong>([\s\S]*?)<\/strong>/gi)].map(x=>stripTags(x[1]));
  const text=stripTags(inner);
  const endsWithStrong=/<\/strong>\s*[.!?…»")]*\s*$/i.test(inner);
  return{text,strongs,endsWithStrong,wordCount:words(text).length,charCount:text.length};
}

function validate(code,opts){
  const cfg=Object.assign({},DEFAULT_RULES,opts||{});
  const keywords=(cfg.keywords||[]).filter(k=>k&&k.word);
  const chapters=cfg.chapters||[];
  const issues=[];
  const add=(rule,severity,message,block,extra)=>issues.push(Object.assign({rule,severity,message,blockIndex:block?block.index:null},extra||{}));
  const blocks=parseBlocks(code);
  const secs=sections(blocks);
  const paras=blocks.filter(b=>b.kind==="paragraph");
  const bodyBlocks=blocks.filter(b=>b.kind!=="heading");
  const bodyText=bodyBlocks.map(b=>b.text).join(" \n ");
  const headText=blocks.filter(b=>b.kind==="heading").map(b=>b.text).join(" \n ");
  const allText=bodyText+" \n "+headText;
  const totalWords=words(allText).length;

  if(cfg.noEmptyHeadingPairs&&/<!--\s*wp:heading[^>]*-->\s*<!--\s*\/wp:heading\s*-->/i.test(code))add("emptyHeading","error","Пустые пары <!-- wp:heading --> без содержимого",null,{autofix:true});
  if(cfg.noEmDash){const n=(code.match(/[—–]/g)||[]).length;if(n)add("emDash","error",`Длинное тире найдено ${n} раз`,null,{autofix:true})}
  if(cfg.noThead&&/<thead/i.test(code))add("thead","error","В таблице есть <thead>",null,{autofix:true});
  if(cfg.noTh&&/<th[\s>]/i.test(code))add("th","error","В таблице есть <th>, нужны <td>",null,{autofix:true});
  if(cfg.wordsMin&&totalWords<cfg.wordsMin)add("wordsMin","warn",`Объём ${totalWords} слов, минимум ${cfg.wordsMin}`,null);
  if(cfg.wordsMax&&totalWords>cfg.wordsMax)add("wordsMax","warn",`Объём ${totalWords} слов, максимум ${cfg.wordsMax}`,null);
  const howto=blocks.filter(b=>b.kind==="howto").length;
  if(cfg.maxHowTo>=0&&howto>cfg.maxHowTo)add("howto","error",`How-To блоков: ${howto}, допустимо ${cfg.maxHowTo}`,null);

  const keyStats=[];
  const lowerKeys=keywords.map(k=>k.word.toLowerCase());
  keywords.forEach((k,ki)=>{
    const raw=countPhrase(cfg.keysCountHeadings?allText:bodyText,k.word);
    let nested=0;
    lowerKeys.forEach((o,oi)=>{if(oi!==ki&&o.length>k.word.length&&countPhrase(o,k.word)>0)nested+=countPhrase(cfg.keysCountHeadings?allText:bodyText,o)});
    const standalone=raw-nested;
    const inHead=countPhrase(headText,k.word);
    keyStats.push({word:k.word,need:k.count,raw,nested,standalone,inHead});
    const have=cfg.keysExact?standalone:raw;
    if(have!==k.count)add("keyCount",have<k.count?"error":"warn",`Ключ "${k.word}": ${have} из ${k.count}${nested?` (ещё ${nested} внутри более длинных ключей)`:""}${inHead&&!cfg.keysCountHeadings?`, в заголовках ${inHead} не учтено`:""}`,null,{keyword:k.word,have,need:k.count});
  });

  const openings=new Map();
  const brand=(cfg.brandName||"").trim();
  paras.forEach(b=>{
    const info=paragraphInfo(b,cfg);
    const t=info.text;
    const low=t.toLowerCase();
    if(cfg.strongPerParagraph>=0&&info.strongs.length!==cfg.strongPerParagraph)add("strongCount",info.strongs.length>cfg.strongPerParagraph?"error":"warn",`Абзац: выделений <strong> ${info.strongs.length}, нужно ${cfg.strongPerParagraph}`,b,{snippet:t.slice(0,80)});
    if(cfg.strongNotAtEnd&&info.endsWithStrong)add("strongEnd","warn","Выделение стоит в конце абзаца",b,{snippet:t.slice(-80)});
    if(cfg.strongNotOnKey)info.strongs.forEach(s=>{lowerKeys.forEach(k=>{if(s.toLowerCase().includes(k)||k.includes(s.toLowerCase()))add("strongKey","error",`Выделен ключ или его часть: "${s}"`,b)})});
    let keysHere=0;
    keywords.forEach((k,ki)=>{
      const c=countPhrase(t,k.word);
      if(!c)return;
      let nestedHere=0;
      lowerKeys.forEach((o,oi)=>{if(oi!==ki&&o.length>k.word.length&&countPhrase(o,k.word)>0)nestedHere+=countPhrase(t,o)});
      keysHere+=Math.max(0,c-nestedHere);
      if(cfg.keysNotAtParagraphStart&&new RegExp("^[^\\p{L}\\p{N}]*"+esc(k.word).replace(/\s+/g,"\\s+")+"(?=$|[^\\p{L}\\p{N}])","iu").test(t))add("keyStart","error",`Абзац начинается с ключа "${k.word}"`,b,{snippet:t.slice(0,80)});
      if(cfg.keysNotAtParagraphEnd&&new RegExp("(^|[^\\p{L}\\p{N}])"+esc(k.word).replace(/\s+/g,"\\s+")+"[^\\p{L}\\p{N}]*$","iu").test(t))add("keyEnd","warn",`Абзац заканчивается ключом "${k.word}"`,b);
    });
    if(cfg.keysMaxPerParagraph&&keysHere>cfg.keysMaxPerParagraph)add("keyDensity","warn",`В абзаце ${keysHere} ключей, допустимо ${cfg.keysMaxPerParagraph}`,b,{snippet:t.slice(0,80)});
    if(brand&&cfg.brandMaxPerParagraph){const bc=countPhrase(t,brand);if(bc>cfg.brandMaxPerParagraph)add("brand","warn",`Бренд "${brand}" упомянут ${bc} раз в одном абзаце`,b,{snippet:t.slice(0,80)})}
    if(cfg.paragraphMaxChars&&info.charCount>cfg.paragraphMaxChars)add("paraLong","warn",`Абзац ${info.charCount} символов, максимум ${cfg.paragraphMaxChars}`,b,{snippet:t.slice(0,80)});
    if(cfg.paragraphMinWords&&info.wordCount<cfg.paragraphMinWords&&info.wordCount>0)add("paraShort","warn",`Абзац ${info.wordCount} слов, минимум ${cfg.paragraphMinWords}`,b,{snippet:t.slice(0,80)});
    if(cfg.uniqueParagraphOpenings){const op=words(low).slice(0,cfg.openingWords).join(" ");if(op){if(openings.has(op))add("opening","warn",`Два абзаца начинаются одинаково: "${op}"`,b,{snippet:t.slice(0,80)});else openings.set(op,b.index)}}
  });

  if(cfg.strongNotInLists)blocks.filter(b=>b.kind==="list").forEach(b=>{const inner=b.inner.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi,"");if(/<strong>/i.test(inner))add("strongList","warn","В списке есть <strong>",b,{autofix:true})});
  if(cfg.tableNoStrong)blocks.filter(b=>b.kind==="table").forEach(b=>{if(/<strong>|<b>|<em>/i.test(b.inner))add("tableStrong","warn","Внутри таблицы есть выделения",b,{autofix:true})});

  if(cfg.bannedWords){
    const low=allText.toLowerCase();
    const hits=[];
    (cfg.bannedList||[]).forEach(w=>{const c=countPhrase(low,w);if(c)hits.push(`${w}×${c}`)});
    (cfg.bannedPhrases||[]).forEach(w=>{if(low.includes(w))hits.push(`"${w}"`)});
    if(hits.length)add("banned","error","Стоп-слова: "+hits.join(", "),null,{hits});
  }

  secs.forEach((s,si)=>{
    const kinds=s.blocks.map(b=>b.kind);
    if(cfg.noImageAfterHeading&&s.heading&&kinds[0]==="image")add("imgAfterHeading","warn","Картинка стоит сразу после заголовка",s.blocks[0]);
    let run=0;
    s.blocks.forEach(b=>{if(b.kind==="paragraph"){run++;if(cfg.maxParagraphsInRow&&run>cfg.maxParagraphsInRow)add("paraRow","warn",`${run} абзаца подряд под одним заголовком`,b)}else if(b.kind!=="image"&&b.kind!=="buttons"&&b.kind!=="shortcode")run=0});
  });

  if(chapters.length){
    const heads=blocks.filter(b=>b.kind==="heading");
    const used=new Set();
    chapters.forEach((ch,ci)=>{
      const want=norm(ch.title);
      let found=null;
      heads.forEach(h=>{if(found||used.has(h.index))return;const got=norm(h.inner);if(got===want||got.includes(want)||want.includes(got))found=h});
      if(!found){add("chapterMissing","error",`Глава "${ch.title}" не найдена`,null,{chapter:ci});return}
      used.add(found.index);
      const lvl=parseInt(String(ch.heading).replace(/\D/g,""))||2;
      if(found.level!==lvl)add("chapterLevel","error",`Глава "${ch.title}": уровень H${found.level}, нужен H${lvl}`,found,{chapter:ci});
      if(cfg.structureStrict&&ch.structure&&STRUCT_MAP[ch.structure]){
        const sec=secs.find(x=>x.heading&&x.heading.index===found.index);
        const got=sec?sec.blocks.map(b=>b.kind).filter(k=>!["image","buttons"].includes(k)).map(k=>["shortcode","howto","faq"].includes(k)?"html":k):[];
        const want2=STRUCT_MAP[ch.structure];
        if(got.join(",")!==want2.join(","))add("structure","error",`Глава "${ch.title}": структура ${got.join("+")||"пусто"}, нужно ${want2.join("+")}`,found,{chapter:ci,got,want:want2});
      }
    });
    heads.forEach(h=>{if(!used.has(h.index)&&h.level>1)add("headingExtra","warn",`Лишний заголовок "${h.text}"`,h)});
  }

  const errors=issues.filter(i=>i.severity==="error").length;
  const score=Math.max(0,100-errors*8-(issues.length-errors)*3);
  return{issues,keyStats,totalWords,blocks,sections:secs,score,errors,warnings:issues.length-errors};
}

function autofix(code,opts){
  const cfg=Object.assign({},DEFAULT_RULES,opts||{});
  let c=code;
  const log=[];
  if(cfg.noEmptyHeadingPairs){const before=c;c=c.replace(/<!--\s*wp:heading[^>]*-->\s*<!--\s*\/wp:heading\s*-->\s*/gi,"");if(before!==c)log.push("Удалены пустые заголовки")}
  if(cfg.noEmDash){
    const before=c;
    c=c.replace(/\s*—\s*/g,(m)=>m.trim()?" - ":" - ").replace(/(\d)\s*–\s*(\d)/g,"$1-$2").replace(/\s*–\s*/g," - ");
    if(before!==c)log.push("Длинные тире заменены на дефис")
  }
  if(cfg.noThead){const before=c;c=c.replace(/<thead[^>]*>([\s\S]*?)<\/thead>\s*<tbody[^>]*>/gi,"<tbody>$1").replace(/<thead[^>]*>([\s\S]*?)<\/thead>/gi,"<tbody>$1</tbody>").replace(/<\/tbody>\s*<tbody>/gi,"");if(before!==c)log.push("thead объединён с tbody")}
  if(cfg.noTh){const before=c;c=c.replace(/<th(\s[^>]*)?>/gi,"<td$1>").replace(/<\/th>/gi,"</td>");if(before!==c)log.push("th заменены на td")}
  if(cfg.strongNotInLists){
    const before=c;
    c=c.replace(/(<!--\s*wp:list\b[\s\S]*?<!--\s*\/wp:list\s*-->)/gi,(blk)=>blk.replace(/<a\b[^>]*>[\s\S]*?<\/a>|<\/?strong>/gi,(m)=>m.startsWith("<a")?m:""));
    if(before!==c)log.push("Выделения в списках сняты")
  }
  if(cfg.tableNoStrong){const before=c;c=c.replace(/(<table[\s\S]*?<\/table>)/gi,t=>t.replace(/<\/?(strong|b|em)>/gi,""));if(before!==c)log.push("Выделения в таблицах сняты")}
  c=c.replace(/\n{3,}/g,"\n\n").trim();
  return{code:c,log};
}

function planKeywords(keywords,chapters){
  const caps=chapters.map(ch=>{const st=ch.structure||"p";const p=STRUCT_PARAGRAPHS[st]!==undefined?STRUCT_PARAGRAPHS[st]:1;const extra=(STRUCT_MAP[st]||[]).some(k=>k==="list"||k==="table")?1:0;return p+extra});
  const plan=chapters.map(()=>[]);
  const load=chapters.map(()=>0);
  let cursor=0;
  keywords.forEach(k=>{
    let left=k.count;let guard=0;
    while(left>0&&guard<chapters.length*4){
      const i=cursor%chapters.length;cursor++;guard++;
      if(caps[i]===0)continue;
      if(load[i]>=caps[i])continue;
      const slot=plan[i].find(x=>x.word===k.word);
      if(slot)slot.count++;else plan[i].push({word:k.word,count:1});
      load[i]++;left--;
    }
    let spill=0;
    while(left>0&&spill<chapters.length*8){
      const order=chapters.map((_,i)=>i).filter(i=>caps[i]>0).sort((a,b)=>(load[a]/caps[a])-(load[b]/caps[b]));
      const i=order[spill%order.length];spill++;
      if(i===undefined)break;
      const slot=plan[i].find(x=>x.word===k.word);
      if(slot)slot.count++;else plan[i].push({word:k.word,count:1});
      load[i]++;left--;
    }
  });
  return plan;
}

function issuesToText(issues){return issues.map((i,n)=>`${n+1}. ${i.message}${i.snippet?` (абзац: "${i.snippet}…")`:""}`).join("\n")}

function rulesText(cfg){
  const r=[];
  r.push(`Каждый абзац содержит ровно ${cfg.strongPerParagraph} выделение <strong> из 2-3 слов (желательно слово + число), не в конце абзаца и никогда на ключевом слове. Ссылки <a> всегда внутри <strong>, но за выделение не считаются.`);
  r.push("В списках и таблицах выделений <strong> нет.");
  r.push(`Ключевые слова: точное вхождение 1:1, без изменения окончаний. Не более ${cfg.keysMaxPerParagraph} ключа на абзац, ключ стоит в середине абзаца, абзац не начинается с ключа. Ключи в заголовках не считаются.`);
  if(cfg.brandName)r.push(`Название бренда "${cfg.brandName}" не чаще одного раза на абзац, остальные упоминания заменяй словами вроде "платформа", "оператор", "сайт" на языке статьи.`);
  r.push("Никаких длинных тире (— и –), только дефис или перестроенная фраза. Абзацы начинаются по-разному, не с ключа и не с одной и той же конструкции.");
  r.push("Таблицы: только <tbody> и <td>, первая строка с подписями колонок, без <thead>, <th> и выделений внутри.");
  r.push("Картинки никогда не стоят сразу после заголовка. Не более одного блока How-To на страницу.");
  r.push("Не выдумывай числа: используй только цифры из ТЗ, файлов и источника; если подтверждённого числа нет, обойдись без него.");
  r.push("Стоп-слова запрещены: "+(cfg.bannedList||[]).slice(0,60).join(", ")+" и шаблонные AI-фразы.");
  return r.map((x,i)=>`${i+1}. ${x}`).join("\n");
}

function gutenbergFormat(){
  return `ФОРМАТ: только Gutenberg-блоки WordPress, без \`\`\`, без <html>/<body>.
- Заголовок: <!-- wp:heading {"level":N} -->\\n<h N class="wp-block-heading">…</h N>\\n<!-- /wp:heading --> (для H2 атрибут level можно опустить)
- Абзац: <!-- wp:paragraph -->\\n<p>…</p>\\n<!-- /wp:paragraph -->
- Список: <!-- wp:list -->\\n<ul class="wp-block-list"><!-- wp:list-item -->\\n<li>…</li>\\n<!-- /wp:list-item --></ul>\\n<!-- /wp:list -->
- Таблица: <!-- wp:table {"hasFixedLayout":true} -->\\n<figure class="wp-block-table"><table class="has-fixed-layout"><tbody><tr><td>…</td></tr></tbody></table></figure>\\n<!-- /wp:table -->
- Кастомный HTML: <!-- wp:html -->\\n…\\n<!-- /wp:html --> (inline-стили и <style> только здесь)
Между блоками пустая строка.`;
}

function buildChapterPrompt(ctx,chapter,ci,plan,prevSummary){
  const lvl=parseInt(String(chapter.heading).replace(/\D/g,""))||2;
  const struct=STRUCT_MAP[chapter.structure]||["paragraph"];
  const structHuman=struct.map(k=>({paragraph:"абзац (<p>)",table:"таблица",list:"список (<ul> или <ol>)",html:"кастомный HTML-блок"}[k]||k)).join(" → ");
  const kw=plan.length?plan.map(k=>`- "${k.word}" — ровно ${k.count} раз(а)`).join("\n"):"в этой главе ключи не нужны";
  let p=`Ты пишешь ОДНУ главу SEO-статьи для WordPress. Статья целиком будет собрана из глав, поэтому пиши только свою главу и ничего больше.\n\n`;
  p+=`СТАТЬЯ: ${ctx.topic}\nЯзык: ${ctx.lang}. Страна: ${ctx.country}. Валюта: ${ctx.currency}. Лицензия: ${ctx.license}.\nТон: ${ctx.tone}.\n\n${ctx.stylePrompt}\n\n`;
  p+=`ПЛАН ВСЕЙ СТАТЬИ:\n${ctx.chapters.map((c,i)=>`${i+1}. ${c.heading}: ${c.title}${i===ci?"   <-- ТЫ ПИШЕШЬ ЭТУ ГЛАВУ":""}`).join("\n")}\n\n`;
  if(prevSummary)p+=`ЧТО УЖЕ НАПИСАНО В ПРЕДЫДУЩИХ ГЛАВАХ (не повторяй эти факты и формулировки):\n${prevSummary}\n\n`;
  p+=`ТВОЯ ГЛАВА:\nЗаголовок H${lvl}: "${chapter.title}"\nСтруктура СТРОГО: ${structHuman}\nПервое предложение главы прямо отвечает на заголовок.\n\nКЛЮЧИ ДЛЯ ЭТОЙ ГЛАВЫ (точное написание, считается только текст абзацев, списков и таблиц):\n${kw}\n`;
  if(ctx.lsi.length)p+=`LSI, если уместно: ${ctx.lsi.join(", ")}\n`;
  if(ctx.source)p+=`\nИСТОЧНИК ФАКТОВ: ${ctx.source}\n`;
  if(ctx.notes)p+=`\nТРЕБОВАНИЯ ЗАКАЗЧИКА: ${ctx.notes}\n`;
  if(ctx.filesPrompt)p+=ctx.filesPrompt+"\n";
  p+=`\nПРАВИЛА:\n${rulesText(ctx.rules)}\n\n${gutenbergFormat()}\n\nНачни сразу с <!-- wp:heading и закончи закрывающим комментарием последнего блока главы. Без вступлений и пояснений.`;
  return p;
}

function buildFixPrompt(ctx,chapterHtml,issues,chapter,plan){
  let p=`Ниже HTML одной главы SEO-статьи в формате Gutenberg. Исправь ТОЛЬКО перечисленные проблемы, остальной текст оставь без изменений. Верни полный HTML главы, начиная с <!-- wp:heading.\n\n`;
  p+=`Язык: ${ctx.lang}. ${ctx.stylePrompt.split("\n")[0]}\n\n`;
  if(chapter){const struct=STRUCT_MAP[chapter.structure]||["paragraph"];p+=`Структура главы должна остаться: ${struct.join(" → ")}.\n`}
  if(plan&&plan.length)p+=`Ключи в этой главе: ${plan.map(k=>`"${k.word}" ×${k.count}`).join(", ")} (точное написание, в середине абзаца, не в заголовке).\n`;
  p+=`\nПРОБЛЕМЫ:\n${issuesToText(issues)}\n\nПРАВИЛА:\n${rulesText(ctx.rules)}\n\nHTML ГЛАВЫ:\n${chapterHtml}`;
  return p;
}

function buildGlobalFixPrompt(ctx,chapterHtml,keyDeltas){
  const lines=keyDeltas.map(d=>d.delta>0?`- добавь ключ "${d.word}" ${d.delta} раз(а) в середину разных абзацев, естественно, без изменения окончаний`:`- убери ${-d.delta} вхождение(я) ключа "${d.word}", заменив его синонимом или местоимением`);
  return `Ниже HTML одной главы статьи (Gutenberg). Внеси только эти правки по ключевым словам и верни полный HTML главы:\n${lines.join("\n")}\n\nНе трогай заголовок, структуру блоков, выделения <strong> и остальной текст.\nЯзык: ${ctx.lang}.\n\nHTML ГЛАВЫ:\n${chapterHtml}`;
}

function accept(next,prev){
  if(next.issues.some(i=>i.rule==="chapterMissing"||i.rule==="structure")&&!prev.issues.some(i=>i.rule==="chapterMissing"||i.rule==="structure"))return false;
  return next.errors<=prev.errors;
}

function summarize(html,maxChars){
  const t=stripTags(html);
  if(t.length<=maxChars)return t;
  return t.slice(0,maxChars)+"…";
}

function cleanModelOutput(s){return (s||"").replace(/^```[a-z]*\s*/i,"").replace(/\s*```\s*$/i,"").trim()}

function extractChapterHtml(html){
  const i=html.search(/<!--\s*wp:heading/i);
  return i>=0?html.slice(i):html;
}

async function generateByChapters(ctx,callModel,onProgress){
  const cfg=Object.assign({},DEFAULT_RULES,ctx.rules||{});
  const chapters=ctx.chapters;
  const plan=planKeywords(ctx.keywords,chapters);
  const parts=[];
  const report=[];
  let prevSummary="";
  for(let ci=0;ci<chapters.length;ci++){
    const ch=chapters[ci];
    onProgress&&onProgress({stage:"write",chapter:ci,total:chapters.length,title:ch.title});
    let html=cleanModelOutput(await callModel(buildChapterPrompt(ctx,ch,ci,plan[ci],prevSummary)));
    html=extractChapterHtml(html);
    html=autofix(html,cfg).code;
    let res=validate(html,Object.assign({},cfg,{keywords:plan[ci],chapters:[ch],wordsMin:0,wordsMax:0,maxHowTo:cfg.maxHowTo}));
    let round=0;
    while(res.errors>0&&round<cfg.maxFixRounds){
      round++;
      onProgress&&onProgress({stage:"fix",chapter:ci,total:chapters.length,title:ch.title,round,issues:res.issues});
      const fixed=cleanModelOutput(await callModel(buildFixPrompt(ctx,html,res.issues.filter(i=>i.severity==="error"),ch,plan[ci])));
      const cand=autofix(extractChapterHtml(fixed),cfg).code;
      const r2=validate(cand,Object.assign({},cfg,{keywords:plan[ci],chapters:[ch],wordsMin:0,wordsMax:0}));
      if(accept(r2,res)){html=cand;res=r2}
    }
    report.push({chapter:ch.title,rounds:round,remaining:res.issues});
    parts.push(html);
    prevSummary=(prevSummary+"\n"+summarize(html,600)).slice(-2400);
  }
  let article=parts.join("\n\n");
  article=insertCta(article,ctx);
  onProgress&&onProgress({stage:"global",total:chapters.length});
  let full=validate(article,Object.assign({},cfg,{keywords:ctx.keywords,chapters}));
  const deltas=full.keyStats.map(k=>({word:k.word,delta:k.need-(cfg.keysExact?k.standalone:k.raw)})).filter(d=>d.delta!==0);
  if(deltas.length&&cfg.maxFixRounds>0){
    const blocks=parseBlocks(article);
    const secs=sections(blocks);
    const target=secs.filter(s=>s.heading&&s.heading.level>1).sort((a,b)=>b.blocks.filter(x=>x.kind==="paragraph").length-a.blocks.filter(x=>x.kind==="paragraph").length)[0];
    if(target){
      const start=target.heading.start;
      const last=target.blocks.length?target.blocks[target.blocks.length-1]:target.heading;
      const end=last.end;
      const secHtml=article.slice(start,end);
      onProgress&&onProgress({stage:"globalfix",deltas});
      const fixed=autofix(extractChapterHtml(cleanModelOutput(await callModel(buildGlobalFixPrompt(ctx,secHtml,deltas)))),cfg).code;
      const cand=article.slice(0,start)+fixed+article.slice(end);
      const r2=validate(cand,Object.assign({},cfg,{keywords:ctx.keywords,chapters}));
      if(accept(r2,full)){article=cand;full=r2}
    }
  }
  return{code:article,validation:full,report,plan};
}

function insertCta(article,ctx){
  const ctas=ctx.ctaButtons||[];
  if(!ctas.length)return article;
  const mk=b=>`<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} -->\n<div class="wp-block-buttons"><!-- wp:button -->\n<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="${b.url||"/visit/"}"><strong>${b.text}</strong></a></div>\n<!-- /wp:button --></div>\n<!-- /wp:buttons -->`;
  let code=article;
  const blocks=parseBlocks(code);
  const secs=sections(blocks).filter(s=>s.heading);
  const inserts=[];
  const placed=ctas.filter(b=>b.after!=="auto"&&b.after!==undefined&&b.after!==null&&b.after!=="");
  const auto=ctas.filter(b=>!placed.includes(b));
  placed.forEach(b=>{const s=secs[parseInt(b.after)];if(!s)return;const last=s.blocks.length?s.blocks[s.blocks.length-1]:s.heading;inserts.push({pos:last.end,html:mk(b)})});
  if(auto.length&&secs.length){
    const spots=auto.length===1?[0,Math.floor(secs.length/2),secs.length-1]:auto.map((_,i)=>Math.min(secs.length-1,Math.floor((i+1)*secs.length/(auto.length+1))));
    const uniq=[...new Set(spots)];
    uniq.forEach((si,i)=>{const b=auto[i%auto.length];const s=secs[si];const last=s.blocks.length?s.blocks[s.blocks.length-1]:s.heading;inserts.push({pos:last.end,html:mk(b)})});
  }
  inserts.sort((a,b)=>b.pos-a.pos).forEach(ins=>{code=code.slice(0,ins.pos)+"\n\n"+ins.html+code.slice(ins.pos)});
  return code;
}

global.AWP={DEFAULT_RULES,accept,STRUCT_MAP,STRUCT_PARAGRAPHS,parseBlocks,sections,stripTags,words,countPhrase,validate,autofix,planKeywords,buildChapterPrompt,buildFixPrompt,buildGlobalFixPrompt,generateByChapters,insertCta,issuesToText,rulesText,cleanModelOutput};
})(typeof window!=="undefined"?window:globalThis);
