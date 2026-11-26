// Frappe uses Air Datepicker for Desk forms and reports. Its supplied locales
// omit Azerbaijani. Register the labels before Frappe constructs its controls.
(() => {
	const lang = window.frappe?.boot?.lang;
	const azerbaijani = /^az(?:[-_]Latn)?(?:[-_]AZ)?$/i;
	if (!azerbaijani.test(lang || "")) return;

	const calendar = {
		days: ["bazar", "bazar ertəsi", "çərşənbə axşamı", "çərşənbə", "cümə axşamı", "cümə", "şənbə"],
		daysShort: ["baz", "baz ert", "çər ax", "çər", "cüm ax", "cüm", "şən"],
		daysMin: ["B.", "B.e.", "Ç.a.", "Ç.", "C.a.", "C.", "Ş."],
		months: ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"],
		monthsShort: ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avq", "sen", "okt", "noy", "dek"],
		today: "Bu gün",
		clear: "Təmizlə",
		dateFormat: "dd.mm.yyyy",
		timeFormat: "hh:ii",
		firstDay: 1,
	};
	const languages = window.jQuery?.fn?.datepicker?.language;
	if (!languages) return;
	languages[lang] = calendar;
	const profileLang = frappe.boot.user?.language;
	if (azerbaijani.test(profileLang || "")) {
		languages[profileLang] = calendar;
	} else {
		// When the site or request supplies the effective language, the picker
		// still uses the profile language. Preserve all other control options.
		const proto = frappe.ui?.form?.ControlDate?.prototype;
		const setOptions = proto?.set_date_options;
		if (typeof setOptions !== "function") return;
		proto.set_date_options = function (...args) {
			const result = setOptions.apply(this, args);
			if (this.datepicker_options) this.datepicker_options.language = lang;
			return result;
		};
	}
})();
