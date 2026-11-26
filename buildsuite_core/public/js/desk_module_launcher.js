// Add role-visible BuildSuite and ERPNext modules to Frappe's native Desktop page.
// Workspace visibility comes from the same backend registry used by BuildSuite navigation.
(() => {
	$(document).on("desktop_screen.buildsuite_module_launcher", (_event, { desktop }) => {
		const page = desktop.page;
		if (!page?.body) return;

		frappe.call({ method: "buildsuite_core.api.workspace_setting.get_visible_workspaces" })
			.then((response) => {
				const workspaces = Array.isArray(response?.message) ? response.message : [];
				const buildsuite = workspaces.filter((workspace) => workspace.group === "buildsuite");
				const erpnext = workspaces.filter((workspace) => workspace.group === "erpnext");
				if (!buildsuite.length && !erpnext.length) return;

				const $container = page.body.find(".desktop-container");
				if (!$container.length || $container.find(".bs-module-launcher").length) return;
				add_module_launcher_styles();

				const $launcher = $(
					'<section class="bs-module-launcher" aria-labelledby="bs-module-launcher-title"></section>'
				);
				$('<h2 id="bs-module-launcher-title" class="bs-module-launcher__title"></h2>')
					.text(__("Module launcher"))
					.appendTo($launcher);
				$('<p class="bs-module-launcher__intro"></p>')
					.text(__("Open BuildSuite and ERPNext workspaces directly from Desktop."))
					.appendTo($launcher);

				if (buildsuite.length) {
					add_workspace_group($launcher, __("BuildSuite modules"), buildsuite);
				}
				if (erpnext.length) {
					add_workspace_group($launcher, __("ERPNext modules"), erpnext);
				}
				$container.append($launcher);
			})
			.catch((error) => {
				console.warn("Could not load Desktop modules", error); // eslint-disable-line no-console
			});
	});

	function add_workspace_group($launcher, title, workspaces) {
		const $group = $('<section class="bs-module-group"></section>');
		$('<h3 class="bs-module-group__title"></h3>').text(title).appendTo($group);
		const $grid = $('<div class="bs-module-grid"></div>').appendTo($group);

		workspaces.forEach((workspace) => {
			const href =
				workspace.group === "erpnext"
					? `/app/${encodeURIComponent(workspace.slug)}`
					: `/core${safe_buildsuite_route(workspace.route, workspace.slug)}`;
			const $link = $('<a class="bs-module-card"></a>').attr("href", href);
			$('<span class="bs-module-card__icon" aria-hidden="true"></span>')
				.text(workspace.icon || "▦")
				.appendTo($link);
			const $copy = $('<span class="bs-module-card__copy"></span>').appendTo($link);
			$('<span class="bs-module-card__label"></span>')
				.text(__(workspace.label || workspace.slug))
				.appendTo($copy);
			if (workspace.description) {
				$('<span class="bs-module-card__description"></span>')
					.text(__(workspace.description))
					.appendTo($copy);
			}
			$('<span class="bs-module-card__arrow" aria-hidden="true">→</span>').appendTo($link);
			$grid.append($link);
		});

		$launcher.append($group);
	}

	function safe_buildsuite_route(route, slug) {
		if (typeof route === "string" && /^\/[a-z0-9\-/]+$/i.test(route) && !route.startsWith("//")) {
			return route;
		}
		return `/${encodeURIComponent(slug)}`;
	}

	function add_module_launcher_styles() {
		if (document.getElementById("bs-module-launcher-styles")) return;
		const style = document.createElement("style");
		style.id = "bs-module-launcher-styles";
		style.textContent = `
			body.desktop-page .desktop-container { display: block !important; width: 100%; }
			body.desktop-page .desktop-container .icons-container { width: max-content; max-width: 100%; margin: 44px auto 20px; }
			body.desktop-page .desktop-container .icons { grid-template-rows: auto !important; }
			.bs-module-launcher { max-width: 1200px; margin: 32px auto 56px; padding: 0 32px; }
			.bs-module-launcher__title { margin: 0; color: var(--ink-gray-9, #1f272e); font-size: 22px; font-weight: 650; }
			.bs-module-launcher__intro { margin: 6px 0 24px; color: var(--ink-gray-6, #687178); font-size: 13px; }
			.bs-module-group { margin-top: 24px; }
			.bs-module-group__title { margin: 0 0 10px; color: var(--ink-gray-7, #4c555e); font-size: 12px; font-weight: 650; letter-spacing: .08em; text-transform: uppercase; }
			.bs-module-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
			.bs-module-card { min-height: 86px; display: flex; align-items: center; gap: 12px; padding: 14px; border: 1px solid var(--border-color, #e3e7ea); border-radius: 10px; background: var(--card-bg, #fff); color: inherit; text-decoration: none !important; transition: border-color .15s, box-shadow .15s, transform .15s; }
			.bs-module-card:hover { border-color: var(--brand-500, #4b8f68); box-shadow: 0 4px 14px rgba(25, 55, 38, .08); transform: translateY(-1px); }
			.bs-module-card__icon { width: 40px; height: 40px; flex: 0 0 40px; display: grid; place-items: center; border-radius: 9px; background: var(--subtle-accent, #edf7f0); color: var(--brand-700, #28724a); font-size: 22px; }
			.bs-module-card__copy { min-width: 0; display: flex; flex: 1; flex-direction: column; gap: 4px; }
			.bs-module-card__label { color: var(--ink-gray-9, #1f272e); font-size: 13px; font-weight: 600; }
			.bs-module-card__description { color: var(--ink-gray-6, #687178); font-size: 11px; line-height: 1.4; }
			.bs-module-card__arrow { color: var(--ink-gray-4, #a4acb2); font-size: 16px; }
			@media (max-width: 900px) { .bs-module-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
			@media (max-width: 600px) { .bs-module-launcher { margin-top: 24px; padding: 0 16px; } .bs-module-grid { grid-template-columns: 1fr; } }
		`;
		document.head.appendChild(style);
	}
})();
