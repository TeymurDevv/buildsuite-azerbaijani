import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { usePagination } from "../src/composables/usePagination.js";
import {
  recordCountLabel,
  templateTaskSubject,
} from "../src/utils/translate.js";

const original = globalThis.window;
afterEach(() => {
  if (original === undefined) delete globalThis.window;
  else globalThis.window = original;
});

test("list counts handle an empty page, an unknown total and paginated results in either language", () => {
  globalThis.window = {
    translated_messages: {
      "{0} records": "{0} qeyd",
      "{0}-{1} records": "{0}–{1} aralığındakı qeydlər",
      "{0}-{1} of {2} records": "{2} qeyddən {0}–{1}",
    },
  };
  assert.equal(recordCountLabel(0, 0, 0), "0 qeyd");
  const empty = usePagination([]);
  assert.equal(
    recordCountLabel(empty.rangeStart, empty.rangeEnd, empty.totalRows),
    "0 qeyd"
  );
  assert.equal(recordCountLabel(1, 8), "1–8 aralığındakı qeydlər");
  assert.equal(recordCountLabel(11, 20, 25), "25 qeyddən 11–20");
  globalThis.window.translated_messages = {};
  assert.equal(recordCountLabel(11, 20, 25), "11-20 of 25 records");
});

test("only explicitly translated template task names receive a display label", () => {
  globalThis.window = {
    translated_messages: {
      "Painting:Project template task": "Boyaq işləri",
      Open: "Açıq",
    },
  };
  assert.equal(templateTaskSubject("Painting", 1), "Boyaq işləri");
  assert.equal(templateTaskSubject("Painting", 0), "Painting");
  assert.equal(templateTaskSubject("Open", 1), "Open");
});
