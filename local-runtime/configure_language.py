"""Set the local site's and Administrator's language. Run from its bench directory."""
import os
from datetime import date
from pathlib import Path

import frappe
from frappe.translate import set_default_language

os.chdir(Path("sites").resolve())
frappe.init(site="buildsuite.localhost", sites_path=str(Path.cwd()))
try:
    frappe.connect()
    frappe.set_user("Administrator")
    if not frappe.db.exists("Language", "az"):
        frappe.get_doc({
            "doctype": "Language", "language_code": "az",
            "language_name": "Azərbaycan dili", "enabled": 1,
        }).insert(ignore_permissions=True)
    elif not frappe.db.get_value("Language", "az", "enabled"):
        frappe.db.set_value("Language", "az", "enabled", 1)
    if not frappe.is_setup_complete():
        from frappe.desk.page.setup_wizard.setup_wizard import setup_complete

        if not frappe.db.exists("Currency", "AZN"):
            frappe.get_doc({
                "doctype": "Currency", "currency_name": "AZN", "enabled": 1,
                "symbol": "₼", "fraction": "qəpik", "fraction_units": 100,
                "smallest_currency_fraction_value": 0.01,
            }).insert(ignore_permissions=True)
        year = date.today().year
        response = setup_complete({
            "language": frappe.db.get_value("Language", "az", "language_name"),
            "country": "Azerbaijan", "currency": "AZN", "timezone": "Asia/Baku",
            "company_name": "BuildSuite Demo", "company_abbr": "BSAZ",
            "chart_of_accounts": "Standard", "fy_start_date": f"{year}-01-01",
            "fy_end_date": f"{year}-12-31", "enable_telemetry": 0,
            "allow_recording_first_session": 0,
        })
        if response.get("status") != "ok" or not frappe.is_setup_complete():
            raise RuntimeError(f"ERPNext setup wizard did not finish: {response}")
        frappe.db.set_single_value("System Settings", "language", "az")
        set_default_language("az")
        frappe.db.set_value("User", "Administrator", "language", "az")
    frappe.db.commit()
    frappe.clear_cache()
    print("The local site is configured. Existing language preferences have been preserved.")
finally:
    frappe.destroy()
