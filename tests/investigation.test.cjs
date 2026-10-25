const { test } = require("node:test");
const assert = require("node:assert/strict");
const { brief, markdown } = require("../public/investigation.js");
const snapshot = {
  key: "mist",
  title: "第七份录音",
  phase: "第一章",
  clues: [{ id: "key", title: "钥匙", text: "已发现的事实" }],
  hidden: "DO_NOT_EXPORT_HIDDEN_TRUTH",
};
test("only revealed evidence and same-case recorded testimony enter the report", () => {
  const report = brief(
    snapshot,
    [
      {
        id: "q1",
        scope: "mist",
        speaker: "顾遥",
        phase: "第一章",
        text: "角色说法",
        mode: "规则模式",
      },
      {
        id: "q2",
        scope: "station",
        speaker: "其他人",
        text: "FOREIGN_CASE_PRIVATE",
      },
    ],
    [],
    [],
  );
  assert.equal(report.facts.length, 1);
  assert.equal(report.testimony.length, 1);
  assert.equal(report.testimony[0].mode, "规则模式");
  assert.ok(!JSON.stringify(report).includes("DO_NOT_EXPORT_HIDDEN_TRUTH"));
  assert.ok(!JSON.stringify(report).includes("FOREIGN_CASE_PRIVATE"));
  assert.equal(report.questions[0].source, "key");
  assert.match(report.limits.join(""), /角色说法尚未独立核实/);
});
test("invalid, cross-case and self links are dropped and extra fields never leak", () => {
  const report = brief(
    snapshot,
    [],
    [{ id: "note1", text: "自己的假设" }],
    [
      {
        from: "key",
        to: "note1",
        label: "需要核对",
        apiKey: "DO_NOT_EXPORT_TOKEN",
      },
      { from: "key", to: "unknown", label: "存在冲突" },
      { from: "key", to: "key", label: "相互印证" },
      { from: "key", to: "note1", label: "已证实凶手" },
    ],
  );
  assert.deepEqual(report.links, [
    { from: "key", to: "note1", label: "需要核对" },
  ]);
  assert.ok(!JSON.stringify(report).includes("DO_NOT_EXPORT_TOKEN"));
  assert.equal(report.notes[0].text, "自己的假设");
});
test("empty evidence asks to establish facts and bounded collections stay bounded", () => {
  const empty = brief({ ...snapshot, clues: [] }, [], [], []);
  assert.equal(empty.questions[0].source, null);
  assert.match(empty.questions[0].text, /亲眼所见/);
  const huge = brief(
    snapshot,
    Array.from({ length: 200 }, (_, i) => ({
      id: "q" + i,
      scope: "mist",
      speaker: "人",
      phase: "章",
      text: "x".repeat(10000),
      mode: "模型",
    })),
    Array.from({ length: 30 }, (_, i) => ({
      id: "n" + i,
      text: "y".repeat(10000),
    })),
    [],
  );
  assert.equal(huge.testimony.length, 64);
  assert.equal(huge.testimony[0].text.length, 1800);
  assert.equal(huge.notes.length, 12);
  assert.equal(huge.notes[0].text.length, 800);
  const text = markdown(huge);
  assert.match(text, /角色说法（待核实）/);
  assert.ok(text.length < 140000);
});
