# Copyright (c) 2026, Infraholic Innovations Pvt. Ltd and contributors

"""Translate reviewed stock print formats, notifications and privacy forms in place.

The patch is deliberately a source-keyed overlay. It only replaces exact English text
nodes in the named standard records, so it remains safe on customized layouts and
repeated migrate runs.
"""

import html
import json
import re
from pathlib import Path

import frappe

CONTENT = Path(__file__).with_name("az_installed_template_overrides.json")


def _replace_text_nodes(value, replacements):
	updated = value or ""
	changed = False
	for source, target in sorted(replacements.items(), key=lambda pair: len(pair[0]), reverse=True):
		escaped = html.escape(source, quote=False)
		pattern = re.compile(r"(?<=>)(\s*)(?:" + re.escape(source) + "|" + re.escape(escaped) + r")(\s*)(?=<)")
		updated, count = pattern.subn(lambda match: match.group(1) + target + match.group(2), updated)
		changed = changed or bool(count)
		for attr in ("alt", "title", "aria-label"):
			for old in (source, html.escape(source, quote=True)):
				attribute = re.compile(r"(" + re.escape(attr) + r"\s*=\s*)(['\"])" + re.escape(old) + r"\2")
				updated, count = attribute.subn(lambda match: match.group(1) + match.group(2) + target + match.group(2), updated)
				changed = changed or bool(count)
	return updated, changed



def _replace_json_values(value, replacements):
	try:
		data = json.loads(value or "null")
	except (TypeError, json.JSONDecodeError):
		return value, False

	changed = False

	def visit(node):
		nonlocal changed
		if isinstance(node, str):
			if node in replacements:
				changed = True
				return replacements[node]
			updated, did_change = _replace_text_nodes(node, replacements)
			if did_change:
				changed = True
				return updated
		if isinstance(node, list):
			return [visit(item) for item in node]
		if isinstance(node, dict):
			return {key: visit(item) for key, item in node.items()}
		return node

	updated = visit(data)
	return (json.dumps(updated, ensure_ascii=False, separators=(",", ":")), True) if changed else (value, False)


def execute():
	overrides = json.loads(CONTENT.read_text(encoding="utf-8"))
	for doctype, records in overrides.items():
		for name, fields in records.items():
			if not frappe.db.exists(doctype, name):
				continue
			doc = frappe.get_doc(doctype, name)
			updates = {}
			source_file = fields.get("__source_file__")
			if doctype == "Print Format" and source_file:
				if not doc.get("html"):
					source_html = Path(frappe.get_app_path("erpnext")).joinpath(source_file).read_text(encoding="utf-8")
					localized_html, changed = _replace_text_nodes(source_html, fields.get("html", {}))
					if changed:
						updates["html"] = localized_html
				if not doc.get("custom_format"):
					updates["custom_format"] = 1
			for field, replacements in fields.items():
				if field.startswith("__"):
					continue
				value = doc.get(field)
				if not isinstance(value, str) or not value:
					continue
				if "__replace_entire_field__" in replacements:
					updated = replacements["__replace_entire_field__"]
					did_change = updated != value
				elif field == "format_data":
					updated, did_change = _replace_json_values(value, replacements)
				elif field in {"html", "message", "introduction_text", "content", "footer"}:
					updated, did_change = _replace_text_nodes(value, replacements)
					if doctype == "Notification":
						# Notification HTML can interleave Jinja blocks inside a visible text
						# node, so BeautifulSoup-style text-node matching cannot see these
						# two source captions as standalone nodes. Replace the exact literals
						# in the named notification template while preserving its Jinja code.
						for source, target in replacements.items():
							if source in updated:
								updated = updated.replace(source, target)
								did_change = True
				else:
					updated = replacements.get(value, value)
					did_change = updated != value
				if did_change:
					updates[field] = updated
			if updates:
				# Frappe locks standard records against doc.save(). This migration is the
				# supported point for exact, source-keyed language overlays on those records.
				for field, value in updates.items():
					frappe.db.set_value(doctype, name, field, value, update_modified=False)


def get_print_format_template(jenv, print_format):
	if print_format.name not in json.loads(CONTENT.read_text(encoding="utf-8")).get("Print Format", {}):
		return None
	if not print_format.get("custom_format") or not print_format.get("html"):
		return None
	return jenv.from_string(print_format.html)
