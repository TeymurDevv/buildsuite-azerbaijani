// Frappe translates a form button's caption but uses its English label as the
// native browser tooltip. Keep the help text in the same document context.
(() => {
	const frappe = window.frappe;
	if (!/^az(?:[-_]Latn)?(?:[-_]AZ)?$/i.test(frappe?.boot?.lang || "")) return;

	const prototype = frappe.ui?.form?.ControlButton?.prototype;
	const makeInput = prototype?.make_input;
	if (typeof makeInput !== "function") return;

	prototype.make_input = function (...args) {
		const result = makeInput.apply(this, args);
		const source = this.df.title || this.df.label;
		if (source && this.input) this.input.title = __(source, null, this.df.parent);
		return result;
	};
})();
