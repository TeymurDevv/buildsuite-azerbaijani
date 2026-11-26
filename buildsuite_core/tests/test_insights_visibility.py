from unittest import TestCase
from unittest.mock import patch

import frappe

from buildsuite_core.api.insights import line_dataset


class TestInsightsVisibility(TestCase):
	def test_parent_read_denied_skips_all_queries(self):
		with (
			patch.object(frappe, "has_permission", return_value=False),
			patch.object(frappe, "get_list") as visible,
			patch.object(frappe, "get_all") as children,
		):
			for source in ("receiptLines", "consumptionLines", "expenses", "attendance"):
				self.assertEqual(line_dataset(source), [])
			visible.assert_not_called()
			children.assert_not_called()

	def test_children_are_scoped_to_permission_filtered_parents(self):
		for source, doctype in (
			("receiptLines", "Purchase Receipt"),
			("consumptionLines", "Stock Entry"),
			("expenses", "Expense Entry"),
			("attendance", "Field Attendance"),
		):
			with (
				self.subTest(source=source),
				patch.object(frappe, "has_permission", return_value=True),
				patch.object(frappe, "get_list", return_value=[{"name": "VISIBLE"}]) as visible,
				patch.object(frappe, "get_all", return_value=[]) as children,
			):
				self.assertEqual(line_dataset(source), [])
				self.assertEqual(visible.call_args.args[0], doctype)
				self.assertEqual(visible.call_args.kwargs["limit_page_length"], 0)
				self.assertEqual(
					children.call_args.kwargs["filters"],
					{
						"parenttype": doctype,
						"parent": ["in", ["VISIBLE"]],
					},
				)
