# Copyright (c) 2026, Infraholic Innovations Pvt. Ltd and contributors
# For license information, please see license.txt

from pathlib import Path
from unittest.mock import patch

import frappe
from frappe.translate import print_language
from frappe.www.printview import get_rendered_template

from buildsuite_core import dispatch
from buildsuite_core.api import rfq
from buildsuite_core.install import INVOICE_TERMS, RFQ_TERMS
from buildsuite_core.patches.localize_print_and_dispatch_templates import execute
from buildsuite_core.print_formats import _FORMATS
from buildsuite_core.print_text import RFQ_MESSAGE, buildsuite_print_terms
from buildsuite_core.tests.base import BuildSuiteTestCase


class TestLocalizedDocuments(BuildSuiteTestCase):
	def test_six_native_print_formats_in_both_languages(self):
		from buildsuite_core.buildsuite_core.doctype.subcontractor.seed_print_assets import _PO_PRINT_HTML

		titles = {
			"Sales Invoice": ("TAX INVOICE", "VERGİ HESAB-FAKTURASI"),
			"Subcontractor Work Order": ("WORK ORDER", "İŞ SİFARİŞİ"),
			"Quotation": ("QUOTATION", "QİYMƏT TƏKLİFİ"),
			"BuildSuite Tenders": ("TENDER", "TENDER TƏKLİFİ"),
			"Request for Quotation": ("REQUEST FOR QUOTATION", "QİYMƏT SORĞUSU"),
			"Purchase Order": ("PURCHASE ORDER", "SATINALMA SİFARİŞİ"),
		}
		formats = [
			*_FORMATS,
			{"name": "Purchase Order", "doc_type": "Purchase Order", "html": _PO_PRINT_HTML},
		]
		for seed in formats:
			doctype = seed["doc_type"]
			doc = frappe.new_doc(doctype)
			doc.name = "PRINT-EXAMPLE"
			doc.update(
				{
					"company": self.company,
					"currency": "AZN",
					"date": "2026-11-26",
					"transaction_date": "2026-11-26",
					"posting_date": "2026-11-26",
					"due_date": "2026-12-15",
					"schedule_date": "2026-12-15",
					"total": 118,
					"net_total": 100,
					"grand_total": 118,
					"tax_percent": 18,
					"emd_amount": 100,
					"performance_guarantee_percent": 10,
					"retention_percent": 5,
					"bid_before_tax": 100,
					"envelope_structure": "Two-envelope",
					"title": "CUSTOMER-WRITTEN-TITLE",
					"customer_name": "Example Buyer",
					"supplier_name": "Example Supplier",
					"terms": "",
				}
			)
			line = {
				"item_code": "BEAM-001",
				"item_name": "Beam X",
				"description": "Beam X",
				"scope": "Beam X",
				"qty": 2,
				"uom": "kg",
				"unit": "kg",
				"rate": 50,
				"sell_rate": 50,
				"amount": 100,
			}
			table = {
				"Subcontractor Work Order": "lines",
				"BuildSuite Tenders": "buildsuite_tenders_items",
			}.get(doctype, "items")
			doc.append(table, line)
			if doctype == "Request for Quotation":
				doc.message_for_supplier = RFQ_MESSAGE
				doc.append(
					"suppliers", {"supplier": "TEST-SUPPLIER", "custom_contact_person": "Ada Quliyeva"}
				)
				doc.terms = RFQ_TERMS
			if doctype == "Sales Invoice":
				doc.terms = INVOICE_TERMS[0][1]
			format_doc = frappe.get_doc("Print Format", seed["name"])
			# Verify exactly the templates shipped on install, independently of local administrator edits.
			format_doc.html = seed["html"]
			for idx, lang in enumerate(("en", "az")):
				with self.subTest(doctype=doctype, language=lang), print_language(lang):
					output = get_rendered_template(
						doc, print_format=format_doc, no_letterhead=1, settings={"allow_print_for_draft": 1}
					)
					self.assertIn(titles[doctype][idx], output)
					self.assertIn("Beam X", output)
					self.assertIn("PRINT-EXAMPLE", output)
					if doctype == "Request for Quotation":
						self.assertIn(("Dear Ada Quliyeva,", "Hörmətli Ada Quliyeva,")[idx], output)
						self.assertIn(
							("Reference and closing date.", "Sorğunun nömrəsi və son tarix.")[idx], output
						)
					if doctype == "Sales Invoice":
						self.assertIn(("1. Payment:", "1. Ödəniş:")[idx], output)

	def test_dispatch_action_renders_each_customer_and_attachment_in_its_own_language(self):
		# Real stops, contacts, customer preferences, configured template and send handler; stop at the mail boundary.
		customers = [self._make_customer(), self._make_customer()]
		trip = frappe.new_doc("Delivery Trip")
		trip.name = "LANG-TRIP-" + self._n
		trip.docstatus = 1
		trip.company = self.company
		trip.vehicle = "TEST-VEHICLE"
		trip.departure_time = "2026-11-26 09:00:00"
		trip.db_insert()
		for customer, lang in zip(customers, ("az", "en"), strict=True):
			customer.db_set("language", lang)
			email = f"{lang}-{self._n}@example.invalid"
			contact = frappe.new_doc("Contact")
			contact.first_name = "Nigar" if lang == "az" else "James"
			contact.last_name = "Sample"
			contact.append("email_ids", {"email_id": email, "is_primary": 1})
			contact.insert(ignore_permissions=True)
			stop = trip.append(
				"delivery_stops",
				{
					"customer": customer.name,
					"contact": contact.name,
					"address": "EXAMPLE-ADDRESS",
					"grand_total": 73,
					"estimated_arrival": "2026-11-26 10:00:00",
				},
			)
			stop.parent = trip.name
			stop.db_insert()
		tpl = frappe.get_doc("Email Template", "Dispatch Notification")
		dispatch.translate_stock_template(tpl)
		frappe.db.set_value("Email Template", tpl.name, {"response": tpl.response, "subject": tpl.subject})
		frappe.db.set_single_value("Delivery Settings", "dispatch_template", tpl.name)
		action = frappe.get_attr(
			frappe.override_whitelisted_method(
				"erpnext.stock.doctype.delivery_trip.delivery_trip.notify_customers"
			)
		)
		self.assertIs(action, dispatch.notify_customers)
		output = []

		def capture(**kwargs):
			output.append((frappe.local.lang, kwargs))

		with (
			print_language("en"),
			patch("frappe.sendmail", side_effect=capture),
			patch(
				"erpnext.stock.doctype.delivery_trip.delivery_trip.get_attachments",
				side_effect=lambda stop: [frappe.local.lang],
			),
		):
			action(trip.name)
			self.assertEqual(frappe.local.lang, "en")
		self.assertEqual(len(output), 2)
		for idx, (lang, mail) in enumerate(output):
			self.assertEqual(lang, ("az", "en")[idx])
			self.assertEqual(mail["attachments"], [lang])
			self.assertIn(customers[idx].name, mail["message"])
			self.assertIn(("Nigar", "James")[idx], mail["message"])
			self.assertNotIn(("James", "Nigar")[idx], mail["message"])
			self.assertIn(("Göndəriş bildirişi", "Dispatch Notification")[idx], mail["message"])
			self.assertEqual(
				mail["subject"],
				("Sifarişiniz çatdırılma üçün yola çıxıb!", dispatch.SUBJECT)[idx],  # noqa: RUF001
			)
		self.assertEqual(frappe.db.get_value("Delivery Trip", trip.name, "email_notification_sent"), 1)
		with patch("frappe.sendmail") as send:
			try:
				frappe.set_user("Guest")
				with self.assertRaises(frappe.PermissionError):
					action(trip.name)
				send.assert_not_called()
			finally:
				frappe.set_user("Administrator")

	def test_stock_delivery_note_layout_preserves_custom_edits(self):
		path = frappe.get_app_path(
			"erpnext", "stock", "print_format", "delivery_note_classic", "delivery_note_classic.json"
		)
		if not Path(path).exists():
			self.skipTest("ERPNext does not ship the Delivery Note Classic format on this version")
		original = frappe.parse_json(Path(path).read_text())["format_data"]
		name = "Delivery Note Classic"
		frappe.db.set_value("Print Format", name, "format_data", original)
		dispatch.update_standard_delivery_note()
		upgraded = frappe.db.get_value("Print Format", name, "format_data")
		for lang, label in [("en", "Billed To"), ("az", frappe._("Billed To", lang="az"))]:
			with print_language(lang):
				self.assertIn(label, frappe.render_template(upgraded, {}))
		self.assertIn('"label":"No.","fieldname":"idx"', upgraded)
		custom = original.replace("Billed To", "Custom heading")
		frappe.db.set_value("Print Format", name, "format_data", custom)
		dispatch.update_standard_delivery_note()
		self.assertEqual(frappe.db.get_value("Print Format", name, "format_data"), custom)

	def test_fresh_erpnext_fixture_uses_native_template_hook(self):
		name = frappe._(dispatch.TEMPLATE_NAME, lang="az")
		if frappe.db.exists("Email Template", name):
			name = dispatch.TEMPLATE_NAME
		fixture = Path(
			frappe.get_app_path(
				"erpnext", "stock", "doctype", "delivery_trip", "dispatch_notification_template.html"
			)
		).read_text()
		template = frappe.get_doc(
			{
				"doctype": "Email Template",
				"name": name,
				"subject": dispatch.SUBJECT,
				"response": fixture,
			}
		)
		if frappe.db.exists("Email Template", name):
			template.run_method("before_insert")
		else:
			template.insert(ignore_permissions=True)
		self.assertEqual(template.name, name)
		with print_language("az"):
			self.assertNotEqual(template.get_formatted_subject({}), dispatch.SUBJECT)
			self.assertIn("Göndəriş bildirişi", template.get_formatted_response({"customer": "Example"}))
		with print_language("en"):
			self.assertEqual(template.get_formatted_subject({}), dispatch.SUBJECT)
			self.assertIn("Dispatch Notification", template.get_formatted_response({"customer": "Example"}))

	def test_preserves_custom_fields_and_terms(self):
		template = frappe.get_doc("Email Template", "Dispatch Notification")
		template.use_html = 1
		template.subject = "OUR SUBJECT"
		template.response_html = "OUR TEXT: {{ customer }}"
		dispatch.translate_stock_template(template)
		self.assertEqual(template.subject, "OUR SUBJECT")
		self.assertEqual(template.response_, "OUR TEXT: {{ customer }}")
		with print_language("az"):
			for _, text in INVOICE_TERMS:
				self.assertNotEqual(buildsuite_print_terms(text), text)
				self.assertEqual(buildsuite_print_terms(text + " Special term"), text + " Special term")
			self.assertEqual(buildsuite_print_terms("Customer text"), "Customer text")
			self.assertEqual(buildsuite_print_terms(RFQ_TERMS + "!"), RFQ_TERMS + "!")
		css = "/* Custom style */"
		frappe.db.set_value("Print Format", "BuildSuite Tender", {"html": "Admin HTML", "css": css})
		execute()
		execute()
		self.assertEqual(
			frappe.db.get_value("Print Format", "BuildSuite Tender", ["html", "css"]), ("Admin HTML", css)
		)

	def test_rfq_previews_use_supplier_language_and_keep_custom_subject_and_body(self):
		doc = frappe.new_doc("Request for Quotation")
		doc.name = "RFQ-LANGUAGE"
		doc.company = self.company
		doc.subject = "REF 25 / G-8"
		doc.message_for_supplier = frappe._(RFQ_MESSAGE, lang="az")
		row = frappe._dict(
			supplier="example", custom_contact_person="Nigar", email_id="sample@example.invalid"
		)
		with patch.object(rfq, "recipient_language", return_value="en"), print_language("az"):
			preview = rfq._rfq_email(doc, row)
			self.assertIn("Dear Nigar,", preview["body"])
			self.assertIn("Please send us your best quotation", preview["body"])
			self.assertEqual(preview["subject"], doc.subject)
			self.assertEqual(frappe.local.lang, "az")
		doc.message_for_supplier = "AISI 304 required / 48h."
		with patch.object(rfq, "recipient_language", return_value="az"), print_language("en"):
			preview = rfq._rfq_email(doc, row)
			self.assertIn("Hörmətli Nigar,", preview["body"])
			self.assertIn(doc.message_for_supplier, preview["body"])
