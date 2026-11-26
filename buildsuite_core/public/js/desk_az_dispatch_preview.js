// The original Jinja remains the form's source of truth. Show a localized
// sample for the shipped template and keep native editing available to writers.
frappe.ui.form.on("Email Template", {
	refresh(frm) {
		for (const restore of frm._buildsuiteDispatchRestores || []) restore();
		frm._buildsuiteDispatchRestores = [];
		const labels = window.buildsuiteDeskRecordLabels;
		if (!labels || frm.doc.name !== "Dispatch Notification") return;

		const show = (key, sample, isHtml) => {
			const field = frm.get_field(key),
				status = field?.get_status?.();
			const input = field?.$input_wrapper?.[0];
			if (!sample || !input || !["Write", "Read"].includes(status) || field.df.hidden)
				return;
			const preview = document.createElement("div");
			preview.className = "buildsuite-dispatch-preview";
			const body = document.createElement("div");
			body.className = "form-control-static";
			if (isHtml) body.innerHTML = sample;
			else body.textContent = sample;
			preview.append(body);
			const wasHidden = input.hidden;
			const restore = () => {
				input.hidden = wasHidden;
				preview.remove();
			};
			if (status === "Write") {
				const edit = document.createElement("button");
				edit.type = "button";
				edit.className = "btn btn-xs btn-default mb-2";
				edit.textContent = __("Edit template source");
				edit.addEventListener("click", () => {
					restore();
					field.set_focus?.();
				});
				preview.append(edit);
			}
			input.before(preview);
			input.hidden = true;
			frm._buildsuiteDispatchRestores.push(restore);
		};
		show("subject", labels.dispatchSubject(frm.doc.subject), false);
		if (!frm.doc.use_html)
			show("response", labels.dispatchPreview(frm.doc.response)?.html, true);
	},
});
