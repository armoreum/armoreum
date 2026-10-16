import assert from "node:assert/strict";
import test from "node:test";
import { copyTextToClipboard } from "./copy-to-clipboard.ts";

function createDocument(execCommandResult = true) {
  const state = { appended: false, removed: false, copiedCommand: null, field: null };
  const doc = {
    body: {
      appendChild(field) {
        state.appended = true;
        state.field = field;
      },
    },
    createElement(tagName) {
      assert.equal(tagName, "textarea");
      return {
        value: "",
        style: {},
        readOnly: false,
        tabIndex: 0,
        setAttribute() {},
        focus() {},
        select() {},
        setSelectionRange() {},
        remove() {
          state.removed = true;
        },
      };
    },
    execCommand(command) {
      state.copiedCommand = command;
      return execCommandResult;
    },
  };
  return { document: doc, state };
}

test("uses the browser clipboard when it succeeds", async () => {
  const writes = [];
  await copyTextToClipboard("token address", {
    clipboard: { writeText: async (value) => writes.push(value) },
    document: null,
  });
  assert.deepEqual(writes, ["token address"]);
});

test("falls back to a selected textarea when the browser clipboard is unavailable or denied", async () => {
  const { document, state } = createDocument();
  await copyTextToClipboard("creator key", {
    clipboard: { writeText: async () => { throw new Error("permission denied"); } },
    document,
  });
  assert.equal(state.appended, true);
  assert.equal(state.field.value, "creator key");
  assert.equal(state.copiedCommand, "copy");
  assert.equal(state.removed, true);
});

test("uses the textarea fallback when the Clipboard API is not present", async () => {
  const { document, state } = createDocument();
  await copyTextToClipboard("deposit address", { clipboard: null, document });
  assert.equal(state.field.value, "deposit address");
  assert.equal(state.copiedCommand, "copy");
  assert.equal(state.removed, true);
});

test("reports failure instead of claiming Copied when both methods fail", async () => {
  const { document, state } = createDocument(false);
  await assert.rejects(
    copyTextToClipboard("token address", { clipboard: null, document }),
    /Copy failed/,
  );
  assert.equal(state.removed, true);
});
