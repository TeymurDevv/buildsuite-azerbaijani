// Display sources are package data. Site records are consulted only by the native
// list/tree view and are never rewritten or exposed by our Desk boot hook.
(() => {
	const manifest = window.frappe?.boot?.buildsuite_desk_labels;
	if (!manifest || !/^az(?:[-_]Latn)?(?:[-_]AZ)?$/i.test(frappe.boot.lang || "")) return;
	const has = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
	const names = (doctype, name) => {
		const records = manifest[doctype];
		return Array.isArray(records) ? records.includes(name) : has(records, name);
	};
	const companies = {
		Warehouse: {
			root: "All Warehouses",
			children: ["Stores", "Work In Progress", "Finished Goods", "Goods In Transit"],
		},
		Department: {
			root: "All Departments",
			children: [
				"Accounts",
				"Marketing",
				"Sales",
				"Purchase",
				"Operations",
				"Production",
				"Dispatch",
				"Customer Service",
				"Human Resources",
				"Management",
				"Quality Management",
				"Research & Development",
				"Legal",
			],
		},
	};
	function companyRecord(doctype, id, parent, group) {
		const { root, children } = companies[doctype];
		const split = id.indexOf(" - ");
		const base = split === -1 ? id : id.slice(0, split);
		const suffix = split === -1 ? "" : id.slice(split);
		if (base === root && group && !parent && (doctype === "Warehouse" ? !!suffix : !suffix)) {
			return { base, suffix };
		}
		if (
			children.includes(base) &&
			suffix &&
			parent === root + (doctype === "Warehouse" ? suffix : "")
		) {
			return { base, suffix };
		}
	}
	function translate(value, doctype) {
		return typeof value === "string" && value ? __(value, null, doctype) : value;
	}
	const dispatchVariables = {
		customer: "Customer",
		first_name: "First Name",
		last_name: "Last Name",
		address: "Address Name",
		customer_address: "Address Details",
		delivery_note: "Delivery Note",
		grand_total: "Order Total",
		departure_time: "Departure Time",
		estimated_arrival: "Estimated Arrival",
		driver_name: "Driver's Name",
		cell_number: "Driver's Number",
		vehicle: "Vehicle Number",
	};
	function templateText(doc) {
		const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
		const parts = [];
		while (walker.nextNode()) {
			const text = walker.currentNode.textContent.trim();
			if (text) parts.push(text);
		}
		return parts.join(" ").replace(/\s+/g, " ").trim();
	}
	function dispatchPreview(value) {
		if (typeof value !== "string" || !value) return null;
		// Match the exact upstream or Frappe-sanitized fixture, before or after
		// migration. Even a custom hyperlink or style must keep the native editor.
		const fixture = (manifest.dispatch_bodies || []).find(
			(source) =>
				source === value ||
				source.replace(
					/>([^<>{}]*[A-Za-z][^<>{}]*)</g,
					(_, label) => ">{{ _(" + JSON.stringify(label) + ") }}<"
				) === value
		);
		if (!fixture) return null;
		const standard = new DOMParser().parseFromString(fixture, "text/html");
		const walker = standard.createTreeWalker(standard.body, NodeFilter.SHOW_TEXT);
		while (walker.nextNode()) {
			const node = walker.currentNode,
				text = node.textContent.trim();
			if (!text) continue;
			if (text.startsWith("{{")) {
				node.textContent = text.replace(/\{\{\s*(\w+)\s*\}\}/g, (raw, name) =>
					has(dispatchVariables, name)
						? "«" + translate(dispatchVariables[name], "Email Template") + "»"
						: raw
				);
			} else {
				node.textContent = translate(text, "Email Template");
			}
		}
		return { html: standard.body.innerHTML, text: templateText(standard) };
	}
	function dispatchSubject(value) {
		const original = manifest["Email Template"]?.["Dispatch Notification"];
		if (!original || (value !== original && value !== '{{ _("' + original + '") }}'))
			return null;
		return translate(original, "Email Template");
	}
	function display(doctype, field, value, doc) {
		if (!value || typeof value !== "string") return value;
		if (doctype === "Task") {
			return field === "subject" && Number(doc.is_template) === 1 && names("Task", value)
				? translate(value, "Project template task")
				: value;
		}
		if (companies[doctype]) {
			const kind = doctype.toLowerCase(),
				parent = doc["parent_" + kind];
			if (field === "parent_department" && value === companies.Department.root)
				return translate(value, doctype);
			const match = companyRecord(doctype, doc.name, parent, Number(doc.is_group));
			if (!match) return value;
			if (field === "name" && value === doc.name)
				return translate(match.base, doctype) + match.suffix;
			if (field === kind + "_name" && value === match.base) return translate(value, doctype);
			if (field === "parent_warehouse" && value === "All Warehouses" + match.suffix)
				return translate("All Warehouses", doctype) + match.suffix;
			return value;
		}
		// These are links to standard records, even if the referencing row is custom.
		const link = { module: "Module Def", report: "Report", category: "UOM Category" }[field];
		if (link && names(link, value)) {
			const source = link === "Report" ? manifest.Report[value] : value;
			return translate(source, link);
		}
		if (!names(doctype, doc.name)) return value;
		const record = manifest[doctype][doc.name];
		if (field === "name" && value === doc.name) {
			return translate(doctype === "Report" ? record : value, doctype);
		}
		if (doctype === "Notification" && field === "subject" && record === value)
			return translate(value, doctype);
		if (doctype === "Email Template" && field === "response")
			return dispatchPreview(value)?.text || value;
		if (doctype === "Email Template" && field === "subject")
			return dispatchSubject(value) || value;
		const identity = {
			UOM: "uom_name",
			"UOM Category": "category_name",
			"Project Type": "project_type",
			Role: "role_name",
			"User Type": "user_type",
			Workflow: "workflow_name",
			"Workflow State": "workflow_state_name",
			"Workflow Action Master": "workflow_action_name",
			"Dashboard Chart": "chart_name",
			Workspace: "label",
		};
		if (field === identity[doctype] && (value === doc.name || value === record))
			return translate(value, doctype);
		return value;
	}
	window.buildsuiteDeskRecordLabels = {
		display,
		companyRecord,
		dispatchSubject,
		dispatchPreview,
	};
})();
