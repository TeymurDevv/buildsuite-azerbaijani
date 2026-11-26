"""Integrity checks for the catalog consumed by Frappe and the Vue application."""

import csv
import re
import unittest
from collections import Counter
from pathlib import Path

CATALOGS = Path(__file__).resolve().parents[1] / "translations"
TOKENS = re.compile(r"\{[\w.:-]*\}|%(?:\(\w+\))?[sdif]|</?[a-zA-Z][^<>]*>")


def rows(language):
	with (CATALOGS / f"{language}.csv").open(encoding="utf-8", newline="") as catalog:
		return list(csv.reader(catalog))


class AzerbaijaniCatalogTest(unittest.TestCase):
	def test_keys_are_unique_and_values_preserve_format_arguments_and_markup(self):
		messages = rows("az")
		seen = set()
		for record in messages:
			self.assertIn(len(record), (2, 3), record)
			source, translated, *context = record
			key = (source, tuple(context))
			self.assertNotIn(key, seen)
			seen.add(key)
			self.assertTrue(source.strip() and translated.strip(), key)
			self.assertEqual(Counter(TOKENS.findall(source)), Counter(TOKENS.findall(translated)), key)

	def test_catalog_includes_upstream_ui_keys_and_localized_login(self):
		messages = {row[0]: row[1] for row in rows("az")}
		self.assertFalse({row[0] for row in rows("fr")} - messages.keys())
		for source in ("Sign In", "Purchase orders", "Work packages", "Measurement book", "Save"):
			self.assertNotEqual(messages[source], source)
		self.assertEqual(messages["Home"], "Ana səhifə")
		self.assertEqual(messages["Language"], "Dil")
