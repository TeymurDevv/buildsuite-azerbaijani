"""Verify the Azerbaijani catalog against this bench's installed source and native Desk boot.

Run from the repository root:
docker compose -f local-runtime/compose.yaml exec -T backend bash -c \
    'cd sites && /home/frappe/frappe-bench/env/bin/python - --site buildsuite.localhost' \
    < testing/verify_desk_az.py

Use --supplement to print the extra keys required by source-controlled Desk metadata
and native Python lookups. --details prints every diagnostic rather than eight examples.
After loading /desk in Azerbaijani, --cached-desk-user USER also checks what the
session will actually reuse; the command does not create a login or rebuild that cache.
Frappe v16 redirects /app to /desk and preserves the route suffix. BuildSuite links
to Accounting, Buying, Stock, Assets and HR (subject to installed apps), query reports,
Projects, Work Packages, Tasks, Stage Planning, Assets, Stock/Expense/Journal Entries,
Purchase Orders/Invoices and Payment Entries. Notifications can open any linked
document. This verifier therefore covers installed packages rather than a route sample.

The native boot loader publishes __messages. frappe/www/desk.html installs that whole
map as frappe._messages. BuildSuite /core also consumes get_messages_for_boot().
Web transport compression does not remove keys. Two Redis caches can retain stale
values: the language-level merged dictionary and per-user bootinfo. After publishing
a CSV, run bench --site SITE clear-cache and reload already-open browser tabs.
Site-specific Translation records and translated country names can override app values.
This comparison reports those overrides without disclosing their site-specific values.
It reads package files and translation APIs without changing business records.
"""

import argparse
import csv
import json
import re
import sys
from collections import Counter, defaultdict
from html.parser import HTMLParser
from pathlib import Path

import frappe
from babel.messages.pofile import read_po
from frappe.boot import load_translations
from frappe.translate import get_translations_from_csv
from frappe.utils import strip

UPSTREAM = ("frappe", "erpnext")
APP = "buildsuite_core"
META = {
    "DocType": ("name",),
    "Workspace": ("label", "title"),
    "Module Onboarding": ("title",),
    "Onboarding Step": ("title", "action_label", "description"),
    "Number Card": ("label",),
    "Dashboard Chart": ("chart_name", "empty_state_message"),
    "Report": ("report_name",),
    "Desktop Icon": ("label",),
    "Workspace Sidebar": ("title",),
    "Sidebar": ("title",),
    "Dock": (),
}
DIRECTORIES = {
    "doctype", "workspace", "workspace_sidebar", "sidebar", "dock",
    "desktop_icon", "report", "number_card", "dashboard_chart", "module_onboarding", "onboarding_step",
}
CHILDREN = {
    "Workspace": ("links", "shortcuts", "charts", "number_cards", "quick_lists", "custom_blocks"),
    "Workspace Sidebar": ("items",),
    "Sidebar": ("items",),
    "Dock": ("items",),
    "Report": ("columns", "filters"),
}
BLOCK_NAMES = (
    "shortcut_name", "card_name", "chart_name", "quick_list_name", "number_card_name",
    "custom_block_name", "onboarding_name",
)
# Databound placeholders can be reordered by a translator. An exact multiset also
# catches lost repeats, unexpected inserts, renamed fields and changed format specs.
ARG = re.compile(
    r"\$\{[^{}]+\}|\{\{.*?\}\}|\{%.*?%\}|"
    r"\{(?:[A-Za-z_]\w*|\d+)?(?:\.\w+|\[[\w.-]+\])*(?:![ars])?(?::[\w.<>=+^,%-]+)?\}|"
    r"(?<!%)%(?!-[^\W\d_])(?:\([\w.]+\))?[#0+\-]*\d*(?:\.\d+)?[diuoxXeEfFgGcrsa](?![a-zA-Z])",
    flags=re.DOTALL,
)


# A quoted delimiter like '{{' is a literal. A real expression may itself
# contain quoted values (e.g. {{ default("User") }}) and must remain intact.
QUOTED_DELIMITER = re.compile(r"""['"“‘](\{\{|\}\})['"”’]""")


def arguments(value):
    delimiters = QUOTED_DELIMITER.findall(value)
    value = QUOTED_DELIMITER.sub(" ", value)
    return Counter(delimiters + ARG.findall(value))


class TextContent(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)


def metadata(app):
    """Only titles and labels shipped in application source, never site records."""
    root = Path(frappe.get_app_path(app))
    for path in sorted(root.rglob("*.json")):
        if not {path.parent.name, path.parent.parent.name} & DIRECTORIES:
            continue
        obj = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(obj, dict) or (kind := obj.get("doctype")) not in META:
            continue
        for field in META[kind]:
            if value := obj.get(field):
                yield value, kind
        if kind == "DocType":
            for field in obj.get("fields", []):
                if value := field.get("label"):
                    yield value, "DocType field"
                if field.get("fieldtype") == "Select":
                    for option in (field.get("options") or "").splitlines():
                        # Digit-only number masks, HTTP codes and naming-series patterns
                        # do not require new UI strings. An actual POT key always counts.
                        if re.search(r"[A-Za-z]", option) and not re.search(r"\.(YY|MM|DD|#)", option):
                            yield option.strip(), "Select option"
        for table in CHILDREN.get(kind, ()):
            for row in obj.get(table) or []:
                for key in ("title", "label", "chart_name", "number_card_name"):
                    if text := row.get(key):
                        yield text, kind + " " + table
        if kind == "Workspace":
            for block in json.loads(obj.get("content") or "[]"):
                data = block.get("data") or {}
                for field in BLOCK_NAMES:
                    if value := data.get(field):
                        yield value, kind + " block"
                if value := data.get("text"):
                    if block.get("type") == "header":
                        parser = TextContent()
                        parser.feed(value)
                        value = "".join(parser.parts)
                    if value.strip():
                        yield value, kind + " block text"


def key(source, context):
    return source + ":" + context if context else source


def required_keys():
    wanted = defaultdict(set)
    by_app = {}
    raw_pot = set()
    for app in UPSTREAM:
        template = Path(frappe.get_app_path(app, "locale", "main.pot"))
        with template.open("rb") as file:
            messages = list(read_po(file))
        counts = Counter()
        for message in messages:
            if not message.id:
                continue
            if message.pluralizable:
                raise ValueError(f"{template} contains plurals; the installed CSV loader requires singular keys")
            context = message.context or ""
            raw_pot.add((message.id, context))
            counts["entries"] += 1
            counts["with_context"] += bool(context)
            if not message.id.strip():
                counts["whitespace_only"] += 1
                continue
            wanted[(message.id, context)].add(app + " POT")
        by_app[app] = dict(counts)
    pot = set(wanted)
    for source, context in sorted(pot):
        if source.strip() and source != source.strip():
            wanted[(source.strip(), context)].add("Python whitespace lookup")
    for app in (*UPSTREAM, APP):
        for source, kind in metadata(app):
            if isinstance(source, str) and source.strip():
                wanted[(source, "")].add(f"{app} {kind}")
    return wanted, pot, by_app, raw_pot


def load_csv(problems):
    path = Path(frappe.get_app_path(APP, "translations", "az.csv"))
    records = {}
    lookup = {}
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        for cells in reader:
            if not cells:
                continue
            if len(cells) not in (2, 3):
                problems["malformed_rows"].append(reader.line_num)
                continue
            source, target = [s.replace(r"\n", "\n") for s in cells[:2]]
            context = cells[2] if len(cells) == 3 else ""
            pair = source, context
            index = key(*pair)
            if index in lookup:
                problems["duplicate_runtime_keys"].append(pair)
            if not source.strip() or not strip(target):
                problems["empty_source_or_translation"].append(pair)
            if arguments(source) != arguments(target):
                problems["incorrect_interpolation"].append(pair)
            records[pair] = strip(target)
            lookup[index] = strip(target)
    return records, lookup


def compare(wanted, records, lookup, problems, cached_user):
    duplicates = defaultdict(set)
    for pair in sorted(wanted):
        duplicates[key(*pair)].add(pair)
        if pair not in records:
            problems["missing_explicit_keys"].append(pair)
    for index, pairs in sorted(duplicates.items()):
        if len(pairs) > 1:
            problems["ambiguous_required_runtime_key"].append(index)

    # A malformed CSV can make Frappe write an Error Log. Skip its loader entirely
    # in that case. The verifier still reports the malformed source rows.
    if problems.get("malformed_rows"):
        return {}
    native_csv = get_translations_from_csv("az", APP)
    if native_csv != lookup:
        problems["native_csv_disagreement"].extend(sorted(
            k for k in native_csv.keys() | lookup.keys() if lookup.get(k) != native_csv.get(k)
        ))
    boot = frappe._dict()
    load_translations(boot)
    messages = boot["__messages"]
    for pair, translation in sorted(records.items()):
        index = key(*pair)
        if messages.get(index) != translation:
            problems["desk_boot_missing_or_overridden"].append(pair)
    cache_count = {}
    if cached_user:
        cached = frappe.cache.hget("bootinfo", cached_user)
        if not cached:
            problems["desk_session"].append("Open native Desk with the selected user, then retry")
        elif cached.get("lang") != "az":
            problems["desk_session"].append("Selected user has no cached Azerbaijani Desk session")
        else:
            cached_map = cached.get("__messages") or {}
            cache_count["cached_session_entries"] = len(cached_map)
            for index, value in lookup.items():
                if cached_map.get(index) != value:
                    problems["cached_desk_boot_missing_or_overridden"].append(index)
    # Cover both native Python lookup paths plus exact JavaScript dictionary
    # membership. Contexts never count as translated from their generic fallback.
    first_for_context = {}
    for source, context in sorted(wanted):
        if context:
            first_for_context.setdefault(context, source)
    samples = [(s, c) for c, s in sorted(first_for_context.items())]
    samples.extend((s, "") for s in ("Accounting", "Buying", "Stock", "Assets", "Home", "Stock Balance", "Settings"))
    for source, context in samples:
        expected = records.get((source.strip(), context))
        if expected and frappe._(source, lang="az", context=context or None) != expected:
            problems["native_python_disagreement"].append((source, context))
    return {"boot_entries": len(messages), "python_lookup_samples": len(samples), **cache_count}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site", required=True)
    parser.add_argument("--supplement", action="store_true", help="export source-controlled extras beyond POT as JSON")
    parser.add_argument("--details", action="store_true")
    parser.add_argument("--cached-desk-user", metavar="USER", help="also check the existing az native Desk session boot")

    args = parser.parse_args()
    frappe.init(site=args.site, sites_path=str(Path.cwd()))
    try:
        frappe.connect()
        frappe.local.lang = "az"
        installed = frappe.get_installed_apps()
        if set((*UPSTREAM, APP)) - set(installed):
            raise RuntimeError("The selected site needs Frappe, ERPNext and BuildSuite Core")
        wanted, pot, by_app, raw_pot = required_keys()
        if args.supplement:
            print(json.dumps([
                {"source": s, "context": c, "origins": sorted(wanted[(s, c)])}
                for s, c in sorted(wanted.keys() - pot)
            ], ensure_ascii=False, indent=2))
            return 0
        problems = defaultdict(list)
        records, lookup = load_csv(problems)
        observed = compare(wanted, records, lookup, problems, args.cached_desk_user)
        print(json.dumps({
            "installed_versions": {name: frappe.get_attr(f"{name}.__version__") for name in (*UPSTREAM, APP)},
            "pot": by_app, "unique_pot_keys": len(raw_pot),
            "whitespace_only_pot_keys": len(raw_pot - pot), "translatable_pot_keys": len(pot),
            "required_supplement": len(wanted.keys() - pot),
            "required_keys": len(wanted), "csv_keys": len(records), **observed,
            "identical_to_source_including_names_and_codes": sum(
                v == s for (s, _), v in records.items()
            ),
            "errors": {k: {"count": len(v), "examples": v if args.details else v[:8]}
                       for k, v in sorted(problems.items()) if v},
        }, ensure_ascii=False, indent=2))
        return int(any(problems.values()))
    finally:
        frappe.destroy()


if __name__ == "__main__":
    sys.exit(main())
