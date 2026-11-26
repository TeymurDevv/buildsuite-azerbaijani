// ERPNext stores translated account names at company creation. For charts created
// in English, translate only known labels in their standard parent account.
(() => {
	if (!/^az(?:[-_]Latn)?(?:[-_]AZ)?$/i.test(frappe.boot.lang || "")) return;
	const standardParents = {
		"Application of Funds (Assets)": null,
		"Current Assets": "Application of Funds (Assets)",
		"Accounts Receivable": "Current Assets",
		"Debtors": "Accounts Receivable",
		"Bank Accounts": "Current Assets",
		"Cash In Hand": "Current Assets",
		"Cash": "Cash In Hand",
		"Loans and Advances (Assets)": "Current Assets",
		"Employee Advances": "Loans and Advances (Assets)",
		"Securities and Deposits": "Current Assets",
		"Earnest Money": "Securities and Deposits",
		"Prepaid Expenses": "Current Assets",
		"Short-term Investments": "Current Assets",
		"Stock Assets": "Current Assets",
		"Stock In Hand": "Stock Assets",
		"Tax Assets": "Current Assets",
		"Fixed Assets": "Application of Funds (Assets)",
		"Capital Equipment": "Fixed Assets",
		"Electronic Equipment": "Fixed Assets",
		"Furniture and Fixtures": "Fixed Assets",
		"Office Equipment": "Fixed Assets",
		"Plants and Machineries": "Fixed Assets",
		"Buildings": "Fixed Assets",
		"Software": "Fixed Assets",
		"Accumulated Depreciation": "Fixed Assets",
		"CWIP Account": "Fixed Assets",
		"Investments": "Application of Funds (Assets)",
		"Temporary Accounts": "Application of Funds (Assets)",
		"Temporary Opening": "Temporary Accounts",
		"Expenses": null,
		"Direct Expenses": "Expenses",
		"Stock Expenses": "Direct Expenses",
		"Cost of Goods Sold": "Stock Expenses",
		"Expenses Included In Asset Valuation": "Stock Expenses",
		"Expenses Included In Valuation": "Stock Expenses",
		"Stock Adjustment": "Stock Expenses",
		"Indirect Expenses": "Expenses",
		"Administrative Expenses": "Indirect Expenses",
		"Commission on Sales": "Indirect Expenses",
		"Depreciation": "Indirect Expenses",
		"Entertainment Expenses": "Indirect Expenses",
		"Freight and Forwarding Charges": "Indirect Expenses",
		"Legal Expenses": "Indirect Expenses",
		"Marketing Expenses": "Indirect Expenses",
		"Miscellaneous Expenses": "Indirect Expenses",
		"Office Maintenance Expenses": "Indirect Expenses",
		"Office Rent": "Indirect Expenses",
		"Postal Expenses": "Indirect Expenses",
		"Print and Stationery": "Indirect Expenses",
		"Round Off": "Indirect Expenses",
		"Salary": "Indirect Expenses",
		"Sales Expenses": "Indirect Expenses",
		"Telephone Expenses": "Indirect Expenses",
		"Travel Expenses": "Indirect Expenses",
		"Utility Expenses": "Indirect Expenses",
		"Write Off": "Indirect Expenses",
		"Exchange Gain/Loss": "Indirect Expenses",
		"Interest Expense": "Indirect Expenses",
		"Bank Charges": "Indirect Expenses",
		"Gain/Loss on Asset Disposal": "Indirect Expenses",
		"Impairment": "Indirect Expenses",
		"Tax Expense": "Indirect Expenses",
		"Income": null,
		"Direct Income": "Income",
		"Sales": "Direct Income",
		"Service": "Direct Income",
		"Indirect Income": "Income",
		"Interest Income": "Indirect Income",
		"Interest on Fixed Deposits": "Indirect Income",
		"Source of Funds (Liabilities)": null,
		"Current Liabilities": "Source of Funds (Liabilities)",
		"Accounts Payable": "Current Liabilities",
		"Creditors": "Accounts Payable",
		"Payroll Payable": "Accounts Payable",
		"Accrued Expenses": "Current Liabilities",
		"Customer Advances": "Current Liabilities",
		"Stock Liabilities": "Current Liabilities",
		"Stock Received But Not Billed": "Stock Liabilities",
		"Asset Received But Not Billed": "Stock Liabilities",
		"Duties and Taxes": "Current Liabilities",
		"Short-term Provisions": "Current Liabilities",
		"Loans (Liabilities)": "Current Liabilities",
		"Secured Loans": "Loans (Liabilities)",
		"Unsecured Loans": "Loans (Liabilities)",
		"Bank Overdraft Account": "Loans (Liabilities)",
		"Non-Current Liabilities": "Source of Funds (Liabilities)",
		"Long-term Provisions": "Non-Current Liabilities",
		"Employee Benefits Obligation": "Non-Current Liabilities",
		"Equity": null,
		"Capital Stock": "Equity",
		"Dividends Paid": "Equity",
		"Opening Balance Equity": "Equity",
		"Retained Earnings": "Equity",
		"Revaluation Surplus": "Equity"
	};
	const settings = frappe.treeview_settings?.Account;
	if (typeof settings?.get_label !== "function") return;
	const originalLabel = settings.get_label;
	settings.get_label = function (node) {
		const name = node.data?.account_name;
		if (Object.prototype.hasOwnProperty.call(standardParents, name)) {
			const parent = node.parent_node;
			const expected = standardParents[name];
			const parentName = parent?.data?.account_name;
			if ((expected === null && parent?.is_root)
				|| (expected !== null && (parentName === expected || parentName === __(expected)))) {
				// Delegate formatting, escaping and any account-number presentation
				// to ERPNext without changing the stored record or navigation ID.
				const displayNode = Object.create(node);
				displayNode.data = { ...node.data, account_name: __(name, null, "Account") };
				return originalLabel.call(this, displayNode);
			}
		}
		return originalLabel.call(this, node);
	};
})();
