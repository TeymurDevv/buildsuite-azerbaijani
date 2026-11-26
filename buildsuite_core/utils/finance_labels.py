"""Display names of the three shipped bank/cash ledgers. Account IDs remain posting keys."""

import frappe
from frappe import _

_STANDARD = {
	"Bank": ("Bank", "Bank Accounts"),
	"Cash": ("Cash", "Cash In Hand"),
	"Petty Cash": ("Cash", "Cash In Hand"),
}


def money_account_rows(company, filters=None, *, balances=False, sort_by_title=False):
	rows = frappe.get_all(
		"Account",
		filters={
			"company": company,
			"is_group": 0,
			"account_type": ["in", ["Bank", "Cash"]],
			**(filters or {}),
		},
		fields=[
			"name",
			"account_name",
			"account_type",
			"parent_account.account_name as parent_name",
			*(["account_number", "bs_opening_balance"] if balances else []),
		],
		order_by="account_type, account_name" if sort_by_title else "account_type, name",
	)
	for row in rows:
		parent_name = row.pop("parent_name")
		title = row.account_name
		expected = _STANDARD.get(title)
		if (
			expected
			and row.account_type == expected[0]
			and parent_name in {expected[1], _(expected[1], context="Account")}
		):
			title = _(title, context="Account")
		row.display_name = title
		row.display_id = (
			row.name.replace(row.account_name, title, 1) if title != row.account_name else row.name
		)
	return rows
