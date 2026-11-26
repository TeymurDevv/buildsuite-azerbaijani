"""Expose the manat glyph from Frappe's bundled OFL font to Linux PDF engines.

Register only the missing symbol. Registering the entire Inter face also changes the
numeral font in classic layouts, whose tabular alternatives extract as private-use glyphs.
"""

from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

source = Path("apps/frappe/frappe/public/css/fonts/inter")
destination = Path.home() / ".local/share/fonts"
destination.mkdir(parents=True, exist_ok=True)
for weight in ("Regular", "Bold"):
	font = TTFont(source / f"Inter-{weight}.woff2")
	options = subset.Options()
	options.name_IDs = ["*"]  # Keep the upstream copyright and license in the derived font.
	subsetter = subset.Subsetter(options=options)
	subsetter.populate(unicodes=[0x20BC])
	subsetter.subset(font)
	names = {
		1: "BuildSuite Manat",
		2: weight,
		3: f"BuildSuite-Manat-{weight}",
		4: f"BuildSuite Manat {weight}",
		6: f"BuildSuiteManat-{weight}",
		16: "BuildSuite Manat",
		17: weight,
	}
	for record in font["name"].names:
		if record.nameID in names:
			record.string = names[record.nameID].encode(record.getEncoding())
	font.flavor = None
	font.save(destination / f"BuildSuiteManat-{weight}.ttf")
