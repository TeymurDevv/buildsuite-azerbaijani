import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_PRESETS,
  SUGGESTIONS,
  DATASETS,
  availablePresets,
  describeSpec,
  parsePrompt,
  refineWithStore,
  runSpec,
} from "../src/data/insightEngine.js";
import { queryDates } from "../src/data/insightQueryLanguage.js";

const store = new Proxy(
  {
    projects: [{ id: "P1", name: "Şəki Korpusu", code: "ŞK01" }],
    rootProjects: [],
    tasks: [
      {
        name: "T1",
        subject: "Open",
        project: "P1",
        task_status: "Completed",
        priority: "High",
        exp_end_date: "2026-10-01",
      },
      {
        name: "T2",
        subject: "İş sahəsi",
        project: "P1",
        task_status: "Open",
        priority: "Low",
        exp_end_date: "2026-02-01",
      },
    ],
    projectById: (id) => (id === "P1" ? { name: "Şəki Korpusu" } : null),
    bills: [
      { supplier: "Əhməd MMC", grand_total: 1500.5 },
      { supplier: "Open", grand_total: 2500.5 },
    ],
  },
  {
    get: (obj, key) =>
      key in obj ? obj[key] : String(key).startsWith("canRead") ? true : [],
  }
);
const fields = (spec) => [
  spec?.source,
  spec?.measure,
  spec?.dimension,
  spec?.viz,
  spec?.mode,
];

test("free-form reporting understands Azerbaijani morphology, letters and ASCII keyboards", () => {
  for (const [prompt, want] of [
    [
      "İş paketlərinin büdcəsini layihələr üzrə göstər",
      ["workPackages", "amount", "project", "bar", "aggregate"],
    ],
    [
      "Tapşırıqların sayını vəziyyətə görə dairəvi diaqramda göstər",
      ["tasks", "count", "status", "donut", "aggregate"],
    ],
    [
      "BU AY ADAM-GÜNLƏRİ LAYİHƏLƏR ÜZRƏ GÖSTƏR",
      ["attendance", "mandays", "project", "bar", "aggregate"],
    ],
    [
      "Satis hesab-fakturalarinin meblegini aylar uzre goster",
      ["invoices", "amount", "month", "line", "aggregate"],
    ],
    [
      "Keçən ay qəbul edilmiş malları siyahıya al",
      ["receiptLines", "qty", "item", "bar", "list"],
    ],
    [
      "Təchizatçı hesablarının məbləğini təchizatçı üzrə göstər, ilk 8",
      ["bills", "amount", "supplier", "bar", "aggregate"],
    ],
    [
      "Noyabrda nə qədər material sərf edilib?",
      ["consumptionLines", "qty", "item", "kpi", "aggregate"],
    ],
    [
      "Quantities of items received by item",
      ["receiptLines", "qty", "item", "bar", "aggregate"],
    ],
  ])
    assert.deepEqual(fields(parsePrompt(prompt, store)), want, prompt);
});
test("every dataset has an Azerbaijani entry point and exposed sources stay gated", () => {
  const names = [
    "layihələr",
    "tapşırıqlar",
    "mərhələlər",
    "subpodratçı hesabları",
    "satınalma sifarişləri",
    "irəliləyiş qeydləri",
    "iş paketləri",
    "iş həcmi dəyişiklikləri",
    "iş sifarişləri",
    "ölçü jurnalları",
    "satış hesab-fakturaları",
    "təchizatçı hesabları",
    "xərclər",
    "kiçik xərclər kassası",
    "davamiyyət",
    "malların qəbulu",
    "material sərfi",
    "mal kataloqu",
    "texnikanın istifadəsi",
    "sahə əməkdaşları",
  ];
  assert.deepEqual(
    names.map((name) => parsePrompt(name, store)?.source),
    Object.keys(DATASETS)
  );
  const denied = new Proxy(store, {
    get(obj, key) {
      return key === "canReadBills" ? false : obj[key];
    },
  });
  assert.equal(
    parsePrompt("Təchizatçı hesabları layihələr üzrə", denied),
    null
  );
  const en = parsePrompt("supplier bill value by supplier", store);
  assert.equal(runSpec(en, denied), null);
  assert.equal(refineWithStore(en, "ilk 5", denied), null);
  assert(!availablePresets(denied).some((p) => p.spec.source === "bills"));
  assert(SUGGESTIONS.every((s) => DATASETS[s.source]));
});
test("presets, explicit name and raw enum matching, refinement and unknown requests", () => {
  for (const p of ALL_PRESETS)
    assert.equal(parsePrompt(p.prompt, store)?.source, p.spec.source, p.prompt);
  assert.equal(parsePrompt("salam, hava necədir?", store), null);
  const spec = parsePrompt(
    "Şəki Korpusu layihəsində tamamlanmış tapşırıqları sadala",
    store
  );
  assert.equal(spec.filters.project, "P1");
  assert.equal(spec.filters.values.status, "Completed");
  assert.deepEqual(
    runSpec(spec, store).records.map((r) => r.name),
    ["Open"]
  );
  const chart = refineWithStore(
    spec,
    "aylara görə qruplaşdır, ilk 2, sütunlu diaqram",
    store
  );
  assert.equal(chart.limit, 2);
  assert.equal(chart.dimension, "month");
  assert.equal(chart.viz, "column");
  assert.equal(chart.mode, "aggregate");
  const cleared = refineWithStore(chart, "filtrləri təmizlə", store);
  assert.deepEqual(cleared.filters, {});
  const unlimit = refineWithStore(cleared, "bütün sətirləri göstər", store);
  assert.equal(unlimit.limit, null);
  assert.equal(refineWithStore(cleared, "mənasız söz", store), null);
  const changes = refineWithStore(cleared, "keçən ay", store);
  assert(changes.filters.from);
  assert(changes.filters.to);
});
test("a known but absent status returns no matches, not all records", () => {
  const report = parsePrompt("Gecikən tapşırıqları siyahıya al", store);
  assert.equal(report.filters.values.status, "Overdue");
  assert.equal(runSpec(report, store).recordCount, 0);
  const ranking = parsePrompt("Tapşırıqlar status üzrə, ən yüksək 5", store);
  assert.equal(ranking.filters.values?.priority, undefined);
});

test("calendar periods are inclusive local dates and differ from rolling windows", () => {
  const end = new Date(2026, 0, 3);
  const dates = (prompt) => queryDates(prompt, end);
  assert.deepEqual(dates("kecen ay"), { from: "2025-12-01", to: "2025-12-31" });
  assert.deepEqual(dates("this month"), {
    from: "2026-01-01",
    to: "2026-01-03",
  });
  assert.deepEqual(dates("son 7 gun"), {
    from: "2025-12-28",
    to: "2026-01-03",
  });
  assert.deepEqual(dates("2024-cu ilin fevralinda"), {
    from: "2024-02-01",
    to: "2024-02-29",
  });
  assert.deepEqual(dates("01.05.2025 - 26.05.2025"), {
    from: "2025-05-01",
    to: "2025-05-26",
  });
});
test("thresholds accept AZ punctuation, preserve exclusivity and compare raw numbers", () => {
  const spec = parsePrompt("Təchizatçı hesablarını siyahıya al", store);
  for (const q of ["1.500,50 manatdan çox", "over 1,500.50"]) {
    const next = refineWithStore(spec, q, store);
    assert.equal(next.filters.min, 1500.5);
    assert.equal(next.filters.minExclusive, true);
    assert.equal(runSpec(next, store).recordCount, 1);
  }
  assert.equal(
    runSpec(refineWithStore(spec, "ən azı 1.500,50", store), store).recordCount,
    2
  );
});
test("chronology, chips and headings localize without mutating business values", () => {
  globalThis.window = {
    lang: "az",
    translated_messages: {
      Tasks: "Tapşırıqlar",
      Status: "Vəziyyət",
      Count: "Say",
      Open: "Açıq",
      Month: "Ay",
      "{0}: {1} by {2}": "{0}: {2} üzrə {1}",
    },
  };
  try {
    const spec = parsePrompt("Tapşırıqlar aylar üzrə", store);
    const report = runSpec(spec, store);
    assert.deepEqual(
      report.rows.map((r) => r.label),
      ["fev 2026", "okt 2026"]
    );
    assert.equal(report.dimensionLabel, "Ay");
    assert.equal(describeSpec(spec), "Tapşırıqlar: Ay üzrə Say");
    const status = runSpec(
      parsePrompt("Tapşırıqlar status üzrə", store),
      store
    );
    assert(status.rows.some((r) => r.label === "Açıq"));
    const suppliers = runSpec(
      parsePrompt("Təchizatçı hesabları təchizatçı üzrə", store),
      store
    );
    assert(suppliers.rows.some((r) => r.label === "Open"));
  } finally {
    delete globalThis.window;
  }
});
