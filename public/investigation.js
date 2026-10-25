/* Small, inspectable investigation tools. No model thought traces or hidden facts. */
(function (root) {
  const clean = (value, limit = 1800) => String(value ?? "").slice(0, limit);
  function collectFacts(snapshot) {
    return (snapshot.clues || []).slice(0, 32).map((clue) => ({
      id: clean(clue.id, 100),
      title: clean(clue.title, 100),
      text: clean(clue.text),
    }));
  }
  function indexStatements(snapshot, statements) {
    return statements
      .filter((row) => row.scope === snapshot.key)
      .slice(-64)
      .map((row) => ({
        id: clean(row.id, 100),
        speaker: clean(row.speaker, 80),
        phase: clean(row.phase, 100),
        text: clean(row.text),
        mode: clean(row.mode, 80),
      }));
  }
  function checkSources(facts, testimony, notes, links) {
    const personal = notes
      .slice(0, 12)
      .map((row) => ({ id: clean(row.id, 100), text: clean(row.text, 800) }));
    const ids = new Set(
      [...facts, ...testimony, ...personal].map((row) => row.id),
    );
    const connections = links
      .filter(
        (row) =>
          ids.has(row.from) &&
          ids.has(row.to) &&
          row.from !== row.to &&
          ["相互印证", "存在冲突", "需要核对"].includes(row.label),
      )
      .slice(0, 16)
      .map((row) => ({
        from: clean(row.from, 100),
        to: clean(row.to, 100),
        label: row.label,
      }));
    return { notes: personal, links: connections };
  }
  function suggestQuestions(facts) {
    const questions = facts.slice(0, 3).map((fact) => ({
      source: fact.id,
      text: `关于“${fact.title}”，你能提供可核对的时间、位置或其他证人吗？`,
    }));
    if (!questions.length)
      questions.push({
        source: null,
        text: "你能按时间顺序讲述这一幕发生的事，并说明哪些部分是你亲眼所见吗？",
      });
    return questions;
  }
  function assemble(snapshot, { facts, testimony, notes, links, questions }) {
    return {
      version: 1,
      case: clean(snapshot.title, 120),
      scope: clean(snapshot.key, 100),
      phase: clean(snapshot.phase, 100),
      createdAt: new Date().toISOString(),
      facts,
      testimony,
      notes,
      links,
      questions,
      limits: [
        "角色说法尚未独立核实，不能当作现场事实。",
        "证据关联由玩家标记，不自动判定责任或结局。",
        "仅整理本次已发现线索与对话，不读取隐藏案情。",
      ],
      tools: [
        {
          id: "collect_evidence",
          label: "收集已发现证据",
          result: `${facts.length}条现场事实`,
        },
        {
          id: "index_testimony",
          label: "整理角色说法",
          result: `${testimony.length}条摘录，保留人物与章节`,
        },
        {
          id: "check_sources",
          label: "检查来源关联",
          result: `${links.length}条有效关联，${notes.length}条玩家笔记`,
        },
        {
          id: "suggest_questions",
          label: "提出下一步问题",
          result: `${questions.length}个可回到对话核对的问题`,
        },
      ],
    };
  }
  function brief(snapshot, statements, notes, links) {
    const facts = collectFacts(snapshot),
      testimony = indexStatements(snapshot, statements),
      checked = checkSources(facts, testimony, notes, links);
    return assemble(snapshot, {
      facts,
      testimony,
      ...checked,
      questions: suggestQuestions(facts),
    });
  }
  function markdown(report) {
    const line = (value) => clean(value).replace(/[\r\n]+/g, " ");
    return [
      `# ${line(report.case)} · 调查记录`,
      `章节：${line(report.phase)}`,
      `生成：${report.createdAt}`,
      "",
      "## 已发现的现场线索",
      ...report.facts.map(
        (row) => `- [${line(row.id)}] ${line(row.title)}：${line(row.text)}`,
      ),
      "",
      "## 角色说法（待核实）",
      ...report.testimony.map(
        (row) =>
          `- [${line(row.id)}] ${line(row.speaker)} / ${line(row.phase)} / ${line(row.mode)}：${line(row.text)}`,
      ),
      "",
      "## 玩家笔记",
      ...report.notes.map((row) => `- [${line(row.id)}] ${line(row.text)}`),
      "",
      "## 玩家标记的关联",
      ...report.links.map(
        (row) => `- ${line(row.from)} → ${line(row.to)}：${line(row.label)}`,
      ),
      "",
      "## 下一步问题",
      ...report.questions.map(
        (row) =>
          `- ${line(row.text)}${row.source ? `（来源：${line(row.source)}）` : ""}`,
      ),
      "",
      "## 边界",
      ...report.limits.map((row) => `- ${row}`),
      "",
    ].join("\n");
  }
  const core = {
    brief,
    markdown,
    collectFacts,
    indexStatements,
    checkSources,
    suggestQuestions,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = core;
  root.InvestigationCore = core;
  if (typeof document === "undefined") return;

  let adapter,
    workspace,
    activeScope = "",
    version = 0,
    running = false,
    nextId = 0,
    boardResize = null;
  const buckets = new Map();
  function bucket(key) {
    if (!buckets.has(key))
      buckets.set(key, {
        statements: [],
        notes: [],
        pins: new Set(),
        links: [],
        report: null,
        draft: "",
      });
    return buckets.get(key);
  }
  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = clean(text, 10000);
    return node;
  }
  function button(label, callback, cls = "lab-button") {
    const node = el("button", cls, label);
    node.type = "button";
    node.onclick = callback;
    return node;
  }
  function snapshot() {
    return adapter.snapshot();
  }
  function sources(s, b) {
    return [
      ...(s.clues || []).map((row) => ({ ...row, kind: "现场线索" })),
      ...b.statements.map((row) => ({
        id: row.id,
        title: row.speaker,
        text: row.text,
        kind: `角色说法 · ${row.phase}`,
      })),
      ...b.notes.map((row, index) => ({
        id: row.id,
        title: `玩家笔记 ${index + 1}`,
        text: row.text,
        kind: "待验证想法",
      })),
    ];
  }
  function exportReport(format) {
    const s = snapshot(),
      b = bucket(s.key),
      report = brief(s, b.statements, b.notes, b.links),
      json = format === "json";
    const url = URL.createObjectURL(
      new Blob([json ? JSON.stringify(report, null, 2) : markdown(report)], {
        type: json ? "application/json" : "text/markdown;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `mystery-notebook-${s.key.replace(/[^a-zA-Z0-9_-]/g, "_")}.${json ? "json" : "md"}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function refresh() {
    if (!adapter || !workspace) return;
    const s = snapshot(),
      b = bucket(s.key);
    if (s.key !== activeScope) {
      version++;
      running = false;
      activeScope = s.key;
    }
    const all = sources(s, b),
      valid = new Set(all.map((row) => row.id));
    b.pins = new Set([...b.pins].filter((id) => valid.has(id)));
    b.links = b.links.filter((row) => valid.has(row.from) && valid.has(row.to));
    const focusedNote = document.activeElement?.id === "notebook-note";
    const caret = focusedNote ? document.activeElement.selectionStart : null;
    const content = workspace.querySelector(".notebook-content");
    content.replaceChildren();
    workspace.querySelector(".notebook-context").textContent =
      `${s.title} / ${s.phase} · ${s.clues.length}条已发现线索 · ${b.statements.length}条角色摘录`;
    document.querySelector("#notebook-count").textContent = String(
      s.clues.length + b.statements.length + b.notes.length,
    );

    const left = el("div", "evidence-library"),
      heading = el("div", "notebook-section-heading");
    heading.append(
      el("span", "lab-kicker", "01 / EVIDENCE"),
      el("h3", "", "把已知的放在一起"),
    );
    left.append(
      heading,
      el("p", "notebook-help", "固定线索、说法或笔记，再在证据板上建立关联。"),
    );
    if (!all.length) {
      const empty = el("div", "notebook-empty");
      empty.append(
        el("span", "empty-symbol", "⌁"),
        el("h4", "", "调查，从一个问题开始"),
        el(
          "p",
          "",
          "先回到对话现场，询问人物或调查场景。这里只收录已经出现的内容。",
        ),
      );
      left.append(empty);
    }
    const list = el("div", "evidence-list");
    for (const source of all.slice().reverse().slice(0, 48)) {
      const item = el("article", "evidence-item"),
        meta = el("div", "evidence-meta");
      meta.append(
        el("span", "source-kind", source.kind),
        el("code", "", source.id),
      );
      const pin = button(
        b.pins.has(source.id) ? "已固定 ✓" : "固定到证据板",
        () => {
          if (b.pins.has(source.id)) {
            b.pins.delete(source.id);
            b.links = b.links.filter(
              (row) => row.from !== source.id && row.to !== source.id,
            );
          } else if (b.pins.size < 8) b.pins.add(source.id);
          else {
            announce("最多固定8项，请先移除一项");
            return;
          }
          refresh();
        },
        "pin-button",
      );
      pin.setAttribute("aria-pressed", String(b.pins.has(source.id)));
      item.append(
        meta,
        el("h4", "", source.title),
        el("p", "", source.text),
        pin,
      );
      list.append(item);
    }
    left.append(list);
    const noteForm = el("form", "note-form"),
      noteLabel = el("label", "", "自己的判断，先记下来");
    noteLabel.htmlFor = "notebook-note";
    const note = el("textarea");
    note.id = "notebook-note";
    note.placeholder = "哪些地方值得再问？这条想法和哪段说法有关？";
    note.maxLength = 800;
    note.rows = 3;
    note.value = b.draft;
    note.oninput = () => {
      b.draft = note.value;
    };
    const add = el("button", "lab-button", "添加笔记");
    add.type = "submit";
    noteForm.append(noteLabel, note, add);
    noteForm.onsubmit = (event) => {
      event.preventDefault();
      if (!note.value.trim()) return;
      if (b.notes.length >= 12) {
        announce("本次案件最多12条笔记，请先导出整理");
        return;
      }
      b.notes.push({
        id: `note-${Date.now()}-${b.notes.length}`,
        text: note.value.trim(),
      });
      b.draft = "";
      b.report = null;
      refresh();
      announce("已添加到当前案件的会话笔记");
    };
    left.append(noteForm);

    const middle = el("section", "evidence-board"),
      boardHead = el("div", "notebook-section-heading");
    boardHead.append(
      el("span", "lab-kicker", "02 / CONNECTIONS"),
      el("h3", "", "证据之间，还有什么？"),
    );
    middle.append(boardHead);
    const pinned = all.filter((row) => b.pins.has(row.id)),
      board = el("div", "board-canvas");
    board.setAttribute("aria-label", "证据关联板");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("board-lines");
    svg.setAttribute("aria-hidden", "true");
    board.append(svg);
    if (!pinned.length) {
      const empty = el("div", "board-placeholder");
      empty.append(
        el("div", "board-glyph", "╳"),
        el("h4", "", "留给你的一张证据板"),
        el(
          "p",
          "",
          "从左侧固定至少两项，标记它们如何互相印证，或哪里仍有冲突。",
        ),
      );
      board.append(empty);
    }
    pinned.forEach((row, index) => {
      const card = el("article", "board-node");
      card.dataset.source = row.id;
      card.append(
        el("small", "", `${String(index + 1).padStart(2, "0")} / ${row.kind}`),
        el("h4", "", row.title),
        el("p", "", row.text),
      );
      board.append(card);
    });
    middle.append(board);
    if (pinned.length >= 2) {
      const controls = el("div", "link-controls"),
        from = el("select"),
        to = el("select"),
        relation = el("select");
      from.setAttribute("aria-label", "关联起点");
      to.setAttribute("aria-label", "关联终点");
      relation.setAttribute("aria-label", "关联类型");
      for (const row of pinned) {
        const a = el("option", "", row.title);
        a.value = row.id;
        from.append(a);
        const z = a.cloneNode(true);
        to.append(z);
      }
      to.selectedIndex = 1;
      for (const name of ["需要核对", "相互印证", "存在冲突"]) {
        const option = el("option", "", name);
        relation.append(option);
      }
      const connect = button("建立关联", () => {
        if (from.value === to.value) {
          announce("请选择两项不同内容");
          return;
        }
        if (b.links.length >= 16) {
          announce("最多保留16条关联");
          return;
        }
        if (
          !b.links.some(
            (row) =>
              row.from === from.value &&
              row.to === to.value &&
              row.label === relation.value,
          )
        )
          b.links.push({
            from: from.value,
            to: to.value,
            label: relation.value,
          });
        b.report = null;
        refresh();
        announce("已记录玩家关联，仍需进一步核对");
      });
      controls.append(from, el("span", "", "→"), to, relation, connect);
      middle.append(controls);
    }
    const relations = el("div", "connection-list");
    b.links.forEach((row, index) => {
      const a = all.find((item) => item.id === row.from),
        z = all.find((item) => item.id === row.to),
        line = el("div");
      line.append(
        el("span", "", `${a?.title} → ${z?.title}`),
        el("strong", "", row.label),
        button(
          "移除",
          () => {
            b.links.splice(index, 1);
            b.report = null;
            refresh();
          },
          "text-button",
        ),
      );
      relations.append(line);
    });
    middle.append(
      relations,
      el(
        "p",
        "notebook-help",
        "关联是你的调查假设；角色说法和玩家笔记不会自动升级为事实。",
      ),
    );

    const right = el("aside", "director-panel"),
      directorHead = el("div", "notebook-section-heading");
    directorHead.append(
      el("span", "lab-kicker", "03 / INVESTIGATION AGENT"),
      el("h3", "", "下一步，问得更准"),
    );
    right.append(
      directorHead,
      el(
        "p",
        "notebook-help",
        "本地工具整理当前证据并生成追问，不判定凶手，不读取未发现的案情。",
      ),
    );
    const run = button(
      running ? "正在整理…" : "运行调查助手",
      () => runDirector(),
      "lab-button primary",
    );
    run.disabled = running;
    right.append(run);
    const tools = el("ol", "director-tools");
    tools.id = "director-tools";
    for (const [index, label] of [
      "收集已发现线索",
      "整理角色说法",
      "检查来源关联",
      "生成追问建议",
    ].entries()) {
      const line = el("li");
      if (b.report) line.className = "done";
      line.append(
        el("span", "tool-index", b.report ? "✓" : String(index + 1)),
        el("span", "", label),
      );
      tools.append(line);
    }
    right.append(tools);
    if (b.report) {
      const result = el("div", "director-result");
      result.append(el("h4", "", "可以带回对话的问题"));
      for (const q of b.report.questions) {
        const question = el("div", "question-proposal");
        question.append(
          el("p", "", q.text),
          el(
            "small",
            "",
            q.source
              ? `依据：${q.source}`
              : "依据：缺少已发现线索，先建立时间顺序",
          ),
          button(
            "带入对话 →",
            () => {
              setView(false);
              const input = document.querySelector("#input");
              input.value = q.text;
              input.focus();
              input.scrollIntoView({
                behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
                  ? "auto"
                  : "smooth",
                block: "center",
              });
            },
            "text-button",
          ),
        );
        result.append(question);
      }
      right.append(result);
    }
    const downloads = el("div", "notebook-downloads");
    downloads.append(
      button("导出 Markdown", () => exportReport("md"), "text-button"),
      button("导出 JSON", () => exportReport("json"), "text-button"),
    );
    right.append(
      downloads,
      el(
        "p",
        "notebook-help",
        "笔记仅保留在本次页面会话，刷新会清空，请及时导出。",
      ),
    );
    content.append(left, middle, right);
    if (focusedNote) {
      note.focus({ preventScroll: true });
      note.setSelectionRange(caret, caret);
    }
    if (boardResize) boardResize.disconnect();
    boardResize = new ResizeObserver(() => drawLines(board, svg, b.links));
    boardResize.observe(board);
    requestAnimationFrame(() => drawLines(board, svg, b.links));
  }
  function drawLines(board, svg, links) {
    const rect = board.getBoundingClientRect();
    svg.setAttribute(
      "viewBox",
      `0 0 ${Math.max(1, rect.width)} ${Math.max(1, rect.height)}`,
    );
    svg.replaceChildren();
    for (const row of links) {
      const nodes = [...board.querySelectorAll(".board-node")],
        a = nodes.find((node) => node.dataset.source === row.from),
        b = nodes.find((node) => node.dataset.source === row.to);
      if (!a || !b) continue;
      const r1 = a.getBoundingClientRect(),
        r2 = b.getBoundingClientRect();
      const path = document.createElementNS(svg.namespaceURI, "path");
      const x1 = r1.left - rect.left + r1.width / 2,
        y1 = r1.top - rect.top + r1.height / 2,
        x2 = r2.left - rect.left + r2.width / 2,
        y2 = r2.top - rect.top + r2.height / 2;
      path.setAttribute(
        "d",
        `M${x1},${y1} C${x1 + 70},${y1} ${x2 - 70},${y2} ${x2},${y2}`,
      );
      path.dataset.relation = row.label;
      svg.append(path);
    }
  }
  function announce(text) {
    const status = document.querySelector("#notebook-status");
    if (status) status.textContent = text;
  }
  async function runDirector() {
    if (running) return;
    running = true;
    const start = ++version,
      s = JSON.parse(JSON.stringify(snapshot())),
      b = bucket(s.key);
    b.report = null;
    refresh();
    const statements = b.statements.slice(),
      notes = b.notes.slice(),
      links = b.links.slice(),
      data = { facts: [], testimony: [], notes: [], links: [], questions: [] };
    const stages = [
      () => {
        data.facts = collectFacts(s);
        return `${data.facts.length}条现场事实`;
      },
      () => {
        data.testimony = indexStatements(s, statements);
        return `${data.testimony.length}条角色说法`;
      },
      () => {
        Object.assign(
          data,
          checkSources(data.facts, data.testimony, notes, links),
        );
        return `${data.links.length}条有效关联`;
      },
      () => {
        data.questions = suggestQuestions(data.facts);
        return `${data.questions.length}条追问建议`;
      },
    ];
    try {
      for (const [index, operation] of stages.entries()) {
        if (start !== version) return;
        const item = workspace.querySelectorAll("#director-tools li")[index];
        item.classList.add("running");
        await new Promise((resolve) => requestAnimationFrame(resolve));
        if (start !== version) return;
        const result = operation();
        item.classList.remove("running");
        item.classList.add("done");
        item.firstChild.textContent = "✓";
        item.lastChild.textContent = result;
      }
      if (start !== version) return;
      b.report = assemble(s, data);
      announce("调查摘要已完成，追问可带入对话核对");
    } finally {
      if (start === version) {
        running = false;
        refresh();
      }
    }
  }
  function setView(notebook) {
    document.querySelector("main.layout").hidden = notebook;
    workspace.hidden = !notebook;
    document
      .querySelector("#view-scene")
      .setAttribute("aria-selected", String(!notebook));
    document
      .querySelector("#view-notebook")
      .setAttribute("aria-selected", String(notebook));
    if (notebook) refresh();
  }
  function register(value) {
    adapter = value;
    activeScope = value.snapshot().key;
    const shell = document.querySelector(".shell"),
      head = shell.querySelector("header");
    const navigation = el("nav", "lab-navigation");
    navigation.setAttribute("aria-label", "剧本与工作视图");
    const brand = el("span", "lab-wordmark", "M / NPC LAB");
    navigation.append(brand);
    for (const [href, label] of [
      ["index.html", "原创案件"],
      ["liufang.html", "流芳"],
      ["ye-pusa.html", "野菩萨"],
    ]) {
      const a = el("a", "", label);
      a.href = href;
      if ((location.pathname.split("/").pop() || "index.html") === href)
        a.setAttribute("aria-current", "page");
      navigation.append(a);
    }
    shell.insertBefore(navigation, head);
    const intro = el("div", "lab-intro");
    intro.append(
      el("div", "lab-kicker", "FOLLOW THE EVIDENCE"),
      el("h2", "", "每一句话，都值得再问一次。"),
      el(
        "p",
        "",
        "走进人物的叙述，把发现的线索放在一起。让疑点有来处，让下一步有方向。",
      ),
    );
    head.after(intro);
    const bar = el("div", "lab-viewbar"),
      tabs = el("div", "lab-viewtabs"),
      scene = button("对话现场", () => setView(false)),
      notebook = button("调查工作台", () => setView(true));
    scene.id = "view-scene";
    notebook.id = "view-notebook";
    scene.setAttribute("aria-selected", "true");
    notebook.setAttribute("aria-selected", "false");
    scene.setAttribute("role", "tab");
    notebook.setAttribute("role", "tab");
    tabs.setAttribute("role", "tablist");
    const count = el("span", "view-count", "0");
    count.id = "notebook-count";
    notebook.append(count);
    tabs.append(scene, notebook);
    bar.append(
      tabs,
      el("span", "workbench-mode", "本地工具 Agent · 证据可追溯"),
    );
    intro.after(bar);
    workspace = el("section", "investigation-workspace");
    workspace.hidden = true;
    workspace.setAttribute("aria-label", "调查证据工作台");
    const context = el("div", "notebook-context"),
      content = el("div", "notebook-content"),
      status = el("p", "notebook-status");
    status.id = "notebook-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    workspace.append(context, content, status);
    document.querySelector("main.layout").after(workspace);
    const observer = new MutationObserver(() => {
      version++;
      running = false;
      refresh();
    });
    for (const selector of [
      "#clues",
      "#caseTitle",
      "#sceneTitle",
      "#phaseText",
    ]) {
      const target = document.querySelector(selector);
      if (target)
        observer.observe(target, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: selector === "#clues",
        });
    }
    document.addEventListener("mystery-message", (event) => {
      const data = event.detail;
      if (!adapter || data.user || data.name === "系统") return;
      const s = snapshot(),
        b = bucket(s.key);
      b.statements.push({
        id: `quote-${++nextId}`,
        scope: s.key,
        speaker: clean(data.name, 80),
        phase: clean(s.phase, 100),
        text: clean(data.text),
        mode: clean(data.mode, 80),
      });
      if (b.statements.length > 64) b.statements.shift();
      b.report = null;
      version++;
      running = false;
      refresh();
    });
    let resize;
    window.addEventListener("resize", () => {
      clearTimeout(resize);
      resize = setTimeout(() => {
        if (!workspace.hidden)
          drawLines(
            workspace.querySelector(".board-canvas"),
            workspace.querySelector(".board-lines"),
            bucket(snapshot().key).links,
          );
      }, 100);
    });
    refresh();
  }
  root.Investigation = {
    register,
    refresh,
    record: (name, text, mode) =>
      document.dispatchEvent(
        new CustomEvent("mystery-message", {
          detail: { name, text, mode, user: false },
        }),
      ),
  };
})(globalThis);
