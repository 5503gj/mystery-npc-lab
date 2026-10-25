/* Shared text rendering and cancellation guard for every game page. */
window.Mystery = (() => {
  function message(container, name, text, user=false, avatar='雾') {
    const row=document.createElement('div');row.className='msg message'+(user?' user':'');
    const icon=document.createElement('div');icon.className='avatar'+(user?'':' npc sys');icon.textContent=user?'我':String(avatar);
    const body=document.createElement('div'),speaker=document.createElement('div'),bubble=document.createElement('div');
    speaker.className='speaker';speaker.textContent=String(name);
    bubble.className='bubble';bubble.textContent=String(text).slice(0,3000);
    body.append(speaker,bubble);row.append(icon,body);container.append(row);container.scrollTop=container.scrollHeight;
  }
  class Conversation {
    constructor(){this.key='';this.version=0;this.controller=null;this.busy=false;this.histories=new Map();this.sessionReady=false;}
    activate(key){if(key!==this.key){this.controller?.abort();this.key=key;this.version++;this.busy=false;}}
    async request(payload,fallback){
      if(this.busy)return null;
      this.busy=true;const key=this.key,version=++this.version;
      const controller=this.controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),10000);
      let answer='',mode='规则模式（模型未可用）';
      try{
        if(!this.sessionReady){
          const session=await fetch('/api/session',{method:'POST',signal:controller.signal});
          if(!session.ok)throw new Error('session');this.sessionReady=true;
        }
        if(this.key!==key||version!==this.version)return null;
        const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify(payload)});
        if(response.status===401)this.sessionReady=false;
        if(!response.ok)throw new Error('unavailable');
        const data=await response.json();
        if(data.ok&&typeof data.answer==='string'&&data.answer.trim()) {answer=data.answer.trim();mode='本地模型';}
      }catch(_){/* fallback remains visible to the user */}
      finally{clearTimeout(timeout);if(version===this.version)this.busy=false;}
      if(this.key!==key||version!==this.version)return null;
      if(!answer)answer=fallback();
      const history=this.histories.get(key)||[];
      history.push({role:'user',content:payload.question},{role:'assistant',content:answer});
      this.histories.set(key,history.slice(-8));
      // Bound local memory as well as individual conversation history.
      if(this.histories.size>64)this.histories.delete(this.histories.keys().next().value);
      return {answer,mode};
    }
  }
  const awards=new Map();
  function award(key,question){
    const q=question.trim().replace(/\s+/g,' ');
    if(!/(尊重|选择|家|爱|后悔|害怕)/.test(q))return 0;
    const seen=awards.get(key)||new Set();if(seen.has(q)||seen.size>=32)return 0;
    seen.add(q);awards.set(key,seen);return /尊重|选择/.test(q)?2:1;
  }
  async function status(element){
    try{const r=await fetch('/api/status');const d=await r.json();element.textContent=d.ollama?'本地模型可用':'规则模式（模型不可用）';}
    catch(_){element.textContent='规则模式（本地服务未连接）';}
  }
  return {message,Conversation,award,status};
})();
