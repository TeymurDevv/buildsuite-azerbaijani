import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { parseFrappeError } from "../src/utils/frappeError.js";
import {
  outOfParentBoundsIssue,
  outOfParentBoundsError,
} from "../src/utils/dateBounds.js";
import { standardLinkLabel } from "../src/utils/translate.js";

const original = globalThis.window;
afterEach(() => {
  if (original === undefined) delete globalThis.window;
  else globalThis.window = original;
});

test("date errors point to the original field in either language", () => {
  globalThis.window = {
    lang: "az",
    translated_messages: {
      "Start date ({0}) can't be before the {1} start date ({2}).":
        "Başlama tarixi ({0}) layihənin başlama tarixindən ({2}) əvvəl ola bilməz.",
    },
  };
  const dates = ["2026-05-01", "2026-05-10", "2026-05-03", "2026-05-30"];
  const start = outOfParentBoundsIssue(...dates);
  assert.equal(start.field, "start");
  assert.match(start.message, /^Başlama/);
  assert.equal(outOfParentBoundsError(...dates), start.message);
  assert.equal(
    outOfParentBoundsIssue("2026-05-05", "2026-06-01", ...dates.slice(2)).field,
    "end"
  );
  assert.equal(
    outOfParentBoundsError("2026-05-05", "2026-05-10", ...dates.slice(2)),
    ""
  );
});

test("mandatory-field errors keep API keys and translate the labels and summary", () => {
  globalThis.window = {
    translated_messages: {
      Company: "Şirkət",
      "Start Date": "Başlama tarixi",
      "{0} is required": "{0} tələb olunur",
      "Required: {0}": "Doldurulmalı sahələr: {0}",
    },
  };
  const result = parseFrappeError({
    exc_type: "MandatoryError",
    exc: "MandatoryError: [Project, DEMO]: company, expected_start_date",
  });
  assert.deepEqual(result.fieldErrors, {
    company: "Şirkət tələb olunur",
    expected_start_date: "Başlama tarixi tələb olunur",
  });
  assert.equal(result.summary, "Doldurulmalı sahələr: Şirkət, Başlama tarixi");
});

test("a custom name matching an English label survives unit and task display lookup", () => {
  globalThis.window = {
    standard_link_labels: { UOM: { Nos: "Nos" } },
    translated_messages: { Nos: "Say", Open: "Açıq" },
  };
  assert.equal(standardLinkLabel("UOM", "Nos"), "Say");
  assert.equal(standardLinkLabel("UOM", "Open"), "Open");
  assert.equal(standardLinkLabel("Task Type", "LOCAL-1", "Open"), "Open");
});
