# Copyright (c) 2026, Infraholic Innovations Pvt. Ltd and contributors
# For license information, please see license.txt

"""Upgrade only the original print HTML and dispatch boilerplate; keep site-owned content."""

import hashlib

import frappe

OLD_HTML = {
	"BuildSuite Tax Invoice": "ed7cf526de56423671a6ac9f4cd4f17435f7ed83b6980860cc9a54b2a49679e6",
	"BuildSuite Work Order": "5e67b55c154a28994634c08a480a343990eff0dcb5443347c729de82cb6953e3",
	"BuildSuite Quotation": "945eec197e504b710e7206890054862671b8ab32fd001c1f0f3f9d0315c8e3ad",
	"BuildSuite Tender": "5b8715fe7eee49a52717f78e2192d9cfcae4a7d37f2d7b2fc0283815665f4c9b",
	"BuildSuite Request for Quotation": "8d64b13cfa719099ce7695942166e2724c03a75e4cb9ba7a151bc6ad5ee02e03",
	"Purchase Order": "dd11e2b1787effbb5619a9ba0930570285e187a6cf71ef19134edde7bc738deb",
}


def execute():
	from buildsuite_core.buildsuite_core.doctype.subcontractor.seed_print_assets import _PO_PRINT_HTML
	from buildsuite_core.dispatch import update_existing_templates
	from buildsuite_core.print_formats import _FORMATS

	layouts = {pf["name"]: (pf["doc_type"], pf["html"]) for pf in _FORMATS}
	layouts["Purchase Order"] = ("Purchase Order", _PO_PRINT_HTML)
	for name, (doctype, html) in layouts.items():
		stored = frappe.db.get_value("Print Format", {"name": name, "doc_type": doctype}, "html")
		if stored and hashlib.sha256(stored.encode()).hexdigest() == OLD_HTML[name]:
			frappe.db.set_value("Print Format", name, "html", html)
	update_existing_templates()
