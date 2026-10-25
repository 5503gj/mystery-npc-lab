const SCENARIOS = window.MYSTERY_CATALOG.cases;
const state = {
  scenario: "mist",
  clues: new Set(),
  asked: new Set(),
  selected: "顾遥",
  correct: "顾遥",
  history: [],
};
const caseProgress = new Map();
let npc = {};
const conversation = new Mystery.Conversation();
const chat = document.querySelector("#chat");
const input = document.querySelector("#input");
const scenario = () => SCENARIOS[state.scenario];
function addMessage(name, text, user = false) {
  Mystery.message(chat, name, text, user, npc[name] || "雾");
}
function renderCase() {
  conversation.activate(state.scenario);
  const s = scenario();
  state.correct = s.correct;
  state.selected = s.npcs[0][0];
  npc = {};
  s.npcs.forEach((x) => (npc[x[0]] = x[0][0]));
  document.querySelector("#caseTitle").textContent = s.title;
  document.querySelector("#caseDescription").textContent = s.description;
  document.querySelector("#sceneLocation").textContent = s.location;
  document.querySelector("#sceneTime").textContent = s.time;
  document.querySelector("#sceneChapter").textContent = s.chapter;
  renderNPCs();
  document.querySelector("#clues").innerHTML = s.clues
    .map(
      (x) =>
        `<div class="clue ${state.clues.has(x[0]) ? "" : "locked"}" data-clue="${x[0]}"><strong>${x[1]}</strong><span>${state.clues.has(x[0]) ? x[2] : "尚未调查"}</span></div>`,
    )
    .join("");
  document.querySelector("#guessButtons").innerHTML = s.npcs
    .map((x) => `<button data-guess="${x[0]}">指认${x[0]}</button>`)
    .join("");
  document
    .querySelectorAll("[data-guess]")
    .forEach((b) =>
      b.addEventListener("click", () => resolveGuess(b.dataset.guess)),
    );
  document.querySelector(".quick").innerHTML = s.actions
    .map((x) => `<button data-action="${x[0]}">${x[1]}</button>`)
    .join("");
  document
    .querySelectorAll("[data-action]")
    .forEach((b) =>
      b.addEventListener("click", () => investigate(b.dataset.action)),
    );
  document.querySelector("#ending").classList.remove("show");
  document.querySelector("#endingTitle").textContent = "";
  document.querySelector("#endingText").textContent = "";
  chat.innerHTML = "";
  addMessage("系统", s.intro);
  addMessage(s.npcs[0][0], opening(s.npcs[0][0]));
  updateProgress();
}
function renderNPCs() {
  document.querySelector("#npcList").innerHTML = scenario()
    .npcs.map(
      (x) =>
        `<button type="button" class="npc-card ${state.selected === x[0] ? "active" : ""}" data-npc="${x[0]}" aria-pressed="${state.selected === x[0]}"><div class="avatar npc">${x[0][0]}</div><div><div class="npc-name">${x[0]}</div><div class="npc-role">${x[1]}</div></div><div class="meter"><b style="width:${x[2]}%"></b></div></button>`,
    )
    .join("");
  document.querySelectorAll("[data-npc]").forEach(
    (button) =>
      (button.onclick = () => {
        state.selected = button.dataset.npc;
        conversation.activate(state.scenario + "|" + state.selected);
        renderNPCs();
        chat.replaceChildren();
        addMessage(state.selected, opening(state.selected));
        document.querySelector("#modelBadge").textContent =
          "已切换人物 · 可继续提问";
      }),
  );
}
function renderTabs() {
  document.querySelector("#caseTabs").innerHTML = Object.entries(SCENARIOS)
    .map(
      ([id, s]) =>
        `<button class="case-tab ${id === state.scenario ? "active" : ""}" data-scenario="${id}"><strong>${s.title}</strong><span>${s.short}</span></button>`,
    )
    .join("");
  document.querySelectorAll("[data-scenario]").forEach((b) =>
    b.addEventListener("click", () => {
      caseProgress.set(state.scenario, {
        clues: [...state.clues],
        asked: [...state.asked],
      });
      state.scenario = b.dataset.scenario;
      const saved = caseProgress.get(state.scenario);
      state.clues = new Set(saved?.clues || []);
      state.asked = new Set(saved?.asked || []);
      renderTabs();
      renderCase();
    }),
  );
}
function opening(name) {
  if (state.scenario === "station")
    return name === "林澄"
      ? "我没想到你会在这里。那封信……已经没有必要寄出去了。"
      : "你也在等车？";
  if (state.scenario === "apartment")
    return name === "沈砚"
      ? "404 的门锁没坏，真正坏掉的是里面的线路。"
      : "这里没有什么异常，别把普通的声音想得太复杂。";
  return name === "顾遥"
    ? "如果你是来找录音的，我建议你先问林朔。灯塔的每一把钥匙，都经过他的手。"
    : "今晚的风很大，很多声音都会被误认成证词。";
}
function updateProgress() {
  const n = state.clues.size;
  document.querySelector("#clueCount").textContent = `${n}/4`;
  document.querySelector("#progress").textContent = `${Math.min(n + 1, 4)} / 4`;
  ["phase1", "phase2", "phase3", "phase4"].forEach((id, i) =>
    document
      .querySelector("#" + id)
      .classList.toggle("active", i === Math.min(n, 3)),
  );
  if (n >= 2) document.querySelector("#ending").classList.add("show");
}
function unlock(key, note) {
  if (state.clues.has(key)) return;
  state.clues.add(key);
  const el = document.querySelector(`[data-clue="${key}"]`);
  if (!el) return;
  el.classList.remove("locked");
  el.querySelector("span").textContent = note;
  updateProgress();
}
function investigate(action) {
  const item = scenario().clues.find((x) => x[0] === action);
  if (!item) return;
  unlock(action, item[2]);
  addMessage("系统", item[2]);
}
function localReply(text) {
  const s = scenario(),
    q = text.toLowerCase();
  let name = state.selected;
  state.asked.add(name);
  let a = "";
  if (state.scenario === "mist") {
    if (name === "顾遥")
      a = q.includes("录音")
        ? "第七份录音不该被拿出来。那里面有我父亲留下的声音，程砚知道。"
        : "停电时我在厨房找蜡烛……好吧，我确实去过灯塔，但没有打开观测室的门。";
    if (name === "林朔")
      a = q.includes("钥匙")
        ? "档案室钥匙在我这里，备用钥匙在观测室门边。"
        : "停电后我一直在大厅。湿脚印可能是雨水，也可能是有人走过。";
    if (name === "程砚")
      a = q.includes("录音")
        ? "标签是我写的，但我没有拿走录音。顾遥不想让任何人听见它。"
        : "我来这里拍摄灯塔。顾遥很紧张，但紧张不等于撒谎。";
  }
  if (state.scenario === "station") {
    if (name === "林澄")
      a = q.includes("信")
        ? "我写信不是为了挽回谁，只是想让他知道，当年我没有真正离开。"
        : "末班车还有十二分钟，我不想再错过一次。";
    if (name === "周野")
      a = q.includes("照片")
        ? "照片里被剪掉的人，是我不敢面对的人。林澄知道答案。"
        : "我只是来拍照，别把等待说成承诺。";
    if (name === "沈禾")
      a = "我记得七年前的车次。那天有人提前七分钟上车，站钟后来才慢下来。";
  }
  if (state.scenario === "apartment") {
    if (name === "沈砚")
      a = q.includes("地下室")
        ? "B-04 只是维修编号，你不该从收据背面看到它。"
        : "线路老化会产生声音，我来这里是帮忙。";
    if (name === "唐梨")
      a = q.includes("声音")
        ? "我听见的不是敲墙，更像有人用金属敲管道。沈砚每次都比我早知道。"
        : "我住在 405，晚上不敢开灯。";
    if (name === "陆闻")
      a = "房东只负责门锁，不负责住户的想象。404 室已经空了三个月。";
  }
  return a || "我暂时不想回答这个问题。你可以换一种问法，或者先调查现场。";
}
async function reply(text) {
  if (conversation.busy) return;
  const s = scenario(),
    q = text.trim();
  if (!q || q.length > 1000) return;
  let name = state.selected;
  s.npcs.forEach((x) => {
    if (q.includes(x[0])) name = x[0];
  });
  state.selected = name;
  state.asked.add(name);
  renderNPCs();
  conversation.activate(state.scenario + "|" + name);
  addMessage("我", q, true);
  document.querySelector("#modelBadge").textContent = "正在回应…";
  const result = await conversation.request(
    {
      scenario: state.scenario,
      npc: name,
      scene: 0,
      question: q,
      clues: [...state.clues],
    },
    () => localReply(q),
  );
  if (!result) return;
  document.querySelector("#modelBadge").textContent = result.mode;
  addMessage(name, result.answer);
  Investigation.record(name, result.answer, result.mode);
  if (state.asked.size >= 2 && s.clues[1]) unlock(s.clues[1][0], s.clues[1][2]);
}
document
  .querySelectorAll("[data-action]")
  .forEach((b) =>
    b.addEventListener("click", () => investigate(b.dataset.action)),
  );
function resolveGuess(pick) {
  const ending = document.querySelector("#endingTitle"),
    text = document.querySelector("#endingText");
  if (state.clues.size < 2) {
    ending.textContent = "线索还不够";
    text.textContent = "至少收集两条线索，再提交你的判断。";
    return;
  }
  if (pick === state.correct) {
    ending.textContent = "结局：推理成立";
    text.textContent = `你选择了${pick}。现有证据支持这条路线，但案件还可以继续扩写为多结局剧本。`;
  } else {
    ending.textContent = "结局：证据不足";
    text.textContent = `${pick}存在疑点，但当前线索还不能完成闭环。继续询问 NPC 或调查现场。`;
  }
}
document.querySelector("#composer").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  reply(text);
});
renderTabs();
renderCase();

Mystery.status(document.querySelector("#modelBadge"));

Investigation.register({
  snapshot: () => ({
    key: state.scenario,
    title: scenario().title,
    phase: scenario().chapter,
    clues: scenario()
      .clues.filter((row) => state.clues.has(row[0]))
      .map((row) => ({ id: "clue-" + row[0], title: row[1], text: row[2] })),
  }),
});
