<script setup>
// The filter strip every report sits under — one component so reports don't each invent
// their own bar: same chrome, same Clear affordance, plus the two things a filtered report
// must have — a live "N of M" count (so a narrowed report is never mistaken for the whole
// set) and a Clear that appears only when something is actually filtering. Reports pass
// their own controls through the default slot. print:hidden — a filter row is a control,
// not part of the printed document.
import { __ } from "@/utils/translate";

const props = defineProps({
	active: { type: Boolean, default: false }, // true when ≥1 filter is set → Clear appears
	shown: { type: Number, default: null }, // rows currently shown
	total: { type: Number, default: null }, // rows before filtering
	noun: { type: String, default: "rows" },
});
const countMessages = {
	rows: ["{0} row", "{0} rows", "{0} of {1} rows"],
	requests: ["{0} request", "{0} requests", "{0} of {1} requests"],
	orders: ["{0} order", "{0} orders", "{0} of {1} orders"],
	items: ["{0} item", "{0} items", "{0} of {1} items"],
	lines: ["{0} line", "{0} lines", "{0} of {1} lines"],
	accounts: ["{0} account", "{0} accounts", "{0} of {1} accounts"],
	movements: ["{0} movement", "{0} movements", "{0} of {1} movements"],
	expenses: ["{0} expense", "{0} expenses", "{0} of {1} expenses"],
};
function countLabel() {
	const { noun, shown, total } = props;
	const different = total !== null && shown !== total;
	const messages = Object.hasOwn(countMessages, noun) && countMessages[noun];
	if (messages) return __(messages[different ? 2 : shown === 1 ? 0 : 1], [shown, total]);
	return different
		? __("{0} of {1} {2}", [shown, total, __(noun)])
		: [shown, __(noun)].join(" ");
}
defineEmits(["clear"]);
</script>

<template>
	<div
		class="bg-ink-50 border border-ink-200 px-3 py-2 mb-3 flex items-center gap-x-4 gap-y-2 flex-wrap print:hidden"
		style="border-radius: 6px"
	>
		<slot />

		<div class="ml-auto flex items-center gap-3">
			<span v-if="shown !== null" class="text-[11px] text-ink-500 tabular-nums">
				{{ countLabel() }}
			</span>
			<button
				v-if="active"
				type="button"
				class="text-[11px] text-brand-700 hover:underline"
				@click="$emit('clear')"
			>
				{{ __("Clear filters") }}
			</button>
		</div>
	</div>
</template>
