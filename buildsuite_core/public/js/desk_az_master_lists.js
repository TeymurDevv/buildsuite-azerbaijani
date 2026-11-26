// Install on the native settings after the DocType's own list script. Loading a
// second DocType may install its native settings afresh, so mark the settings
// object itself. Leave other list types and all record data untouched.
(() => {
	const labels = window.buildsuiteDeskRecordLabels;
	if (!labels) return;
	const types = [
		"Task",
		"Warehouse",
		"Department",
		"Project Type",
		"UOM",
		"UOM Category",
		"Print Format",
		"Report",
		"Workspace",
		"Dashboard Chart",
		"Role",
		"User Type",
		"Workflow",
		"Workflow State",
		"Workflow Action Master",
		"Email Template",
		"Notification",
	];
	function translateColumn(html, value, text, df) {
		// Retain native links, filters, title, role visibility and masking. Only a
		// rendered text node containing the public source value may be changed.
		const fragment = document.createElement("template");
		fragment.innerHTML = html;
		const normal = (s) => s.replace(/\s+/g, " ").trim();
		let old = value;
		if (df.fieldtype === "Text Editor") old = frappe.utils.html2text(value);
		const walker = document.createTreeWalker(fragment.content, NodeFilter.SHOW_TEXT);
		while (walker.nextNode()) {
			const node = walker.currentNode;
			if (normal(node.textContent) === normal(old)) node.textContent = text;
		}
		const titlePrefix = __(df.label) + ": ";
		for (const el of fragment.content.querySelectorAll("[title]")) {
			if (el.title === old) el.title = text;
			if (normal(el.title) === normal(titlePrefix + old)) el.title = titlePrefix + text;
		}
		return fragment.innerHTML;
	}
	for (const doctype of types) {
		const settings = (frappe.listview_settings[doctype] ||= {});
		if (settings._buildsuiteAzList) continue;
		settings._buildsuiteAzList = true;
		if (doctype === "Task")
			settings.add_fields = [...new Set([...(settings.add_fields || []), "is_template"])];
		if (doctype === "Warehouse" || doctype === "Department") {
			const kind = doctype.toLowerCase();
			settings.add_fields = [
				...new Set([...(settings.add_fields || []), "parent_" + kind, "is_group"]),
			];
		}
		const load = settings.onload;
		settings.onload = function (list) {
			const result = load?.call(this, list);
			if (list._buildsuiteAzLabels) return result;
			list._buildsuiteAzLabels = true;
			const subject = list.get_subject_text;
			if (subject) {
				list.get_subject_text = function (doc, title) {
					const original = subject.call(this, doc, title);
					return labels.display(doctype, this.columns[0].df.fieldname, original, doc);
				};
			}
			const column = list.get_column_html;
			if (column) {
				list.get_column_html = function (col, doc, ...args) {
					const native = column.call(this, col, doc, ...args);
					if (col.type !== "Field" || !col.df) return native;
					const field = col.df.fieldname;
					if (this.meta.masked_fields?.includes(field)) return native;
					const value = doc[field];
					const display = labels.display(doctype, field, value, doc);
					return display !== value
						? translateColumn(native, value, display, col.df)
						: native;
				};
			}
			return result;
		};
	}
})();
