// Frappe UI's editor exports commands keyed by their English identifiers and
// exposes no locale prop. Transform only captions in its own toolbar and dialogs.
export function localizeRichEditor() {
	return {
		name: "localize-frappe-rich-editor",
		enforce: "pre",
		transform(source, id) {
			const [, file] = id.split("/frappe-ui/src/components/TextEditor/");
			if (!file) return;
			// Updating a controlled prop is never an edit. TipTap 3 emits by default.
			if (file === "TextEditor.vue") {
				return source.replace(
					"commands.setContent(val)",
					"commands.setContent(val, { emitUpdate: false })"
				);
			}
			if (file === "commands.js") {
				return (
					'import { __ } from "@/utils/translate";\n' +
					source.replace(
						/^(\s*)label: ('[^']+'),/gm,
						"$1get label() { return __($2); },"
					)
				);
			}
			if (file === "components/Menu.vue") {
				return source.replace(
					'@click="togglePopover"',
					`
					:title="(getActiveButton(button) || button[0]).label"
					:aria-label="(getActiveButton(button) || button[0]).label"
					@click="togglePopover"`
				);
			}
			if (file === "components/LinkPopup.vue") {
				return source.replace(/tooltip="([^"]+)"/g, `:tooltip="__('$1')"`);
			}
			if (file === "components/FontColor.vue") {
				return source
					.replace(/>(Text Color|Background Color)</g, `>{{ __('$1') }}<`)
					.replace(/:(text|aria-label)="color.name"/g, ':$1="__(color.name)"');
			}
			if (file === "extensions/toc-node/TocNodeView.vue") {
				return source
					.replace("There are no headings in this document.", "{{ __('There are no headings in this document.') }}")
					.replace('title="Remove table of contents"', `:title="__('Remove table of contents')"`);
			}
			if (file === "components/MediaNodeView.vue") {
				return source
					.replace(/(text|label|placeholder)="(Align left|Align center|Align right|Float left|Float right|Remove float|Try again|Add caption)"/g, `:$1="__('$2')"`)
					.replace("Uploading {{ isVideo ? 'video' : 'image' }}...", "{{ isVideo ? __('Uploading video…') : __('Uploading image…') }}")
					.replace("This {{ isVideo ? 'video' : 'image' }} hasn't yet been uploaded.", "{{ isVideo ? __('This video has not been uploaded yet.') : __('This image has not been uploaded yet.') }}")
					.replace("Upload failed: {{ node.attrs.error }}", "{{ __('Upload failed: {0}', [node.attrs.error]) }}");
			}
			if (file === "extensions/iframe/IframeNodeView.vue") {
				return source
					.replace(/(title|placeholder)="(Align Left|Align Center|Align Right|Resize|Add caption)"/g, `:$1="__('$2')"`)
					.replace("Loading embed...", "{{ __('Loading embed…') }}");
			}
			if (file === "extensions/image-group/ImageGroupNodeView.vue") {
				return source.replace('aria-label="Remove image"', `:aria-label="__('Remove image')"`);
			}
			if (file === "extensions/suggestion/SuggestionList.vue") {
				return source.replace(/>\s*No results\s*</, `>{{ __('No results') }}<`);
			}
			if (file === "extensions/iframe/InsertIframe.vue") {
				return source
					.replace("title: 'Insert Embed'", "title: __('Insert Embed')")
					.replace(
						/>\s*(URL or Embed Code|Insert Embed|Cancel)\s*</g,
						`>{{ __('$1') }}<`
					)
					.replace(
						'placeholder="https://youtube.com/watch?v=... or <iframe src=...>"',
						`:placeholder="__('Video URL or iframe embed code')"`
					)
					.replace(
						"✓ Valid {{ platformInfo.platform }} URL",
						"{{ __('Valid {0} URL', [platformInfo.platform]) }}"
					)
					.replace("{{ urlError }}", "{{ __(urlError) }}");
			}
			if (file === "extensions/image-group/ImageGroupUploadDialog.vue") {
				return source
					.replace(
						/'(Edit Images|Upload Images|Click to add caption|Add caption\.\.\.)'/g,
						"__('$1')"
					)
					.replace(
						/(aria-label|placeholder)="(Remove image|Add caption\.\.\.)"/g,
						`:$1="__('$2')"`
					)
					.replace(
						/>\s*(Add images|Drag & drop images here or click to select|Some files failed to upload\.|Cancel|Save|Upload|Drop images anywhere)\s*</g,
						`>{{ __('$1') }}<`
					)
					.replace(
						/Upload more images by dropping them anywhere in this window\. Reorder\s+images by dragging them\. Hover over an image to edit caption\./,
						"{{ __('Drop more images here to upload them. Drag to reorder. Hover over an image to edit its caption.') }}"
					)
					.replace(
						"Uploading: {{ uploadedCount }}/{{ totalCount }}",
						"{{ __('Uploading {0} of {1}', [uploadedCount, totalCount]) }}"
					);
			}
		},
	};
}
