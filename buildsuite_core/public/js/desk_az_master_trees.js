// The default tree control keeps the canonical ID on the node and in action links.
(() => {
	const labels = window.buildsuiteDeskRecordLabels;
	if (!labels) return;
	for (const doctype of ["Warehouse", "Department"]) {
		const options = (frappe.treeview_settings[doctype] ||= {});
		if (options._buildsuiteAzTree) continue;
		options._buildsuiteAzTree = true;
		const original = options.get_label;
		options.get_label = function (node) {
			const id = node.label || "";
			const parent = node.parent_node;
			const relation = parent?.is_root ? "" : parent?.label;
			const match =
				!node.is_root &&
				labels.companyRecord(
					doctype,
					id,
					relation,
					node.expandable || node.data?.expandable
				);
			if (match)
				return frappe.utils.escape_html(__(match.base, null, doctype) + match.suffix);
			if (original) return original.call(this, node);
			// Custom company and record names can themselves be dictionary words.
			const title = node.title || id;
			const escaped = frappe.utils.escape_html(title);
			return title === id
				? escaped
				: escaped +
						" <span class='text-muted'>(" +
						frappe.utils.escape_html(id) +
						")</span>";
		};
	}
})();
