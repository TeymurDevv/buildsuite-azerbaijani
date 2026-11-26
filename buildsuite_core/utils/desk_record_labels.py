"""Public packaged names used for display on Azerbaijani Desk lists and trees."""

import json
from functools import lru_cache
from pathlib import Path

import frappe
from frappe.translate import get_user_lang
from frappe.utils import sanitize_html

from buildsuite_core.buildsuite_core.doctype.project_category.seed_project_templates import TEMPLATES
from buildsuite_core.default_workflows import _ACTIONS, _STATES, _WORKFLOW_ROLES
from buildsuite_core.permissions.setup import BUILDSUITE_ROLES, WORKFLOW_EDITOR_ROLE
from buildsuite_core.print_formats import _FORMATS
from buildsuite_core.report_access import _REPORT_ANCHORS, _REPORT_PREFIX


def _read(path):
	return json.loads(path.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def _packaged_labels():
	# These are installed package assets, never site records. In particular, a
	# custom record does not become a standard record by matching a dictionary word.
	roots = [Path(frappe.get_app_path(app)) for app in ("frappe", "erpnext", "buildsuite_core")]
	types = {
		"Report": "report",
		"Workspace": "workspace",
		"Dashboard Chart": "dashboard_chart",
		"Print Format": "print_format",
		"Notification": "notification",
	}
	entries = {doctype: {} for doctype in types}
	roles = set(BUILDSUITE_ROLES) | {
		"Administrator",
		"Guest",
		"All",
		"Desk User",
		"System Manager",
		"Analytics",
		"Supplier",
		"Customer",
		WORKFLOW_EDITOR_ROLE,
	}
	modules = set()
	for root in roots:
		module_file = root / "modules.txt"
		if module_file.exists():
			modules.update(module_file.read_text(encoding="utf-8").splitlines())
		for doctype, folder in types.items():
			for path in root.glob(f"*/{folder}/*/*.json"):
				record = _read(path)
				if not isinstance(record, dict) or record.get("doctype") != doctype:
					continue
				name = record.get("name")
				if name:
					entries[doctype][name] = (
						record.get("subject") or record.get("chart_name") or record.get("label") or name
					)
		for path in root.glob("*/doctype/*/*.json"):
			if path.stem == path.parent.name:
				roles.update(p["role"] for p in _read(path).get("permissions", []) if p.get("role"))

	frappe_root, erpnext_root, buildsuite_root = roots
	for path in (frappe_root / "email/doctype/notification/templates").glob("*/*.json"):
		record = _read(path)
		if record.get("name") and record.get("subject"):
			entries["Notification"][record["name"]] = record["subject"]

	for name, *_ in _REPORT_ANCHORS:
		entries["Report"][_REPORT_PREFIX + name] = name
	for row in _FORMATS:
		entries["Print Format"][row["name"]] = row["name"]
	entries["Print Format"]["Purchase Order"] = "Purchase Order"

	uoms = _read(erpnext_root / "setup/setup_wizard/data/uom_data.json")
	dispatch = erpnext_root / "stock/doctype/delivery_trip/dispatch_notification_template.html"
	body = dispatch.read_text(encoding="utf-8") if dispatch.exists() else ""
	entries["dispatch_bodies"] = [body, sanitize_html(body)] if body else []
	entries["UOM"] = {row["uom_name"]: row.get("category") for row in uoms}
	entries["UOM Category"] = sorted({row["category"] for row in uoms if row.get("category")})
	workflows = {f"{doctype} Approval": doctype for doctype in _WORKFLOW_ROLES}
	states = {state for state, _ in _STATES} | {"Pending"}
	actions = set(_ACTIONS) | {"Review"}
	for row in _read(buildsuite_root / "data/workflows.json"):
		workflows[row["workflow_name"]] = row["document_type"]
		states.update(state["state"] for state in row.get("states", []))
		actions.update(step["action"] for step in row.get("transitions", []))
	entries.update(
		{
			"Workflow": workflows,
			"Workflow State": sorted(states),
			"Workflow Action Master": sorted(actions),
			"Role": sorted(roles),
			"Module Def": sorted(modules),
			"User Type": ["System User", "Website User"],
			"Project Type": ["Internal", "External", "Other"],
			"Task": sorted({row[1] for template in TEMPLATES.values() for row in template["tasks"]}),
			"Email Template": {"Dispatch Notification": "Your order is out for delivery!"},
		}
	)
	return entries


def standard_display_labels(doctype):
	"""Map stable report or UOM IDs to display sources for translated pickers."""
	values = _packaged_labels().get(doctype, {})
	if doctype == "UOM":
		return {name: name for name in values}
	if doctype == "Report":
		return dict(values)
	return {}


def standard_record_names(doctype):
	return tuple(standard_display_labels(doctype))


def add_bootinfo(bootinfo):
	language = (get_user_lang() or "").lower().replace("_", "-")
	if language in {"az", "az-az", "az-latn", "az-latn-az"}:
		bootinfo.buildsuite_desk_labels = _packaged_labels()
