// The native Desktop page registers its English title and search tooltip
// directly. Translate them when Frappe renders either launcher layout.
$(document).on("desktop_screen.buildsuite_language", (_event, { desktop }) => {
	if (!/^az(?:[-_]Latn)?(?:[-_]AZ)?$/i.test(frappe.boot.lang || "")) return;
	desktop.page.set_title(__("Desktop"));
	desktop.page.body.find('#search-widget-button[title="Search"]').attr("title", __("Search"));
});
