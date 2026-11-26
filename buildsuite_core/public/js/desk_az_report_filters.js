// frappe-datatable builds the inline-filter tooltip itself, outside Frappe's
// translation API. Register with the report bundle and keep its raw columns,
// input attributes and filtering logic intact.
(() => {
	if (!/^az(?:[-_]Latn)?(?:[-_]AZ)?$/i.test(window.frappe?.boot?.lang || "")) return;
	const wrapped = new WeakSet();

	function setTitle(input, label) {
		if (!input.disabled && input.title.startsWith("Filter based on ")) {
			input.title = __("Filter based on {0}", [label || __("Index")]);
		}
	}

	function install() {
		const prototype = window.DataTable?.prototype;
		if (
			!prototype ||
			typeof prototype.initializeComponents !== "function" ||
			wrapped.has(prototype)
		)
			return;
		wrapped.add(prototype);
		const initialize = prototype.initializeComponents;
		prototype.initializeComponents = function (...args) {
			const result = initialize.apply(this, args);
			const rowManager = this.rowmanager;
			const original = rowManager?.getFilterInput;
			if (typeof original === "function") {
				rowManager.getFilterInput = function (props) {
					const template = document.createElement("template");
					template.innerHTML = original.call(this, props);
					const input = template.content.querySelector("input.dt-filter[title]");
					if (input) setTitle(input, props.name);
					return template.innerHTML;
				};
			}
			return result;
		};
	}

	function onReportRoute() {
		const [view, , mode] = frappe.get_route?.() || [];
		if (view !== "query-report" && !(view === "List" && mode === "Report")) return;
		// Query reports and list report views both lazily load this bundle. The
		// asset loader reuses an ongoing download and its completed result.
		frappe.require("report.bundle.js", install);
	}
	install();
	frappe.router?.on("change", onReportRoute);
	onReportRoute();
})();
