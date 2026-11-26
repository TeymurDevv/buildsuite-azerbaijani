import frappe


def localize_login_title(context):
	"""Frappe's login controller sets the browser title to the English literal."""
	request = getattr(frappe.local, "request", None)
	if request and request.path.rstrip("/") == "/login" and context.get("title") == "Login":
		return {"title": frappe._("Login")}
