import assert from "node:assert/strict";
import { __testing } from "../services/ai/assistant";

const { isExplicitQuestion, looksIrrelevant, isSmokeTestMessage } = __testing;

const samples = [
  "hello",
  "привет",
  "ok",
  "thanks",
  "тест smoke",
];

for (const sample of samples) {
  assert.equal(isExplicitQuestion(sample), false, `Expected "${sample}" to be non-question`);
  assert.equal(looksIrrelevant(sample, "test reply"), false, `Expected "${sample}" to skip relevance check`);
}

assert.equal(isSmokeTestMessage("Тест smoke"), true, "Expected smoke test detection");
assert.equal(isSmokeTestMessage("smoke test"), true, "Expected smoke test detection for English");
assert.equal(isSmokeTestMessage("hello world"), false, "Expected non-smoke for greeting");

// eslint-disable-next-line no-console
console.log("assistant.selfcheck: OK");
