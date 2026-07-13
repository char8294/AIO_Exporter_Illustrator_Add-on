# AIO Exporter for Adobe Illustrator 2026

AIO Exporter v1.5.0 is a local Adobe Illustrator CEP panel and fallback JSX script for exporting the active document to selected output formats:

- `.ai`
- `.pdf`
- `.png`

The panel lets you choose which formats to export, pick a folder with the system folder picker, adjust settings in tabs for each file format, choose shared artboard saving rules, and run everything from one **Export Selected** button.

The CEP panel remembers the latest selected formats, artboard choice, and format settings locally, then restores them the next time the panel opens. The export folder and base file name follow the currently open Illustrator document.

## Install as a CEP Panel

Run this PowerShell script from the project folder:

```powershell
.\Install-CEP-Panel.ps1
```

Or double-click:

```text
Install-CEP-Panel.bat
```

If Windows blocks script execution, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\Install-CEP-Panel.ps1
```

Restart Illustrator, then open:

```text
Window > Extensions > AIO Exporter
```

The installer copies `cep-panel` into the user CEP extensions folder, enables unsigned CEP panels for local development, and removes the old `com.local.tripleformatexporter` install folder if it exists.

## Uninstall the CEP Panel

Double-click:

```text
Uninstall-CEP-Panel.bat
```

Or run:

```powershell
.\Uninstall-CEP-Panel.ps1
```

The uninstaller removes only the `com.local.aioexporter` CEP extension folder from the user CEP extensions folder. It leaves Adobe CEP debug registry settings unchanged in case another local CEP extension still needs them.

## Run the Fallback Script Directly

1. Open Illustrator 2026.
2. Open the document you want to export.
3. Go to `File > Scripts > Other Script...`.
4. Choose `scripts/AIO_Exporter.jsx` from this project.
5. Choose the export folder, base name, formats, and settings.
6. Press `Export`.

To make the script appear permanently in Illustrator's script menu, copy this file:

```text
scripts/AIO_Exporter.jsx
```

to an Illustrator scripts folder such as:

```text
C:\Program Files\Adobe\Adobe Illustrator 2026\Presets\en_US\Scripts
```

Then restart Illustrator.

## Export Behavior

- If `Overwrite existing files` is off and a selected output already exists, AIO Exporter appends `_01`, `_02`, and so on.
- Duplicate-name checks only consider the selected formats.
- PDF and PNG export before AI so the open document returns to the `.ai` save target when AI is selected.
- AI save writes the full Illustrator document and does not use the shared artboard selection.
- PNG scale is a percentage; `100%` is Illustrator's normal export size.
- Artboard settings show Illustrator artboard names in a right-flowing checkbox grid, plus All and Range controls for PDF and clipped PNG exports.
- PDF settings use PDF presets reported by Illustrator and can export selected artboards as one multi-page PDF or separate one-page PDF files.
- PNG settings export the selected artboards as separate `_01`, `_02`, ... files when artboard clipping is used, and still support include bleed or full-document export.
- Artboard selection uses lightweight checkboxes so the panel opens without generating preview files.
- AI settings expose the Illustrator save version, PDF compatibility, linked file embedding, ICC profile embedding, compression, font subsetting, and legacy transparency flattening.
- AI save version choices are grouped like Illustrator's Save Options list, with unsupported font-preview and legacy-transparency settings disabled automatically.
- CEP panel settings are saved in the panel's local storage. The direct JSX fallback script starts from defaults each time.
- The panel header shows the installed version and includes an icon update button that checks GitHub releases/tags and installs newer builds from a single GitHub archive.
- PDF preset choices refresh from Illustrator each time PDF settings are opened.
