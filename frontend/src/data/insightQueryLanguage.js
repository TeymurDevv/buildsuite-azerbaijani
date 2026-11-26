// Search only: keep identifiers and original display strings on the report spec.
export const foldQuery = (value) =>
	String(value ?? "")
		.normalize("NFC")
		.toLowerCase()
		.replace(/ə/g, "e")
		.replace(/ı/g, "i")
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.replace(/[’‘]/g, "'")
		.replace(/[‐‑–—]/g, "-")
		.replace(/\s+/g, " ")
		.trim();

// Terms ending in a stem accept common inflections (tapşırıqları, layihələrin,
// alış sifarişlərini). Compound sources precede overlapping generic nouns.
const sourceTerms = {
	subBills: /\bsubpodratci[a-z]*\s+(?:hesab|faktura|odenis|akt)[a-z-]*/,
	bills: /\b(?:techizatci[a-z]*\s+(?:(?:odenis\s+)?ohdelik|hesab|faktura|xerc|borc|odenis)[a-z-]*|(?:alis|satinalma)\s+(?:hesab|faktura)[a-z-]*|kreditor\s+borc[a-z]*)/,
	purchaseOrders: /\b(?:satinalma|alis|tedaruk)\s+sifaris[a-z]*/,
	workOrders: /\b(?:(?:subpodratci[a-z]*\s+)?is|istehsal)\s+sifaris[a-z]*/,
	workPackages: /\bis\s+paket[a-z]*/,
	scos: /\b(?:(?:is\s+)?hecm[a-z]*|ehate[a-z]*)(?:\s+daires[a-z]*)?\s+deyis[a-z]*/,
	measurementBooks: /\bolcu\s+(?:jurnal|kitab|defter)[a-z]*/,
	progress:
		/\b(?:irelileyis|gedisat)(?:\s+(?:qeyd|hesabat)[a-z]*)?|\b(?:sahe|gundelik)\s+hesabat[a-z]*/,
	pettyCash:
		/\b(?:kicik\s+(?:xerc[a-z]*\s+)?(?:kassa|nagd)[a-z]*|nagd\s+avans[a-z]*|xirda\s+xerc[a-z]*)/,
	receiptLines:
		/\b(?:qebul\s+(?:edil[a-z]*|olun[a-z]*)\s+(?:mal|material|mehsul)[a-z]*|(?:mal|material)[a-z]*\s+qebul[a-z]*|mal\s+medaxil[a-z]*|teslimat[a-z]*|tehvil\s+(?:alin[a-z]*|qeyd[a-z]*))/,
	consumptionLines:
		/\b(?:(?:material|mal|xammal)[a-z]*\s+(?:serf|istehlak)[a-z]*|(?:serf|istehlak)\s+(?:edil[a-z]*|olun[a-z]*)\s+(?:material|mal)[a-z]*|serfiyyat[a-z]*)/,
	machineryUsage:
		/\b(?:(?:masin|texnika|avadanliq|avadanlig)[a-z]*\s+(?:istifade|saat|isi)[a-z-]*|masin[- ]saat[a-z]*)/,
	attendance: /\b(?:adam[- ]gun[a-z]*|davamiyyet[a-z]*|is\s+guc[a-z]*|insan[- ]gun[a-z]*)/,
	fieldEmployees: /\b(?:sahe\s+)?(?:emekdas|fehle|isci|heyet)[a-z]*/,
	items: /\b(?:(?:mal|material|mehsul)[a-z]*\s+(?:katalo[qg]|siyahi|kart)[a-z]*|nomenklatur[a-z]*)/,
	invoices:
		/\b(?:(?:satis\s+)?hesab[- ]faktura[a-z]*|faktura[a-z]*|gelir[a-z]*|debitor\s+borc[a-z]*)/,
	expenses: /\b(?:xerc|mesref)[a-z]*/,
	tasks: /\b(?:tapsiri[qg]|fealiyyet)[a-z]*/,
	stages: /\bmerhele[a-z]*/,
	projects: /\blayihe[a-z]*/,
};
const dimTerms = {
	state: "(?:tesdiq[a-z]* (?:veziyyet|status)|is axin[a-z]*|tesdiq)",
	status: "(?:status|veziyyet)",
	project: "(?:layihe|sahe)",
	company: "sirket",
	costType: "(?:xerc[a-z]* (?:nov|kateqoriya)|mesref[a-z]* nov|kateqoriya|xerc madd)",
	customer: "musteri",
	supplier: "techizatci",
	subcontractor: "subpodratci",
	group: "(?:mal|material)[a-z]* qrup",
	item: "(?:mal|material|mehsul)",
	month: "ay",
	priority: "(?:prioritet|ustunluk)",
	worker: "(?:isci|fehle|emekdas)",
	employee: "(?:isci|emekdas|odeyen)",
	holder: "(?:mesul sexs|sahib)",
	machine: "(?:masin|texnika|avadanli[qg])",
	contractor: "podratci",
	trade: "(?:pese|ixtisas)",
	uom: "(?:olcu vahid|vahid)",
	blocker: "(?:manee|engel)",
	type: "nov",
};
const grouping = Object.entries(dimTerms).map(([key, term]) => [
	key,
	new RegExp(
		"\\b" + term + "[a-z]*\\s+(?:uzre|gore|esasinda|kesiminde|baz[ai]nda|sirasinda)\\b"
	),
]);

export function readAz(text) {
	let sourceText = text;
	const dims = [];
	for (const [dim, pattern] of grouping) {
		if (!pattern.test(sourceText)) continue;
		dims.push(dim);
		sourceText = sourceText.replace(pattern, " ");
	}
	if (/\b(?:ayliq|aybeay|her ay)\b/.test(text)) dims.push("month");
	// Named project locatives specify a scope rather than the report's dataset.
	const content = sourceText.replace(/\blayihe(?:sinde|sinin|sine|sinden)\b/g, " ");
	const source = Object.entries(sourceTerms)
		.map(([key, re]) => [key, re.exec(content)?.[0]])
		.filter(([, match]) => match)
		.sort((a, b) => b[1].length - a[1].length)[0]?.[0];
	return {
		source,
		dims,
		sourceText,
		list: /\b(?:siyahi[a-z]*|sadala[a-z]*|etrafl[i]|hansi|setir-setir)\b/.test(text),
		summary: /\b(?:icmal|umumilesdir[a-z]*|xulase|qruplasdir[a-z]*)\b/.test(text),
		viz: /\b(?:dairevi|halqa[a-z]*|pasta|paylanma)[a-z]*\b/.test(text)
			? "donut"
			: /\b(?:xett[i]|xetle|dinamika|trend)\b/.test(text)
			? "line"
			: /\b(?:sutun[a-z]*|saquli)\b/.test(text)
			? "column"
			: /\b(?:ufuqi|cubuq[a-z]*|zolaq[a-z]*)\b/.test(text)
			? "bar"
			: /\bcedvel[a-z]*\b/.test(text)
			? "table"
			: /\b(?:tek reqem|tek gosterici|nece eded|ne qeder|nece dene|cem[il]?|nece|necedir)\b/.test(
					text
			  )
			? "kpi"
			: null,
		measure: /\b(?:say[i]?|sayini|sayi[a-z]*|nece dene|nece eded|nece)\b/.test(text)
			? "count"
			: /\b(?:mebleg|deyer|qiymet|budce|gelir|pul|maya deyer)[a-z]*\b/.test(text)
			? "amount"
			: /\b(?:adam[- ]gun|insan[- ]gun)[a-z]*\b/.test(text)
			? "mandays"
			: /\b(?:miqdar|hecm|saat|ne qeder material)[a-z]*\b/.test(text)
			? "qty"
			: null,
	};
}

const localISO = (date) =>
	[date.getFullYear(), date.getMonth() + 1, date.getDate()]
		.map((n, i) => (i ? String(n).padStart(2, "0") : String(n)))
		.join("-");
const namedMonths =
	"yanvar fevral mart aprel may iyun iyul avqust sentyabr oktyabr noyabr dekabr".split(" ");
const numericDate = /\b(?:\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4})\b/g;
function asISO(value) {
	const [y, m, d] = value.includes(".") ? value.split(".").reverse() : value.split("-");
	const date = new Date(+y, +m - 1, +d);
	return localISO(date) === [y, m, d].join("-") ? localISO(date) : null;
}
export function queryDates(text, today = new Date()) {
	const y = today.getFullYear(),
		m = today.getMonth(),
		day = today.getDate();
	const at = (year, month, d) => localISO(new Date(year, month, d));
	const end = localISO(today),
		range = (from, to) => ({ from, to });
	const dates = [...text.matchAll(numericDate)].map((m) => asISO(m[0]));
	if (dates.length === 2 && dates.every(Boolean) && dates[0] <= dates[1]) return range(...dates);
	if (dates.length === 1 && dates[0]) {
		if (/\b(?:since|from|sonra|etibaren|baslayaraq)\b/.test(text))
			return range(dates[0], null);
		if (/\b(?:before|until|to|evvel|qeder)\b/.test(text)) return range(null, dates[0]);
		return range(dates[0], dates[0]);
	}
	const month = namedMonths.findIndex((name) =>
		new RegExp("\\b" + name + "(?:inda|inde|unda|unde|da|de|ta|te|in|un|i|u)?\\b").test(text)
	);
	if (month !== -1) {
		const year = +(text.match(/\b(?:19|20)\d{2}\b/)?.[0] || y);
		return range(at(year, month, 1), at(year, month + 1, 0));
	}
	if (/\b(?:today|bu gun|bugun)\b/.test(text)) return range(end, end);
	if (/\b(?:yesterday|dunen)\b/.test(text)) return range(at(y, m, day - 1), at(y, m, day - 1));
	if (/\b(?:last month|kecen ay|oten ay|evvelki ay)\b/.test(text))
		return range(at(y, m - 1, 1), at(y, m, 0));
	if (/\b(?:this month|bu ay|cari ay)\b/.test(text)) return range(at(y, m, 1), end);
	if (/\b(?:last year|kecen il|oten il)\b/.test(text))
		return range(at(y - 1, 0, 1), at(y - 1, 11, 31));
	if (/\b(?:this year|ytd|bu il|cari il)\b/.test(text)) return range(at(y, 0, 1), end);
	const weekday = (today.getDay() + 6) % 7;
	if (/\b(?:last week|kecen hefte|oten hefte)\b/.test(text))
		return range(at(y, m, day - weekday - 7), at(y, m, day - weekday - 1));
	if (/\b(?:this week|bu hefte)\b/.test(text)) return range(at(y, m, day - weekday), end);
	const q = 3 * Math.floor(m / 3);
	if (/\b(?:last quarter|kecen rub|oten rub)\b/.test(text))
		return range(at(y, q - 3, 1), at(y, q, 0));
	if (/\b(?:this quarter|bu rub|cari rub)\b/.test(text)) return range(at(y, q, 1), end);
	const yearOnly = text.match(/\b((?:19|20)\d{2})(?:-?(?:ci|cu))?\s+il(?:de|inde|in)?\b/);
	if (yearOnly) return range(at(+yearOnly[1], 0, 1), at(+yearOnly[1], 11, 31));
	const rolling = text.match(/\b(?:last|past|son) (\d{1,3})(?:\s*(?:gun|days?))?\b/);
	const days = rolling
		? Number(rolling[1])
		: /\bpast week\b/.test(text)
		? 7
		: /\bpast month\b/.test(text)
		? 30
		: /\bquarter\b/.test(text)
		? 90
		: 0;
	return days ? range(at(y, m, day - days + 1), end) : null;
}

export function numericLimits(text) {
	const out = {};
	const numbers = String.raw`(\d+(?:(?:[.,]\d+)|(?:[ \u00a0]\d{3}\b))*)`;
	const az = new RegExp(
		numbers +
			String.raw`\s*(min|milyon)?\s*(?:azn|manat|₼)?\s*[-'’]?(?:dan|den|tan|ten)\s+(cox|yuxari|boyuk|artiq|az|asagi|kicik)`,
		"g"
	);
	for (const m of text.matchAll(az)) {
		const v =
			Number(
				m[1]
					.replace(/\s/g, "")
					.replace(/\.(?=\d{3}(?:[.,]|$))/g, "")
					.replace(",", ".")
			) * (m[2] === "min" ? 1000 : m[2] === "milyon" ? 1e6 : 1);
		if (Number.isFinite(v)) {
			const k = ["az", "asagi", "kicik"].includes(m[3]) ? "max" : "min";
			out[k] = v;
			out[k + "Exclusive"] = true;
		}
	}
	const english = new RegExp(
		String.raw`\b(over|above|more than|greater than|exceeding|under|below|less than|up to|at least|at most|en azi|en coxu)\s*[₹₦₼$]?\s*` +
			numbers +
			String.raw`(?:\s+(lakh|crore|min|milyon)\b)?`,
		"g"
	);
	for (const m of text.matchAll(english)) {
		const raw = m[1].startsWith("en ")
			? m[2].replace(/\.(?=\d{3}(?:[.,]|$))/g, "").replace(",", ".")
			: m[2].replaceAll(",", "");
		const v =
			Number(raw.replace(/\s/g, "")) *
			({ lakh: 1e5, crore: 1e7, min: 1e3, milyon: 1e6 }[m[3]] || 1);
		if (Number.isFinite(v)) {
			const k = ["under", "below", "less than", "up to", "at most", "en coxu"].includes(m[1])
				? "max"
				: "min";
			out[k] = v;
			out[k + "Exclusive"] = !["up to", "at least", "at most", "en azi", "en coxu"].includes(
				m[1]
			);
		}
	}
	return out;
}
