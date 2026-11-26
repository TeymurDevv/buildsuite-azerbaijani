import { __, currentLang } from "./translate.js";

// ERPNext installs these modes as records. Other names are chosen by the business.
const standardPaymentModes = new Set([
	"Cash",
	"Cheque",
	"Check",
	"Credit Card",
	"Wire Transfer",
	"Bank Draft",
]);

export function paymentModeLabel(value) {
	if (!standardPaymentModes.has(value)) return value;
	if (value === "Check" && /^az(?:[-_]|$)/i.test(currentLang())) return __("Cheque");
	return __(value);
}
