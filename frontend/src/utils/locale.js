import { currentLang } from "./translate.js";

const AZ = "az-Latn-AZ";
const incompleteDates = new Intl.DateTimeFormat(AZ, { month: "long" })
	.format(new Date(2024, 0, 15)) !== "yanvar";
const incompleteNumbers = new Intl.NumberFormat(AZ).format(1234.5) !== "1.234,5";

// Some Chromium builds accept az but ship root-locale data ("M01", decimal point).
// These are the Azerbaijani CLDR names for the calendar fields displayed by the app.
const months = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"];
const shortMonths = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avq", "sen", "okt", "noy", "dek"];
const weekdays = ["bazar", "bazar ertəsi", "çərşənbə axşamı", "çərşənbə", "cümə axşamı", "cümə", "şənbə"];
const two = n => String(n).padStart(2, "0");

export function displayLocale(fallback) {
	const tag = currentLang().replace(/_/g, "-");
	return /^az(?:-Latn)?(?:-AZ)?$/i.test(tag) ? AZ : fallback;
}

export function calendarDate(date, fallback, options = {}) {
	const locale = displayLocale(fallback);
	if (locale !== AZ || !incompleteDates || Number.isNaN(date.getTime())) {
		return date.toLocaleDateString(locale, options);
	}
	if (!options.day && !options.month && !options.year && !options.weekday) {
		return [two(date.getDate()), two(date.getMonth() + 1), date.getFullYear()].join(".");
	}
	const parts = [];
	if (options.day) parts.push(options.day === "2-digit" ? two(date.getDate()) : date.getDate());
	if (options.month) parts.push((options.month === "long" ? months : shortMonths)[date.getMonth()]);
	if (options.year) parts.push(options.year === "2-digit" ? two(date.getFullYear() % 100) : date.getFullYear());
	const fields = parts.join(" ");
	return options.weekday ? [fields, weekdays[date.getDay()]].filter(Boolean).join(", ") : fields;
}

export function calendarDateTime(date, fallback, options) {
	const locale = displayLocale(fallback);
	if (locale !== AZ || !incompleteDates || Number.isNaN(date.getTime())) {
		return date.toLocaleString(locale, options);
	}
	const dateOptions = options?.dateStyle === "medium" ? { day: "numeric", month: "short", year: "numeric" } : {};
	const time = [two(date.getHours()), two(date.getMinutes())];
	if (options?.timeStyle !== "short") time.push(two(date.getSeconds()));
	return calendarDate(date, locale, dateOptions) + ", " + time.join(":");
}

export function numberLocale(fallback) {
	const locale = displayLocale(fallback);
	// Standard grouped decimals and narrow currency patterns match in these two locales.
	return locale === AZ && incompleteNumbers ? "de-DE" : locale;
}

export function compactNumber(value, fallback, currency) {
	const locale = displayLocale(fallback);
	const options = { notation: "compact", maximumFractionDigits: 1 };
	const money = currency ? { style: "currency", currency, currencyDisplay: "narrowSymbol" } : {};
	if (locale !== AZ || !incompleteNumbers) {
		return new Intl.NumberFormat(locale, { ...options, ...money }).format(value);
	}
	const units = { K: "K", M: "\u00a0mln", B: "\u00a0mlrd", T: "\u00a0trln" };
	const compact = new Intl.NumberFormat("en-US", options).formatToParts(value).map(part => {
		if (part.type === "compact") return units[part.value] || part.value;
		if (part.type === "decimal") return ",";
		if (part.type === "group") return ".";
		return part.value;
	}).join("");
	if (!currency) return compact;
	const symbol = new Intl.NumberFormat(numberLocale(), money).formatToParts(0)
		.find(part => part.type === "currency").value;
	return compact + "\u00a0" + symbol;
}

// Display only. Keep decimal points in API values, CSS and SVG coordinates.
export function fixedNumber(value, digits) {
	const number = Number(value);
	const locale = numberLocale();
	return locale
		? number.toLocaleString(locale, {
				useGrouping: false,
				minimumFractionDigits: digits,
				maximumFractionDigits: digits,
		  })
		: number.toFixed(digits);
}
