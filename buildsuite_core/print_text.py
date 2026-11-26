# Copyright (c) 2026, Infraholic Innovations Pvt. Ltd and contributors
# For license information, please see license.txt

import re

import frappe
from frappe import _

RFQ_MESSAGE = "Dear Sir / Madam,\n\nPlease send us your best quotation for the items below, delivered to the project site."


def buildsuite_print_terms(value):
	"""Translate only an unedited copy of a BuildSuite clause. Keep saved commercial terms verbatim."""
	from buildsuite_core.install import INVOICE_TERMS, RFQ_TERMS

	if value == RFQ_TERMS or any(value == terms for _, terms in INVOICE_TERMS):
		return _(value)
	return value


def buildsuite_rfq_message(message, contact=None, default_greeting=False):
	"""Localize the supplied default in either interface language, retaining the sender's own text."""
	text = frappe.utils.strip_html(message) if "<" in (message or "") else message
	text = (text or "").strip()
	if text in {RFQ_MESSAGE, _(RFQ_MESSAGE, lang="az")}:
		text = _(RFQ_MESSAGE)
	starts_with_greeting = re.match(r"^(?:Dear\b|Hörmətli\b)", text, flags=re.IGNORECASE)
	contact = (contact or "").strip()
	if contact:
		# Replace a separate salutation line. A sentence following the name on the same
		# line is authored content and must survive the recipient substitution.
		body = re.sub(r"^(?:Dear\b|Hörmətli\b)[^,\n]*,[ \t]*(?:\n+|$)", "", text, flags=re.IGNORECASE)
		return "\n\n".join(t for t in (_("Dear {0},").format(contact), body) if t)
	if default_greeting and not starts_with_greeting:
		return "\n\n".join(t for t in (_("Dear Sir / Madam,"), text) if t)
	return text
