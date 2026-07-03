# AIO Exporter for Adobe Illustrator 2026

AIO Exporter is a local Adobe Illustrator CEP panel and fallback JSX script for exporting the active document to selected output formats:

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

If Windows blocks script execution, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\Install-CEP-Panel.ps1
```

Restart Illustrator, then open:

```text
Window > Extensions > AIO Exporter
```

The installer copies `cep-panel` into the user CEP extensions folder, enables unsigned CEP panels for local development, and removes the old `com.local.tripleformatexporter` install folder if it exists.

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
- PNG scale is a percentage; `100%` is Illustrator's normal export size.
- Artboard settings support all artboards or a custom range like `1,3-5` for AI/PDF saves.
- PDF settings use PDF presets reported by Illustrator and can export selected artboards as one multi-page PDF or separate one-page PDF files.
- PNG settings support artboard clipping, include bleed, or full-document export.
- AI settings expose the Illustrator save version, PDF compatibility, linked file embedding, ICC profile embedding, compression, font subsetting, and legacy transparency flattening.
- CEP panel settings are saved in the panel's local storage. The direct JSX fallback script starts from defaults each time.
