import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import { loadMbtiTalkData } from "./data";
import { SLIDES } from "../story";

// Node checks markup; browser QA checks the real CSS and keyboard interactions.
const require = createRequire(import.meta.url);
const previousCssLoader = require.extensions[".css"];
require.extensions[".css"] = (module) => { module.exports = {}; };
const { MbtiPanel } = require("./MbtiPanel") as typeof import("./MbtiPanel");
if (previousCssLoader) require.extensions[".css"] = previousCssLoader;
else delete require.extensions[".css"];

test("the gallery shows all 47 model cards with exact shares and explicit unstable labels", async () => {
  const data = await loadMbtiTalkData();
  const html = renderToStaticMarkup(<MbtiPanel data={data} view="gallery" />);
  assert.equal((html.match(/data-stable="true"/g) ?? []).length, 37);
  assert.equal((html.match(/data-stable="false"/g) ?? []).length, 10);
  for (const model of data.models) {
    const share = `${Number((model.modalCount / model.n * 100).toFixed(2))}%`;
    assert.ok(html.includes(`${model.modalCount}/${model.n}，${share}`), model.name);
    assert.ok(html.includes(model.name), model.name);
  }
  assert.ok(html.includes("不是人格置信度"));
  assert.equal(SLIDES.filter((s) => s.id === "mbti-gallery" && s.view === "gallery").length, 1);
});

test("the distribution view stacks only stable models over all 16 types", async () => {
  const data = await loadMbtiTalkData();
  const html = renderToStaticMarkup(<MbtiPanel data={data} view="distribution" />);
  const stable = data.models.filter((m) => m.status === "stable");
  assert.equal((html.match(/aria-label="[^"]*，稳定 (?:INTJ|ISTJ)，\d+\/16 次"/g) ?? []).length, stable.length);
  for (const model of data.models) assert.equal(html.includes(`title="${model.name}"`), model.status === "stable", model.name);
  for (const type of ["INTJ", "INTP", "ENFP", "ISTJ", "ESFP"]) assert.ok(html.includes(`<b>${type}</b>`), type);
  assert.ok(html.includes("INTJ 25 款") && html.includes("ISTJ 12 款"));
});

test("MBTI scenes follow method → stability → overview → distribution → gallery", () => {
  const order = SLIDES.filter((s) => s.kind === "mbti").map((s) => s.view);
  assert.deepEqual(order, ["method", "stability", "overview", "distribution", "gallery", "explorer", "dimensions"]);
});

test("all MBTI views render under the majority-only classification contract", async () => {
  const data = await loadMbtiTalkData();
  for (const view of ["method", "overview", "distribution", "explorer", "stability", "dimensions"] as const) {
    const html = renderToStaticMarkup(<MbtiPanel data={data} view={view} />);
    assert.ok(html.includes(`data-mbti-view="${view}"`));
    assert.ok(!html.includes("双重门槛"));
    assert.ok(!html.includes("每一维都必须达标"));
  }
  const stability = renderToStaticMarkup(<MbtiPanel data={data} view="stability" />);
  assert.ok(stability.includes("56.25%"));
  assert.ok(stability.includes("50%"));
  assert.ok(stability.includes("恰好半数，不是严格多数"));
  assert.match(SLIDES.find((s) => s.id === "mbti-mirror")!.note, /缓存影响尚未排除/);
});
