const {npcs:NPCS,players:PLAYERS,scenes:SCENES,relations:REL}=window.MYSTERY_CATALOG.liufang;const ALL=[...Object.values(NPCS).map(x=>x.name),...PLAYERS];
const state={scene:0,speaker:'chen',listener:'陈稷',history:[],bond:50};
const conversation=new Mystery.Conversation(); const bonds={};
const $=s=>document.querySelector(s), esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function key(){return `${NPCS[state.speaker].name}|${state.listener}`}
function relation(){return REL[key()]||{label:'当前关系待建立',rule:`${NPCS[state.speaker].name}会以${NPCS[state.speaker].voice}面对${state.listener}。先通过提问观察对方的防备和情感。`}}
function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200)}
function add(name,text,user=false){Mystery.message($('#chat'),name,text,user,name[0]||'系')}
function renderFlow(){$('#flow').innerHTML=SCENES.map((s,i)=>`<button class="scene-btn ${i===state.scene?'active':''}" data-scene="${i}">${s.phase} · ${s.title}<small>${s.desc}</small></button>`).join('');document.querySelectorAll('[data-scene]').forEach(b=>b.onclick=()=>{state.scene=+b.dataset.scene;state.history=[];render()})}
function renderSelects(){const speaker=$('#speakerSelect'),listener=$('#listenerSelect');speaker.innerHTML=Object.entries(NPCS).map(([id,p])=>`<option value="${id}" ${id===state.speaker?'selected':''}>${p.name}</option>`).join('');listener.innerHTML=ALL.filter(n=>n!==NPCS[state.speaker].name).map(n=>`<option ${n===state.listener?'selected':''}>${n}</option>`).join('');speaker.onchange=()=>{state.speaker=speaker.value;if(NPCS[state.speaker].name===state.listener)state.listener=ALL.find(n=>n!==NPCS[state.speaker].name);state.history=[];render()};listener.onchange=()=>{state.listener=listener.value;state.history=[];render()}}
function renderNPCs(){$('#npcList').innerHTML=Object.entries(NPCS).map(([id,p])=>`<button class="npc ${id===state.speaker?'active':''}" data-npc="${id}"><div class="avatar">${p.name[0]}</div><div class="meta"><strong>${p.name}</strong><span>${p.tag}</span></div><div class="meter"><i style="width:${bonds[NPCS[id].name+'|'+state.listener]||50}%"></i></div></button>`).join('');document.querySelectorAll('[data-npc]').forEach(b=>b.onclick=()=>{state.speaker=b.dataset.npc;if(NPCS[state.speaker].name===state.listener)state.listener=ALL.find(n=>n!==NPCS[state.speaker].name);state.history=[];render()})}
function renderRelations(){const r=relation();$('#relationship').innerHTML=`<div class="relation focus"><strong>${r.label}</strong><span>${r.rule}</span></div><div class="relation"><strong>${NPCS[state.speaker].name}的底色</strong><span>${NPCS[state.speaker].voice}</span></div><div class="relation"><strong>此幕目标</strong><span>${NPCS[state.speaker].goal}</span></div>`;$('#relationHint').textContent=`${r.label} · 对话会按关系变调`}
function opening(){const p=NPCS[state.speaker],r=relation();return `${p.name}看向${state.listener}，没有立刻回答。${r.label}让这句话不能只按表面理解——${p.voice.split('；')[0]}。`}
function fallback(q){if(q.includes('尊重')||q.includes('选择'))return `${NPCS[state.speaker].name}看向${state.listener}：如果你愿意尊重我的选择，我也愿意把下一步交给我们一起决定。`;if(q.includes('害怕'))return `${NPCS[state.speaker].name}低声说：我怕保护变成替你决定，但我会试着听完你的话。`;const n=NPCS[state.speaker].name,r=relation();if(n==='陈明遇'&&state.listener==='陈稷')return `我不是不信你，陈稷。只是这个家已经送走过一个儿子，我不想再看着你把命交给一句“我应该去”。`;
if(n==='陈明遇'&&state.listener==='陈阎芙蓉')return `芙蓉，衣裳合不合身先放一边，家里给你的东西不是施舍。你愿意叫我一声爹，这个家就有你的位置。`;
if(n==='陈明遇'&&state.listener==='阎应元')return `三郎，你要去哪里，我拦不住你；可你这耳朵、这条命，哪一样不是我们一起护过来的？别把我的担心当成软弱。`;
if(n==='陈明遇'&&state.listener==='方亨')return `方兄，城防和密道都可以算，唯独人命不能只算成一笔得失。你既然把方圆交给我，我就不会让她被这盘棋吞掉。`;
if(n==='杨小池'&&state.listener==='杨玉笙')return `玉笙，先活下来，再谈报答。你若把自己交出去换我，我这个姐姐就白替你走了这么多年。`;
if(n==='杨小池'&&state.listener==='冯厚敦')return `冯大人，别用一条命替我做决定。我愿意走到你面前，是因为我认定你，不是因为我需要谁来可怜。`;
if(n==='阎应元'&&state.listener==='赵晚舟')return `晚舟，我声音大，不是要吓你。我只是怕你又站得太远，远到我来不及把那颗红豆交到你手里。`;
if(n==='方亨'&&state.listener==='方园')return `园儿，今日见到的这个人，不一定是你认识的父亲。可你要记住，父亲让你走开，从来不是不要你。`;
if(n==='顾元方'&&state.listener==='方园')return `别再叫我那个名字。你最好站远些——有些人一旦靠近面具，就会连自己想保护的东西也一起看不清。`;
if(q.includes('为什么')||q.includes('害怕'))return `${r.label}里最难说出口的，不是答案，是害怕失去之后还要继续做选择。${r.rule.split('。')[0]}。`;
if(q.includes('关系')||q.includes('家'))return `家不是一句称呼就能决定的。对${state.listener}，我会记得我们一起走过的事，也会保留不能说破的那一部分。`;
return `你问得太直接了。${r.rule.split('。')[0]}；如果你愿意再问一句，我可以告诉你我现在最想护住什么。`}
async function ask(q){
 if(conversation.busy||!q.trim()||q.length>1000)return;
 const id=state.speaker,listener=state.listener,n=NPCS[id].name,pair=n+'|'+listener;
 add('我',q,true);$('#modelBadge').textContent='正在回应…';
 const result=await conversation.request({scenario:'liufang',scene:state.scene,npc:id,listener,question:q,clues:[]},()=>fallback(q));
 if(!result)return;
 $('#modelBadge').textContent=result.mode;bonds[pair]=Math.min(99,(bonds[pair]||50)+Mystery.award(pair,q));renderNPCs();add(n,result.answer);Investigation.record(n,result.answer,result.mode);toast(`${n}对${listener}的关系温度：${bonds[pair]}`);
}
function render(){conversation.activate(`liufang|${state.scene}|${state.speaker}|${state.listener}`);const s=SCENES[state.scene];$('#sceneTitle').textContent=`${s.phase} · ${s.title}`;$('#sceneDesc').textContent=s.desc;$('#phaseText').textContent=s.phase;$('#quick').innerHTML=s.quick.map(q=>`<button data-q="${esc(q)}">${esc(q)}</button>`).join('');document.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>ask(b.dataset.q));renderFlow();renderSelects();renderNPCs();renderRelations();$('#chat').innerHTML='';add('系统',`你进入${s.phase}。${s.desc}`);add(NPCS[state.speaker].name,opening())}
$('#composer').onsubmit=e=>{e.preventDefault();const q=$('#input').value.trim();if(q){$('#input').value='';ask(q)}};render();

Mystery.status($('#modelBadge'));

Investigation.register({snapshot:()=>({key:'liufang',title:'流芳',phase:SCENES[state.scene].phase+' · '+SCENES[state.scene].title,clues:[]})});
