const {npcs:PEOPLE,scenes:SCENES}=window.MYSTERY_CATALOG.yepusa;
const state={scene:0,current:'huangshan',history:[],bonds:Object.fromEntries(Object.keys(PEOPLE).map(k=>[k,PEOPLE[k].bond]))};
const conversation=new Mystery.Conversation();
const chat=document.querySelector('#chat'),input=document.querySelector('#input');
function add(name,text,user=false){Mystery.message(chat,name,text,user,name[0]||'菩')}
function renderFlow(){document.querySelector('#flow').innerHTML=SCENES.map((s,i)=>`<button class="scene-btn ${i===state.scene?'active':''}" data-scene="${i}">${s.phase} · ${s.title.split(' · ')[0]}<small>${s.desc}</small></button>`).join('');document.querySelectorAll('[data-scene]').forEach(b=>b.onclick=()=>{state.scene=Number(b.dataset.scene);renderScene()})}
function renderNPCs(){document.querySelector('#npcList').innerHTML=Object.entries(PEOPLE).map(([id,p])=>`<button class="npc ${id===state.current?'active':''}" data-npc="${id}"><div class="avatar">${p.name[0]}</div><div><strong>${p.name}</strong><span>${p.tag}</span></div><div class="meter"><i style="width:${state.bonds[id]}%"></i></div></button>`).join('');document.querySelectorAll('[data-npc]').forEach(b=>b.onclick=()=>{state.current=b.dataset.npc;conversation.activate(`yepusa|${state.scene}|${state.current}`);renderNPCs();renderRelations();chat.replaceChildren();add('系统',`你把注意力转向${PEOPLE[state.current].name}。他/她看起来愿意回答，但不代表愿意说真话。`)})}
function renderRelations(){const p=PEOPLE[state.current];document.querySelector('#relationship').innerHTML=p.relations.map(r=>`<div class="relation"><strong>${r[0]}</strong><span>${r[1]}</span></div>`).join('')}
function renderScene(){conversation.activate(`yepusa|${state.scene}|${state.current}`);const s=SCENES[state.scene];document.querySelector('#sceneTitle').textContent=s.title;document.querySelector('#sceneDesc').textContent=s.desc;document.querySelector('#phaseText').textContent=s.phase;document.querySelector('#quick').innerHTML=s.quick.map(q=>`<button data-q="${q}">${q}</button>`).join('');document.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>ask(b.dataset.q));chat.innerHTML='';add('系统',s.intro);add(PEOPLE[state.current].name,opening());renderFlow();renderNPCs();renderRelations()}
function opening(){const p=PEOPLE[state.current];return `${p.name}没有马上看你，只说：“${p.tag}……你想先听哪一部分？”`}
function fallback(q){const p=PEOPLE[state.current];if(q.includes('爱')||q.includes('关系'))return '我不太会解释爱。我更习惯说选择、代价，还有留下以后要承担的东西。';if(q.includes('谁')||q.includes('记起'))return `如果一定要回答，我最不想面对的是${p.relations[0][0]}，因为那个人知道我最不像现在的地方。`;if(q.includes('后悔'))return '后悔不是把事情改回去，而是终于承认当时的自己没有更好的办法。';return '我可以告诉你我愿意让你知道的部分。至于剩下的，等你先说说你为什么要问。'}
async function ask(q){
 if(conversation.busy||!q.trim()||q.length>1000)return;
 const id=state.current,p=PEOPLE[id];add('我',q,true);document.querySelector('#modelBadge').textContent='正在回应…';
 const result=await conversation.request({scenario:'yepusa',scene:state.scene,npc:id,listener:'玩家',question:q,clues:[]},()=>fallback(q));
 if(!result)return;
 document.querySelector('#modelBadge').textContent=result.mode;state.bonds[id]=Math.min(99,state.bonds[id]+Mystery.award('yepusa|'+id,q));renderNPCs();add(p.name,result.answer);
 document.querySelector('#ending').classList.add('show');document.querySelector('#endingText').textContent=`你和${p.name}的关系温度：${state.bonds[id]}。仅预置话题的首次提问会改变关系。`;
}
document.querySelector('#composer').onsubmit=e=>{e.preventDefault();const q=input.value.trim();if(q){input.value='';ask(q)}};
renderScene();

Mystery.status(document.querySelector('#modelBadge'));
