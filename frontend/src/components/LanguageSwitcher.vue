<script setup>
import { onMounted, ref } from "vue";
import { frappeRequest } from "frappe-ui-frappe-request";
import { __, currentLang } from "@/utils/translate";
import { getSessionUser } from "@/utils/session";
import { parseFrappeError } from "@/utils/frappeError";
import { showToast } from "@/utils/appToast";

const active = currentLang();
const language = ref(active);
const saving = ref(false);
const options = ref([active]);

function languageName(code) {
	if (code === "az") return "Azərbaycan dili";
	if (code === "en") return "English";
	try {
		return new Intl.DisplayNames([code], { type: "language" }).of(code);
	} catch {
		return code;
	}
}

onMounted(async () => {
	try {
		const enabled = await frappeRequest({ url: "frappe.translate.get_all_languages" });
		options.value = [...new Set([active, ...enabled])];
	} catch (error) {
		showToast(parseFrappeError(error).summary || __("Could not load languages."), "error");
	}
});

async function changeLanguage() {
	if (language.value === active || saving.value) return;
	saving.value = true;
	try {
		// Frappe's own User Settings dialog saves User.language and refreshes the boot payload.
		await frappeRequest({
			url: "frappe.client.set_value",
			params: {
				doctype: "User",
				name: getSessionUser(),
				fieldname: "language",
				value: language.value,
			},
		});
		window.location.reload();
	} catch (error) {
		language.value = active;
		saving.value = false;
		showToast(parseFrappeError(error).summary || __("Could not save language."), "error");
	}
}
</script>

<template>
	<label class="flex items-center gap-2 text-xs text-ink-700">
		<span class="sr-only sm:not-sr-only">{{ __("Language") }}</span>
		<select
			v-model="language"
			class="min-w-0 max-w-32 flex-1 rounded border border-ink-200 bg-white px-1 py-1 text-xs text-ink-900"
			:disabled="saving || options.length < 2"
			@change="changeLanguage"
		>
			<option v-for="code in options" :key="code" :lang="code" :value="code">
				{{ languageName(code) }}
			</option>
		</select>
	</label>
</template>
