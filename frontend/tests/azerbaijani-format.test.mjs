import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { currencySymbol, fmtCompactCurrency, fmtCurrency, fmtDate, getDisplayCurrency, setDisplayCurrency } from "../src/utils/format.js";
import { displayLocale, fixedNumber } from "../src/utils/locale.js";
import { endBeforeStartError } from "../src/utils/dateBounds.js";

const originalWindow = globalThis.window;
const originalCurrency = getDisplayCurrency();

afterEach(() => {
	if (originalWindow === undefined) delete globalThis.window;
	else globalThis.window = originalWindow;
	setDisplayCurrency(originalCurrency);
});

test("Azerbaijani script and region codes use Latin formatting and company currency", () => {
	for (const lang of ["az", "az-Latn", "az-AZ", "az_Latn_AZ", "az-latn"]) {
		globalThis.window = { lang, sysdefaults: { currency_precision: 2 } };
		assert.equal(displayLocale("en-IN"), "az-Latn-AZ");
		assert.equal(fixedNumber(12.5, 2), "12,50");
		for (const code of ["AZN", "INR", "USD"]) {
			setDisplayCurrency(code);
			const expected = new Intl.NumberFormat("az-Latn-AZ", {
				style: "currency", currency: code, currencyDisplay: "narrowSymbol",
				minimumFractionDigits: 2, maximumFractionDigits: 2,
			});
			assert.equal(fmtCurrency(1234567.89), expected.format(1234567.89));
			assert.equal(currencySymbol(), expected.formatToParts(0).find(part => part.type === "currency").value);
			const compact = new Intl.NumberFormat("az-Latn-AZ", {
				style: "currency", currency: code, currencyDisplay: "narrowSymbol",
				notation: "compact", maximumFractionDigits: 1,
			});
			assert.equal(fmtCompactCurrency(1250000), compact.format(1250000));
		}
	}
});

test("unrelated languages retain their original number and currency formatting", () => {
	for (const lang of ["en", "fr", "hi", "az-Cyrl", "az-Arab"]) {
		globalThis.window = { lang };
		assert.equal(displayLocale("en-GB"), "en-GB");
		assert.equal(displayLocale(), undefined);
		assert.equal(fixedNumber(12.5, 2), "12.50");
		assert.equal(fmtCurrency(1234567.89, "INR"), "₹12,34,567.89");
		assert.equal(fmtCurrency(1234567.89, "USD"), "$1,234,567.89");
	}
});

test("Azerbaijani date-only fields keep the calendar day west of UTC", () => {
	const originalTimezone = process.env.TZ;
	try {
		process.env.TZ = "America/Los_Angeles";
		globalThis.window = { lang: "az-AZ" };
		const dateOptions = { day: "2-digit", month: "short", year: "numeric" };
		const day = new Date(2026, 10, 1).toLocaleDateString("az-Latn-AZ", dateOptions);
		assert.equal(fmtDate("2026-11-01"), day);
		assert.equal(fmtDate(null), "—");
	} finally {
		if (originalTimezone === undefined) delete process.env.TZ;
		else process.env.TZ = originalTimezone;
	}
});

test("validation uses the boot catalogue and substitutes localized dates", () => {
	const source = "End date ({0}) can't be earlier than the start date ({1}).";
	globalThis.window = { lang: "az", translated_messages: {
		[source]: "Bitmə tarixi ({0}) başlama tarixindən ({1}) əvvəl ola bilməz.",
	} };
	const message = endBeforeStartError("2026-11-02", "2026-11-01");
	assert.equal(message, `Bitmə tarixi (${fmtDate("2026-11-01")}) başlama tarixindən (${fmtDate("2026-11-02")}) əvvəl ola bilməz.`);
	assert.equal(endBeforeStartError("2026-11-01", "2026-11-02"), "");
});

test("Azerbaijani labels and separators survive Chromium builds missing locale data", async () => {
	// Model Chrome accepting "az" while returning root-locale data during feature detection.
	const originalDateFormat = Intl.DateTimeFormat;
	const originalNumberFormat = Intl.NumberFormat;
	let locale;
	try {
		Intl.DateTimeFormat = class extends originalDateFormat {
			constructor(tag, options) { super(tag === "az-Latn-AZ" ? "en-US" : tag, options); }
		};
		Intl.NumberFormat = class extends originalNumberFormat {
			constructor(tag, options) { super(tag === "az-Latn-AZ" ? "en-US" : tag, options); }
		};
		locale = await import("../src/utils/locale.js?incomplete-icu");
	} finally {
		Intl.DateTimeFormat = originalDateFormat;
		Intl.NumberFormat = originalNumberFormat;
	}
	globalThis.window = { lang: "az-AZ" };
	const date = new Date(2026, 10, 1, 13, 3, 7);
	assert.equal(locale.calendarDate(date, "en-IN", {
		day: "2-digit", month: "short", year: "numeric", weekday: "long",
	}), "01 noy 2026, bazar");
	assert.equal(locale.calendarDateTime(date, undefined, {
		dateStyle: "medium", timeStyle: "short",
	}), "1 noy 2026, 13:03");
	assert.equal(locale.calendarDateTime(date), "01.11.2026, 13:03:07");
	assert.equal(locale.fixedNumber(12.5, 2), "12,50");
	assert.equal((1234567.8).toLocaleString(locale.numberLocale()), "1.234.567,8");
	assert.equal(locale.compactNumber(1250000), "1,3\u00a0mln");
	assert.equal(locale.compactNumber(-1250000, "en-IN", "INR"), "-1,3\u00a0mln\u00a0₹");
});
