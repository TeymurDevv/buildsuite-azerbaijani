# Copyright (c) 2026, Infraholic Innovations Pvt. Ltd and contributors
# For license information, please see license.txt

"""Recipient-language delivery notifications for ERPNext's native Delivery Trip action."""

import hashlib
import json
import re

import frappe
from frappe import _
from frappe.translate import print_language

TEMPLATE_NAME = "Dispatch Notification"
SUBJECT = "Your order is out for delivery!"
# The v16 fixture on disk, and the same HTML after Frappe's Text Editor sanitizer.
STOCK_BODY_HASHES = {
	"b6c304e7ac8aa799d118c5f9cb2f660da36724313400a012afd6c54194a47e9e",
	"5fb5d2b608dddb0949869fb85b92d161052bf331fe30e87176b46a54128dcf54",
}


def _seed_languages():
	return {"en", "az", frappe.local.lang, frappe.get_system_settings("language")} - {None, ""}


def _template_names():
	return {_(TEMPLATE_NAME, lang=lang) for lang in _seed_languages()} | {TEMPLATE_NAME}


def translate_stock_template(doc, method=None):
	"""Change only exact upstream defaults, independently for the subject and active body."""
	if doc.name not in _template_names():
		return
	if doc.subject in {_(SUBJECT, lang=lang) for lang in _seed_languages()} | {SUBJECT}:
		doc.subject = '{{ _("Your order is out for delivery!") }}'
	if not doc.use_html and hashlib.sha256((doc.response or "").encode()).hexdigest() in STOCK_BODY_HASHES:
		# Only the known seed reaches here. Keep its HTML, data expressions and formatting.
		doc.response = re.sub(
			r">([^<>{}]*[A-Za-z][^<>{}]*)<",
			lambda m: ">" + "{{ _(" + json.dumps(m[1]) + ") }}" + "<",
			doc.response,
		)


def update_existing_templates():
	for name in _template_names():
		if not frappe.db.exists("Email Template", name):
			continue
		doc = frappe.get_doc("Email Template", name)
		values = {"subject": doc.subject, "response": doc.response}
		translate_stock_template(doc)
		changed = {key: doc.get(key) for key, previous in values.items() if doc.get(key) != previous}
		if changed:
			frappe.db.set_value("Email Template", name, changed)


def recipient_language(party_type, party, document_language=None):
	return (
		(frappe.get_cached_value(party_type, party, "language") if party else None)
		or document_language
		or frappe.get_system_settings("language")
		or "en"
	)


@frappe.whitelist(methods=["POST"])
def notify_customers(delivery_trip: str):
	"""ERPNext's Delivery Trip send action, with separate language scopes for every stop."""
	from erpnext.stock.doctype.delivery_trip.delivery_trip import get_attachments

	trip = frappe.get_doc("Delivery Trip", delivery_trip)
	trip.check_permission()
	if trip.docstatus != 1:
		frappe.throw(_("Customers can be notified only for a submitted Delivery Trip"))
	for name in {stop.delivery_note for stop in trip.delivery_stops if stop.delivery_note}:
		frappe.has_permission("Delivery Note", "read", doc=name, throw=True)

	name = frappe.db.get_single_value("Delivery Settings", "dispatch_template")
	if not name:
		frappe.throw(_("Missing email template for dispatch. Please set one in Delivery Settings."))
	template = frappe.get_doc("Email Template", name)
	common = trip.as_dict()
	if trip.driver:
		common.update(frappe.db.get_value("Driver", trip.driver, "cell_number", as_dict=True) or {})

	recipients = []
	for stop in trip.delivery_stops:
		contact = (
			frappe.db.get_value(
				"Contact", stop.contact, ["first_name", "last_name", "email_id"], as_dict=True
			)
			if stop.contact
			else None
		)
		if not contact or not contact.email_id:
			continue
		items = (
			frappe.get_all(
				"Delivery Note Item", filters={"parent": stop.delivery_note, "docstatus": 1}, fields=["*"]
			)
			if stop.delivery_note
			else []
		)
		context = {**common, **stop.as_dict(), **contact, "items": items}
		# Email wrappers and the optional native delivery-note attachment share this scope too.
		with print_language(recipient_language("Customer", stop.customer)):
			frappe.sendmail(
				recipients=contact.email_id,
				subject=template.get_formatted_subject(context),
				message=template.get_formatted_response(context),
				attachments=get_attachments(stop),
			)
		stop.db_set("email_sent_to", contact.email_id)
		recipients.append(contact.email_id)

	if recipients:
		frappe.msgprint(_("Email sent to {0}").format(", ".join(recipients)))
		trip.db_set("email_notification_sent", 1)
	else:
		frappe.msgprint(_("No contacts with email IDs found."))


def update_standard_delivery_note():
	"""Enable translation in the stock delivery attachment after ERPNext installs or syncs its layout."""
	name = "Delivery Note Classic"
	layout = frappe.db.get_value(
		"Print Format", {"name": name, "doc_type": "Delivery Note", "standard": "Yes"}, "format_data"
	)
	# SHA256 of ERPNext v16's serialized Delivery Note Classic layout. Leave a changed
	# layout alone, including later upstream versions that may already handle this.
	if not layout or hashlib.sha256(layout.encode()).hexdigest() != (
		"8d3ceab4447267c81961c009f67cbc9d793715ea840a5666cda95fcfceec89da"
	):
		return
	# The first caption is literal HTML. The row index is labelled "No" (the yes/no
	# answer in translation catalogs); "No." is the number heading in native Desk.
	layout = layout.replace("Billed To", "{{ _('Billed To') }}").replace(
		'"label":"No","fieldname":"idx"', '"label":"No.","fieldname":"idx"'
	)
	frappe.db.set_value("Print Format", name, "format_data", layout)
