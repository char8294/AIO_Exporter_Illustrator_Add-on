#target illustrator

/*
  AIO Exporter for Adobe Illustrator
  Exports the active document to selected AI, PDF, and PNG outputs.
*/
(function () {
    var APP_NAME = "AIO Exporter";

    function trim(value) {
        return String(value).replace(/^\s+|\s+$/g, "");
    }

    function stripExtension(name) {
        return String(name).replace(/\.[^\.]+$/, "");
    }

    function sanitizeFileName(name) {
        var cleaned = trim(name).replace(/[\\\/:\*\?"<>\|]/g, "_");
        cleaned = cleaned.replace(/\s+/g, " ");
        return cleaned.length ? cleaned : "Illustrator_Export";
    }

    function folderFromDocument(doc) {
        try {
            if (doc.path && doc.path.exists) {
                return doc.path;
            }
        } catch (ignored) {}

        if (Folder.myDocuments) {
            return Folder.myDocuments;
        }

        return Folder.desktop;
    }

    function fallbackFolder() {
        if (Folder.myDocuments) {
            return Folder.myDocuments;
        }

        return Folder.desktop;
    }

    function decodeName(name) {
        try {
            return decodeURI(name);
        } catch (ignored) {
            return name;
        }
    }

    function defaultBaseName(doc) {
        return sanitizeFileName(stripExtension(decodeName(doc.name || "Illustrator_Export")));
    }

    function padNumber(value) {
        return value < 10 ? "0" + value : String(value);
    }

    function bool(value, fallback) {
        return typeof value === "boolean" ? value : fallback;
    }

    function parseScale(value) {
        var scale = Number(String(value).replace(/[^0-9\.]/g, ""));
        if (isNaN(scale) || scale <= 0) {
            return 100;
        }
        if (scale > 1000) {
            return 1000;
        }
        return Math.round(scale);
    }

    function quoteJson(value) {
        return '"' + String(value)
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n")
            .replace(/\t/g, "\\t") + '"';
    }

    function hasAnyExisting(files) {
        for (var i = 0; i < files.length; i += 1) {
            if (files[i].exists) {
                return true;
            }
        }
        return false;
    }

    function hasSelectedFormat(formats) {
        return !!(formats && (formats.ai || formats.pdf || formats.png));
    }

    function buildFiles(folder, baseName, overwrite, formats) {
        var safeBase = sanitizeFileName(baseName);
        var candidate = safeBase;
        var index = 1;
        var files;
        var result;

        do {
            files = [];
            result = {
                baseName: candidate
            };

            if (formats.ai) {
                result.ai = new File(folder.fsName + "/" + candidate + ".ai");
                files.push(result.ai);
            }
            if (formats.pdf) {
                result.pdf = new File(folder.fsName + "/" + candidate + ".pdf");
                files.push(result.pdf);
            }
            if (formats.png) {
                result.png = new File(folder.fsName + "/" + candidate + ".png");
                files.push(result.png);
            }

            if (overwrite || !hasAnyExisting(files)) {
                return result;
            }

            candidate = safeBase + "_" + padNumber(index);
            index += 1;
        } while (index < 1000);

        throw new Error("Could not create a unique file name.");
    }

    function defaultSettingsForDocument(doc) {
        return {
            folder: folderFromDocument(doc),
            baseName: defaultBaseName(doc),
            overwrite: false,
            formats: {
                ai: true,
                pdf: true,
                png: true
            },
            ai: {
                pdfCompatible: true,
                compressed: true,
                embedICCProfile: true
            },
            pdf: {
                preserveEditability: true,
                generateThumbnails: true,
                viewAfterSaving: false
            },
            png: {
                scale: 100,
                transparency: true,
                artBoardClipping: true,
                antiAliasing: true
            }
        };
    }

    function normalizeSettings(rawSettings, doc) {
        var defaults = defaultSettingsForDocument(doc);
        var raw = rawSettings || {};
        var rawFormats = raw.formats || defaults.formats;
        var rawAi = raw.ai || {};
        var rawPdf = raw.pdf || {};
        var rawPng = raw.png || {};
        var folder = raw.folder && raw.folder.fsName ? raw.folder : (raw.folder ? new Folder(raw.folder) : defaults.folder);

        return {
            folder: folder,
            baseName: trim(raw.baseName || defaults.baseName),
            overwrite: bool(raw.overwrite, defaults.overwrite),
            formats: {
                ai: bool(rawFormats.ai, false),
                pdf: bool(rawFormats.pdf, false),
                png: bool(rawFormats.png, false)
            },
            ai: {
                pdfCompatible: bool(rawAi.pdfCompatible, defaults.ai.pdfCompatible),
                compressed: bool(rawAi.compressed, defaults.ai.compressed),
                embedICCProfile: bool(rawAi.embedICCProfile, defaults.ai.embedICCProfile)
            },
            pdf: {
                preserveEditability: bool(rawPdf.preserveEditability, defaults.pdf.preserveEditability),
                generateThumbnails: bool(rawPdf.generateThumbnails, defaults.pdf.generateThumbnails),
                viewAfterSaving: bool(rawPdf.viewAfterSaving, defaults.pdf.viewAfterSaving)
            },
            png: {
                scale: parseScale(rawPng.scale),
                transparency: bool(rawPng.transparency, defaults.png.transparency),
                artBoardClipping: bool(rawPng.artBoardClipping, defaults.png.artBoardClipping),
                antiAliasing: bool(rawPng.antiAliasing, defaults.png.antiAliasing)
            }
        };
    }

    function validateSettings(settings) {
        if (!settings.folder || !settings.folder.exists) {
            throw new Error("Folder does not exist: " + (settings.folder ? settings.folder.fsName : ""));
        }

        if (!trim(settings.baseName).length) {
            throw new Error("Please enter a base file name.");
        }

        if (!hasSelectedFormat(settings.formats)) {
            throw new Error("Select at least one export format.");
        }
    }

    function saveAi(doc, file, settings) {
        var options = new IllustratorSaveOptions();
        options.pdfCompatible = settings.ai.pdfCompatible;
        options.compressed = settings.ai.compressed;
        options.embedICCProfile = settings.ai.embedICCProfile;
        doc.saveAs(file, options);
    }

    function savePdf(doc, file, settings) {
        var options = new PDFSaveOptions();
        options.preserveEditability = settings.pdf.preserveEditability;
        options.generateThumbnails = settings.pdf.generateThumbnails;
        options.viewAfterSaving = settings.pdf.viewAfterSaving;
        doc.saveAs(file, options);
    }

    function exportPng(doc, file, settings) {
        var options = new ExportOptionsPNG24();
        options.antiAliasing = settings.png.antiAliasing;
        options.transparency = settings.png.transparency;
        options.artBoardClipping = settings.png.artBoardClipping;
        options.horizontalScale = settings.png.scale;
        options.verticalScale = settings.png.scale;
        doc.exportFile(file, ExportType.PNG24, options);
    }

    function exportAll(settings) {
        if (app.documents.length === 0) {
            throw new Error("No Illustrator document is open.");
        }

        validateSettings(settings);

        var doc = app.activeDocument;
        var files = buildFiles(settings.folder, settings.baseName, settings.overwrite, settings.formats);
        var originalInteraction = app.userInteractionLevel;

        try {
            app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

            if (settings.formats.pdf) {
                savePdf(doc, files.pdf, settings);
            }
            if (settings.formats.png) {
                exportPng(doc, files.png, settings);
            }
            if (settings.formats.ai) {
                saveAi(doc, files.ai, settings);
            }
        } finally {
            app.userInteractionLevel = originalInteraction;
        }

        return files;
    }

    function exportedLabels(settings) {
        var labels = [];

        if (settings.formats.ai) {
            labels.push("AI");
        }
        if (settings.formats.pdf) {
            labels.push("PDF");
        }
        if (settings.formats.png) {
            labels.push("PNG");
        }

        return labels.join(", ");
    }

    function exportedPaths(files, settings) {
        var paths = [];

        if (settings.formats.ai && files.ai) {
            paths.push(files.ai.fsName);
        }
        if (settings.formats.pdf && files.pdf) {
            paths.push(files.pdf.fsName);
        }
        if (settings.formats.png && files.png) {
            paths.push(files.png.fsName);
        }

        return paths.join("\n");
    }

    function getDefaultsJson() {
        var hasDocument = app.documents.length > 0;
        var folder = hasDocument ? folderFromDocument(app.activeDocument) : fallbackFolder();
        var baseName = hasDocument ? defaultBaseName(app.activeDocument) : "Illustrator_Export";

        return "{" +
            '"hasDocument":' + (hasDocument ? "true" : "false") + "," +
            '"folder":' + quoteJson(folder.fsName) + "," +
            '"baseName":' + quoteJson(baseName) +
            "}";
    }

    function selectFolder(currentPath) {
        var currentFolder = currentPath ? new Folder(currentPath) : fallbackFolder();
        var selected = Folder.selectDialog("Choose export folder", currentFolder);
        return selected ? selected.fsName : "";
    }

    function makeDialog(doc) {
        var defaults = defaultSettingsForDocument(doc);
        var dialog = new Window("dialog", APP_NAME);
        dialog.orientation = "column";
        dialog.alignChildren = "fill";
        dialog.margins = 16;

        var title = dialog.add("statictext", undefined, "Export active Illustrator document");
        title.graphics.font = ScriptUI.newFont(title.graphics.font.name, "BOLD", 14);

        var folderGroup = dialog.add("group");
        folderGroup.orientation = "row";
        folderGroup.alignChildren = ["fill", "center"];
        folderGroup.add("statictext", undefined, "Folder:");
        var folderInput = folderGroup.add("edittext", undefined, defaults.folder.fsName);
        folderInput.characters = 38;
        var browseButton = folderGroup.add("button", undefined, "Browse");

        var nameGroup = dialog.add("group");
        nameGroup.orientation = "row";
        nameGroup.alignChildren = ["fill", "center"];
        nameGroup.add("statictext", undefined, "Base name:");
        var nameInput = nameGroup.add("edittext", undefined, defaults.baseName);
        nameInput.characters = 42;

        var formatPanel = dialog.add("panel", undefined, "Export formats");
        formatPanel.orientation = "row";
        formatPanel.alignChildren = "left";
        formatPanel.margins = 12;
        var aiCheck = formatPanel.add("checkbox", undefined, "AI");
        aiCheck.value = true;
        var pdfCheck = formatPanel.add("checkbox", undefined, "PDF");
        pdfCheck.value = true;
        var pngCheck = formatPanel.add("checkbox", undefined, "PNG");
        pngCheck.value = true;

        var sharedPanel = dialog.add("panel", undefined, "Shared");
        sharedPanel.orientation = "column";
        sharedPanel.alignChildren = "left";
        sharedPanel.margins = 12;
        var overwriteCheck = sharedPanel.add("checkbox", undefined, "Overwrite existing files");
        overwriteCheck.value = false;

        var aiPanel = dialog.add("panel", undefined, "AI Settings");
        aiPanel.orientation = "column";
        aiPanel.alignChildren = "left";
        aiPanel.margins = 12;
        var aiPdfCompatibleCheck = aiPanel.add("checkbox", undefined, "PDF compatible");
        aiPdfCompatibleCheck.value = true;
        var aiCompressedCheck = aiPanel.add("checkbox", undefined, "Compress file");
        aiCompressedCheck.value = true;
        var aiIccCheck = aiPanel.add("checkbox", undefined, "Embed ICC profile");
        aiIccCheck.value = true;

        var pdfPanel = dialog.add("panel", undefined, "PDF Settings");
        pdfPanel.orientation = "column";
        pdfPanel.alignChildren = "left";
        pdfPanel.margins = 12;
        var pdfEditabilityCheck = pdfPanel.add("checkbox", undefined, "Preserve editability");
        pdfEditabilityCheck.value = true;
        var pdfThumbnailsCheck = pdfPanel.add("checkbox", undefined, "Generate thumbnails");
        pdfThumbnailsCheck.value = true;
        var pdfViewAfterCheck = pdfPanel.add("checkbox", undefined, "View after saving");
        pdfViewAfterCheck.value = false;

        var pngPanel = dialog.add("panel", undefined, "PNG Settings");
        pngPanel.orientation = "column";
        pngPanel.alignChildren = "left";
        pngPanel.margins = 12;
        var pngTransparencyCheck = pngPanel.add("checkbox", undefined, "Transparent background");
        pngTransparencyCheck.value = true;
        var pngArtboardCheck = pngPanel.add("checkbox", undefined, "Clip to active artboard");
        pngArtboardCheck.value = true;
        var pngAntiAliasingCheck = pngPanel.add("checkbox", undefined, "Anti-aliasing");
        pngAntiAliasingCheck.value = true;

        var scaleGroup = pngPanel.add("group");
        scaleGroup.orientation = "row";
        scaleGroup.add("statictext", undefined, "Scale:");
        var scaleInput = scaleGroup.add("edittext", undefined, "100");
        scaleInput.characters = 6;
        scaleGroup.add("statictext", undefined, "%");

        var buttonGroup = dialog.add("group");
        buttonGroup.alignment = "right";
        var cancelButton = buttonGroup.add("button", undefined, "Cancel", { name: "cancel" });
        var exportButton = buttonGroup.add("button", undefined, "Export", { name: "ok" });

        browseButton.onClick = function () {
            var selected = Folder.selectDialog("Choose export folder", new Folder(folderInput.text));
            if (selected) {
                folderInput.text = selected.fsName;
            }
        };

        exportButton.onClick = function () {
            var folder = new Folder(folderInput.text);
            if (!folder.exists) {
                alert("Folder does not exist:\n" + folder.fsName);
                return;
            }

            if (!trim(nameInput.text).length) {
                alert("Please enter a base file name.");
                return;
            }

            if (!aiCheck.value && !pdfCheck.value && !pngCheck.value) {
                alert("Select at least one export format.");
                return;
            }

            dialog.close(1);
        };

        cancelButton.onClick = function () {
            dialog.close(0);
        };

        if (dialog.show() !== 1) {
            return null;
        }

        return {
            folder: new Folder(folderInput.text),
            baseName: nameInput.text,
            overwrite: overwriteCheck.value,
            formats: {
                ai: aiCheck.value,
                pdf: pdfCheck.value,
                png: pngCheck.value
            },
            ai: {
                pdfCompatible: aiPdfCompatibleCheck.value,
                compressed: aiCompressedCheck.value,
                embedICCProfile: aiIccCheck.value
            },
            pdf: {
                preserveEditability: pdfEditabilityCheck.value,
                generateThumbnails: pdfThumbnailsCheck.value,
                viewAfterSaving: pdfViewAfterCheck.value
            },
            png: {
                scale: parseScale(scaleInput.text),
                transparency: pngTransparencyCheck.value,
                artBoardClipping: pngArtboardCheck.value,
                antiAliasing: pngAntiAliasingCheck.value
            }
        };
    }

    function runWithSettings(rawSettings) {
        try {
            if (app.documents.length === 0) {
                throw new Error("No Illustrator document is open.");
            }

            var settings = normalizeSettings(rawSettings, app.activeDocument);
            exportAll(settings);
            return "Export complete: " + exportedLabels(settings);
        } catch (error) {
            return "Error: " + error.message;
        }
    }

    function run() {
        try {
            if (app.documents.length === 0) {
                alert("Open an Illustrator document before exporting.");
                return "No document";
            }

            var settings = makeDialog(app.activeDocument);
            if (!settings) {
                return "Canceled";
            }

            var files = exportAll(settings);
            alert(
                "Export complete:\n\n" +
                exportedPaths(files, settings)
            );
            return "Export complete: " + exportedLabels(settings);
        } catch (error) {
            alert(APP_NAME + " failed:\n" + error.message);
            return "Error: " + error.message;
        }
    }

    $.global.AIOExporter = {
        run: run,
        runWithSettings: runWithSettings,
        exportAll: exportAll,
        getDefaultsJson: getDefaultsJson,
        selectFolder: selectFolder
    };

    $.global.TripleFormatExporter = $.global.AIOExporter;

    if (!$.global.AIO_EXPORTER_NO_AUTORUN && !$.global.TRIPLE_FORMAT_EXPORTER_NO_AUTORUN) {
        run();
    }
})();
