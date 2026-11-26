import { ROLES, ROLE_TO_PERSONA } from "../data/roles.js";
import { __, standardLinkLabel } from "./translate.js";

const personaNames = new Set(ROLES.map((role) => role.name));

// Custom record names may be dictionary words. Only package identities receive
// translations, including the pre-existing persona labels in other locales.
export function standardSettingsLabel(doctype, id) {
	const bundledRole = doctype === "Role" && Object.hasOwn(ROLE_TO_PERSONA, id);
	const bundledPersona = doctype === "Persona" && personaNames.has(id);
	return standardLinkLabel(doctype, id, bundledRole || bundledPersona ? __(id) : id);
}
