#target illustrator

/*
  AIO Exporter for Adobe Illustrator
  Exports the active document to selected AI, PDF, and PNG outputs.
*/
(function () {
    var APP_NAME = "AIO Exporter";
    var APP_VERSION = "1.5.0";
    var DEFAULT_BASE_NAME = "AIO_Exporter";

    function trim(value) {
        return String(value).replace(/^\s+|\s+$/g, "");
    }

    function stripExtension(name) {
        return String(name).replace(/\.[^\.]+$/, "");
    }

    function sanitizeFileName(name) {
        var cleaned = trim(name).replace(/[\\\/:\*\?"<>\|]/g, "_");
        cleaned = cleaned.replace(/\s+/g, " ");
        return cleaned.length ? cleaned : DEFAULT_BASE_NAME;
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
        return sanitizeFileName(stripExtension(decodeName(doc.name || DEFAULT_BASE_NAME)));
    }

    function documentSignature(doc) {
        var path = "";

        try {
            if (doc.fullName) {
                path = doc.fullName.fsName;
            }
        } catch (ignoredFullName) {}

        if (!path) {
            try {
                path = doc.name || "";
            } catch (ignoredName) {}
        }

        return decodeName(path) + "|" + artboardCount(doc);
    }

    function padNumber(value) {
        return value < 10 ? "0" + value : String(value);
    }

    function bool(value, fallback) {
        return typeof value === "boolean" ? value : fallback;
    }

    function numberInRange(value, fallback, min, max) {
        var number = Number(value);

        if (isNaN(number)) {
            return fallback;
        }
        if (number < min) {
            return min;
        }
        if (number > max) {
            return max;
        }
        return Math.round(number);
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

    function artboardCount(doc) {
        try {
            return Math.max(1, doc.artboards.length);
        } catch (ignored) {}

        return 1;
    }

    function artboardNames(doc) {
        var count = artboardCount(doc);
        var names = [];
        var i;
        var name;

        for (i = 0; i < count; i += 1) {
            try {
                name = trim(doc.artboards[i].name || "");
            } catch (ignored) {
                name = "";
            }
            names.push(name || ("Artboard " + (i + 1)));
        }

        return names;
    }

    function artboardName(doc, artboardNumber) {
        var name = "";

        try {
            name = trim(doc.artboards[artboardNumber - 1].name || "");
        } catch (ignored) {}

        return name || ("Artboard " + artboardNumber);
    }

    function pngFileBaseNamesFromArtboards(doc, artboards) {
        var names = [];
        var i;

        for (i = 0; i < artboards.length; i += 1) {
            names.push(sanitizeFileName(artboardName(doc, artboards[i])));
        }

        return names;
    }

    function activeArtboardNumber(doc) {
        try {
            return doc.artboards.getActiveArtboardIndex() + 1;
        } catch (ignored) {}

        return 1;
    }

    function activeArtboardIndex(doc) {
        try {
            return doc.artboards.getActiveArtboardIndex();
        } catch (ignored) {}

        return -1;
    }

    function setActiveArtboardNumber(doc, number) {
        doc.artboards.setActiveArtboardIndex(number - 1);
    }

    function restoreActiveArtboardIndex(doc, index) {
        if (index < 0) {
            return;
        }

        try {
            doc.artboards.setActiveArtboardIndex(index);
        } catch (ignored) {}
    }

    function normalizeArtboardMode(value) {
        return value === "active" || value === "range" ? value : "all";
    }

    function normalizePdfOutputMode(value) {
        return value === "multiple" ? "multiple" : "single";
    }

    function parseArtboardRange(value, count) {
        var compact = trim(value).replace(/\s+/g, "");
        var parts;
        var normalized = [];
        var i;
        var part;
        var match;
        var start;
        var end;

        count = Math.max(1, count || 1);

        if (!compact) {
            throw new Error("Enter an artboard range.");
        }

        parts = compact.split(",");
        for (i = 0; i < parts.length; i += 1) {
            part = parts[i];
            match = part.match(/^(\d+)(?:-(\d+))?$/);
            if (!part || !match) {
                throw new Error("Use artboard ranges like 1,3-5.");
            }

            start = parseInt(match[1], 10);
            end = match[2] ? parseInt(match[2], 10) : start;

            if (start < 1 || end < 1 || start > count || end > count || start > end) {
                throw new Error("Artboard range must be within 1-" + count + ".");
            }

            normalized.push(start === end ? String(start) : start + "-" + end);
        }

        return normalized.join(",");
    }

    function artboardNumbersFromRange(value, count) {
        var normalized = parseArtboardRange(value, count);
        var parts = normalized.split(",");
        var numbers = [];
        var i;
        var match;
        var start;
        var end;
        var number;

        for (i = 0; i < parts.length; i += 1) {
            match = parts[i].match(/^(\d+)(?:-(\d+))?$/);
            if (match) {
                start = parseInt(match[1], 10);
                end = match[2] ? parseInt(match[2], 10) : start;
                for (number = start; number <= end; number += 1) {
                    numbers.push(number);
                }
            }
        }

        return numbers;
    }

    function selectedArtboardNumbers(settings, doc) {
        var count = artboardCount(doc);
        var numbers = [];
        var i;

        if (settings.artboards && settings.artboards.mode === "range") {
            return artboardNumbersFromRange(settings.artboards.range, count);
        }

        if (settings.artboards && settings.artboards.mode === "active") {
            numbers.push(activeArtboardNumber(doc));
            return numbers;
        }

        for (i = 1; i <= count; i += 1) {
            numbers.push(i);
        }

        return numbers;
    }

    function resolveArtboards(rawArtboards, doc) {
        var artboards = rawArtboards || {};
        var mode = normalizeArtboardMode(artboards.mode);
        var range = trim(artboards.range || "");

        if (mode === "active") {
            range = String(activeArtboardNumber(doc));
        } else if (mode === "range") {
            range = parseArtboardRange(range, artboardCount(doc));
        } else {
            range = "";
        }

        return {
            mode: mode,
            range: range
        };
    }

    function applyArtboardRange(options, settings, saveMultipleArtboards) {
        if (!settings.artboards || !settings.artboards.range) {
            return;
        }

        if (saveMultipleArtboards) {
            try {
                options.saveMultipleArtboards = true;
            } catch (ignored) {}
        }

        try {
            options.artboardRange = settings.artboards.range;
        } catch (ignoredRange) {}
    }

    function documentBleedOffsetRect(doc) {
        var rect;

        try {
            rect = doc.documentPreferences.documentBleedOffsetRect;
            if (rect && rect.length === 4) {
                return rect;
            }
        } catch (ignored) {}

        return null;
    }

    function expandRectWithBleed(rect, bleed) {
        if (!rect || !bleed || bleed.length !== 4) {
            return rect;
        }

        return [
            rect[0] - Number(bleed[1] || 0),
            rect[1] + Number(bleed[0] || 0),
            rect[2] + Number(bleed[3] || 0),
            rect[3] - Number(bleed[2] || 0)
        ];
    }

    function pngTempFile(file) {
        var folderPath = file.parent ? file.parent.fsName : file.path;
        var stamp = (new Date()).getTime();
        var i;
        var tempFile;

        for (i = 0; i < 1000; i += 1) {
            tempFile = new File(folderPath + "/__aio_png_export_" + stamp + "_" + i + ".png");
            if (!tempFile.exists) {
                return tempFile;
            }
        }

        throw new Error("Could not create a temporary PNG file name.");
    }

    function renamePngTempFile(tempFile, file) {
        var targetName = decodeName(file.name || "");

        if (!targetName) {
            throw new Error("PNG output file name is empty.");
        }

        if (!tempFile.exists) {
            throw new Error("PNG export did not create a temporary file.");
        }

        if (file.exists && !file.remove()) {
            throw new Error("Could not replace existing PNG file:\n" + file.fsName);
        }

        if (!tempFile.rename(targetName)) {
            throw new Error("Could not rename PNG export to:\n" + file.fsName);
        }
    }

    function exportPngFile(doc, file, options) {
        var tempFile = pngTempFile(file);

        try {
            doc.exportFile(tempFile, ExportType.PNG24, options);
            renamePngTempFile(tempFile, file);
        } catch (error) {
            try {
                if (tempFile && tempFile.exists) {
                    tempFile.remove();
                }
            } catch (ignoredCleanup) {}
            throw error;
        }
    }

    function exportPngWithOptionalBleed(doc, file, options, settings) {
        var artboard;
        var originalRect;
        var bleed;

        if (settings.png.fullDocument || !settings.png.artBoardClipping || !settings.png.includeBleed) {
            exportPngFile(doc, file, options);
            return;
        }

        bleed = documentBleedOffsetRect(doc);
        if (!bleed) {
            exportPngFile(doc, file, options);
            return;
        }

        try {
            artboard = doc.artboards[doc.artboards.getActiveArtboardIndex()];
            originalRect = artboard.artboardRect.slice(0);
            artboard.artboardRect = expandRectWithBleed(originalRect, bleed);
            exportPngFile(doc, file, options);
        } finally {
            if (artboard && originalRect) {
                artboard.artboardRect = originalRect;
            }
        }
    }

    function normalizeAiCompatibility(value) {
        var key = String(value || "ILLUSTRATOR19");
        var allowed = {
            JAPANESEVERSION3: true,
            ILLUSTRATOR8: true,
            ILLUSTRATOR9: true,
            ILLUSTRATOR10: true,
            ILLUSTRATOR11: true,
            ILLUSTRATOR12: true,
            ILLUSTRATOR13: true,
            ILLUSTRATOR14: true,
            ILLUSTRATOR15: true,
            ILLUSTRATOR16: true,
            ILLUSTRATOR17: true,
            ILLUSTRATOR19: true
        };

        return allowed[key] ? key : "ILLUSTRATOR19";
    }

    function aiCompatibilityRank(value) {
        var key = String(value || "");

        if (key === "JAPANESEVERSION3") {
            return 3;
        }

        if (key.indexOf("ILLUSTRATOR") === 0) {
            return parseInt(key.replace("ILLUSTRATOR", ""), 10) || 0;
        }

        return 0;
    }

    function supportsEmbedPermittedFonts(value) {
        return aiCompatibilityRank(value) >= 9;
    }

    function supportsLegacyTransparency(value) {
        var rank = aiCompatibilityRank(value);
        return rank > 0 && rank <= 8;
    }

    function normalizeFlattenOutput(value) {
        return value === "PRESERVEPATHS" ? "PRESERVEPATHS" : "PRESERVEAPPEARANCE";
    }

    function errorMessage(error) {
        if (error && error.message) {
            return error.message;
        }

        return String(error);
    }

    function isInvalidEnumerationError(error) {
        return /invalid enumeration value/i.test(errorMessage(error));
    }

    function compatibilityValue(key) {
        if (key === "JAPANESEVERSION3") {
            return Compatibility.JAPANESEVERSION3;
        }
        if (key === "ILLUSTRATOR8") {
            return Compatibility.ILLUSTRATOR8;
        }
        if (key === "ILLUSTRATOR9") {
            return Compatibility.ILLUSTRATOR9;
        }
        if (key === "ILLUSTRATOR10") {
            return Compatibility.ILLUSTRATOR10;
        }
        if (key === "ILLUSTRATOR11") {
            return Compatibility.ILLUSTRATOR11;
        }
        if (key === "ILLUSTRATOR12") {
            return Compatibility.ILLUSTRATOR12;
        }
        if (key === "ILLUSTRATOR13") {
            return Compatibility.ILLUSTRATOR13;
        }
        if (key === "ILLUSTRATOR14") {
            return Compatibility.ILLUSTRATOR14;
        }
        if (key === "ILLUSTRATOR15") {
            return Compatibility.ILLUSTRATOR15;
        }
        if (key === "ILLUSTRATOR16") {
            return Compatibility.ILLUSTRATOR16;
        }
        if (key === "ILLUSTRATOR17") {
            return Compatibility.ILLUSTRATOR17;
        }

        return Compatibility.ILLUSTRATOR19;
    }

    function assignCompatibility(options, key) {
        var selectedValue;
        var fallbacks = [
            "ILLUSTRATOR19",
            "ILLUSTRATOR17",
            "ILLUSTRATOR16",
            "ILLUSTRATOR15",
            "ILLUSTRATOR14",
            "ILLUSTRATOR13",
            "ILLUSTRATOR12",
            "ILLUSTRATOR11",
            "ILLUSTRATOR10",
            "ILLUSTRATOR9",
            "ILLUSTRATOR8",
            "JAPANESEVERSION3"
        ];
        var i;
        var fallbackValue;

        try {
            selectedValue = compatibilityValue(key);
        } catch (selectedValueError) {
            selectedValue = undefined;
        }

        try {
            if (typeof selectedValue !== "undefined") {
                options.compatibility = selectedValue;
            }
            return;
        } catch (selectedError) {}

        for (i = 0; i < fallbacks.length; i += 1) {
            if (fallbacks[i] === key) {
                continue;
            }

            try {
                fallbackValue = compatibilityValue(fallbacks[i]);
                if (typeof fallbackValue !== "undefined") {
                    options.compatibility = fallbackValue;
                }
                return;
            } catch (fallbackError) {}
        }
    }

    function flattenOutputValue(key) {
        if (key === "PRESERVEPATHS") {
            return OutputFlattening.PRESERVEPATHS;
        }

        return OutputFlattening.PRESERVEAPPEARANCE;
    }

    function assignFlattenOutput(options, key) {
        var value;

        try {
            value = flattenOutputValue(key);
            if (typeof value !== "undefined") {
                options.flattenOutput = value;
            }
        } catch (ignored) {}
    }

    function listToArray(value) {
        var result = [];
        var i;

        try {
            for (i = 0; i < value.length; i += 1) {
                result.push(String(value[i]));
            }
        } catch (ignored) {}

        return result;
    }

    function pdfPresetNames() {
        try {
            return listToArray(app.PDFPresetsList);
        } catch (ignored) {}

        return [];
    }

    function validPdfPresetName(name) {
        var presets;
        var i;

        name = trim(name || "");
        if (!name) {
            return "";
        }

        presets = pdfPresetNames();
        for (i = 0; i < presets.length; i += 1) {
            if (presets[i] === name) {
                return name;
            }
        }

        return "";
    }

    function quoteJson(value) {
        return '"' + String(value)
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n")
            .replace(/\t/g, "\\t") + '"';
    }

    function quoteJsonArray(values) {
        var quoted = [];
        var i;

        for (i = 0; i < values.length; i += 1) {
            quoted.push(quoteJson(values[i]));
        }

        return "[" + quoted.join(",") + "]";
    }

    function hasAnyExisting(files) {
        return !!firstExistingFile(files);
    }

    function firstExistingFile(files) {
        for (var i = 0; i < files.length; i += 1) {
            if (files[i].exists) {
                return files[i];
            }
        }
        return null;
    }

    function outputFileKey(file) {
        var path = "";

        try {
            path = file.fsName;
        } catch (ignored) {
            path = String(file);
        }

        return "|" + String(path).toLowerCase();
    }

    function assertNoDuplicateFiles(files) {
        var seen = {};
        var key;
        var i;

        for (i = 0; i < files.length; i += 1) {
            key = outputFileKey(files[i]);
            if (seen[key]) {
                throw new Error("Duplicate output file name: " + files[i].fsName);
            }
            seen[key] = true;
        }
    }

    function hasSelectedFormat(formats) {
        return !!(formats && (formats.ai || formats.pdf || formats.png));
    }

    function buildFiles(folder, baseName, overwrite, formats, pdfArtboards, pngArtboards, pngFileBaseNames) {
        var safeBase = sanitizeFileName(baseName);
        var candidate = safeBase;
        var index = 1;
        var files;
        var result;
        var i;
        var pdfFile;
        var pngFile;
        var namedPngFiles;
        var existingPngFile;
        var usePngArtboardNames = pngFileBaseNames && pngFileBaseNames.length;

        do {
            files = [];
            namedPngFiles = [];
            result = {
                baseName: candidate
            };

            if (formats.ai) {
                result.ai = new File(folder.fsName + "/" + candidate + ".ai");
                files.push(result.ai);
            }
            if (formats.pdf) {
                if (pdfArtboards && pdfArtboards.length) {
                    result.pdfList = [];
                    for (i = 0; i < pdfArtboards.length; i += 1) {
                        pdfFile = {
                            artboard: pdfArtboards[i],
                            file: new File(folder.fsName + "/" + candidate + "_" + padNumber(pdfArtboards[i]) + ".pdf")
                        };
                        result.pdfList.push(pdfFile);
                        files.push(pdfFile.file);
                    }
                } else {
                    result.pdf = new File(folder.fsName + "/" + candidate + ".pdf");
                    files.push(result.pdf);
                }
            }
            if (formats.png) {
                if (usePngArtboardNames && pngArtboards && pngArtboards.length) {
                    result.pngList = [];
                    for (i = 0; i < pngArtboards.length; i += 1) {
                        pngFile = {
                            artboard: pngArtboards[i],
                            file: new File(folder.fsName + "/" + pngFileBaseNames[i] + ".png")
                        };
                        result.pngList.push(pngFile);
                        files.push(pngFile.file);
                        namedPngFiles.push(pngFile.file);
                    }
                } else if (pngArtboards && pngArtboards.length > 1) {
                    result.pngList = [];
                    for (i = 0; i < pngArtboards.length; i += 1) {
                        pngFile = {
                            artboard: pngArtboards[i],
                            file: new File(folder.fsName + "/" + candidate + "_" + padNumber(pngArtboards[i]) + ".png")
                        };
                        result.pngList.push(pngFile);
                        files.push(pngFile.file);
                    }
                } else {
                    result.png = new File(folder.fsName + "/" + candidate + ".png");
                    result.pngArtboard = pngArtboards && pngArtboards.length === 1 ? pngArtboards[0] : null;
                    files.push(result.png);
                }
            }

            assertNoDuplicateFiles(files);
            if (usePngArtboardNames && !overwrite) {
                existingPngFile = firstExistingFile(namedPngFiles);
                if (existingPngFile) {
                    throw new Error("PNG file already exists. Enable overwrite or rename the artboard:\n" + existingPngFile.fsName);
                }
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
                compatibility: "ILLUSTRATOR19",
                pdfCompatible: true,
                embedLinkedFiles: false,
                compressed: true,
                embedICCProfile: true,
                embedPermittedFonts: true,
                fontSubsetThreshold: 100,
                flattenOutput: "PRESERVEAPPEARANCE"
            },
            pdf: {
                preset: "",
                outputMode: "single",
                preserveEditability: true,
                generateThumbnails: true,
                viewAfterSaving: false
            },
            png: {
                scale: 100,
                transparency: true,
                artBoardClipping: true,
                antiAliasing: true,
                includeBleed: true,
                fullDocument: false,
                useArtboardNames: false
            },
            artboards: {
                mode: "all",
                range: ""
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
        var rawArtboards = raw.artboards || {};
        var rawPngFullDocument = bool(rawPng.fullDocument, defaults.png.fullDocument);
        var folder = raw.folder && raw.folder.fsName ? raw.folder : (raw.folder ? new Folder(raw.folder) : defaults.folder);
        var aiCompatibility = normalizeAiCompatibility(rawAi.compatibility);
        var aiPdfCompatible = bool(rawAi.pdfCompatible, defaults.ai.pdfCompatible);
        var aiEmbedPermittedFonts = bool(rawAi.embedPermittedFonts, numberInRange(rawAi.fontSubsetThreshold, defaults.ai.fontSubsetThreshold, 0, 100) > 0);
        var aiFlattenOutput = supportsLegacyTransparency(aiCompatibility) ? normalizeFlattenOutput(rawAi.flattenOutput) : defaults.ai.flattenOutput;

        if (!supportsEmbedPermittedFonts(aiCompatibility)) {
            aiEmbedPermittedFonts = false;
        }

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
                compatibility: aiCompatibility,
                pdfCompatible: aiPdfCompatible,
                embedLinkedFiles: bool(rawAi.embedLinkedFiles, defaults.ai.embedLinkedFiles),
                compressed: bool(rawAi.compressed, defaults.ai.compressed),
                embedICCProfile: bool(rawAi.embedICCProfile, defaults.ai.embedICCProfile),
                embedPermittedFonts: aiEmbedPermittedFonts,
                fontSubsetThreshold: aiEmbedPermittedFonts ? 100 : 0,
                flattenOutput: aiFlattenOutput
            },
            pdf: {
                preset: trim(rawPdf.preset || ""),
                outputMode: normalizePdfOutputMode(rawPdf.outputMode),
                preserveEditability: bool(rawPdf.preserveEditability, defaults.pdf.preserveEditability),
                generateThumbnails: bool(rawPdf.generateThumbnails, defaults.pdf.generateThumbnails),
                viewAfterSaving: bool(rawPdf.viewAfterSaving, defaults.pdf.viewAfterSaving)
            },
            png: {
                scale: parseScale(rawPng.scale),
                transparency: bool(rawPng.transparency, defaults.png.transparency),
                artBoardClipping: rawPngFullDocument ? false : bool(rawPng.artBoardClipping, defaults.png.artBoardClipping),
                antiAliasing: bool(rawPng.antiAliasing, defaults.png.antiAliasing),
                includeBleed: bool(rawPng.includeBleed, defaults.png.includeBleed),
                fullDocument: rawPngFullDocument,
                useArtboardNames: !rawPngFullDocument && bool(rawPng.useArtboardNames, defaults.png.useArtboardNames)
            },
            artboards: {
                mode: normalizeArtboardMode(rawArtboards.mode),
                range: trim(rawArtboards.range || "")
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

    function applyAiOptions(options, settings, includeEnumOptions) {
        if (includeEnumOptions) {
            assignCompatibility(options, settings.ai.compatibility);
        }

        options.pdfCompatible = settings.ai.pdfCompatible;
        options.embedLinkedFiles = settings.ai.embedLinkedFiles;
        options.compressed = settings.ai.compressed;
        options.embedICCProfile = settings.ai.embedICCProfile;

        if (supportsEmbedPermittedFonts(settings.ai.compatibility)) {
            // New property for v29.3+ (Best guess based on naming convention)
            try {
                options.embedPermittedFontsForFilePreview = settings.ai.embedPermittedFonts;
            } catch (e) {}
            try {
                options.embedPermittedFonts = settings.ai.embedPermittedFonts;
            } catch (e) {}

            // Fallback: Legacy font subsetting for older versions
            try {
                options.fontSubsetThreshold = settings.ai.embedPermittedFonts ? 100 : 0;
            } catch (ignoredFontPreview) {}
        }

        if (includeEnumOptions && supportsLegacyTransparency(settings.ai.compatibility)) {
            assignFlattenOutput(options, settings.ai.flattenOutput);
        }
    }

    function saveAiWithOptions(doc, file, settings, includeEnumOptions) {
        var options = new IllustratorSaveOptions();
        applyAiOptions(options, settings, includeEnumOptions);
        doc.saveAs(file, options);
    }

    function saveAi(doc, file, settings) {
        try {
            saveAiWithOptions(doc, file, settings, true);
        } catch (error) {
            if (!isInvalidEnumerationError(error)) {
                throw error;
            }

            try {
                saveAiWithOptions(doc, file, settings, false);
            } catch (fallbackError) {
                if (!isInvalidEnumerationError(fallbackError)) {
                    throw fallbackError;
                }

                doc.saveAs(file);
            }
        }
    }

    function savePdf(doc, file, settings, artboardRangeOverride) {
        var options = new PDFSaveOptions();
        var preset = validPdfPresetName(settings.pdf.preset);

        if (preset) {
            try {
                options.pDFPreset = preset;
            } catch (presetError) {
                preset = "";
            }
        }

        if (!preset) {
            options.preserveEditability = settings.pdf.preserveEditability;
            options.generateThumbnails = settings.pdf.generateThumbnails;
            options.viewAfterSaving = settings.pdf.viewAfterSaving;
        }
        if (artboardRangeOverride) {
            try {
                options.artboardRange = String(artboardRangeOverride);
            } catch (ignoredOverride) {}
        } else {
            applyArtboardRange(options, settings, false);
        }
        doc.saveAs(file, options);
    }

    function exportPng(doc, file, settings) {
        var options = new ExportOptionsPNG24();
        options.antiAliasing = settings.png.antiAliasing;
        options.transparency = settings.png.transparency;
        options.artBoardClipping = !settings.png.fullDocument && settings.png.artBoardClipping;
        options.horizontalScale = settings.png.scale;
        options.verticalScale = settings.png.scale;
        exportPngWithOptionalBleed(doc, file, options, settings);
    }

    function exportPngArtboard(doc, file, settings, artboardNumber) {
        var originalArtboardIndex = activeArtboardIndex(doc);

        try {
            if (artboardNumber && !settings.png.fullDocument) {
                setActiveArtboardNumber(doc, artboardNumber);
            }

            exportPng(doc, file, settings);
        } finally {
            restoreActiveArtboardIndex(doc, originalArtboardIndex);
        }
    }

    function runExportStep(label, action) {
        try {
            action();
        } catch (error) {
            throw new Error(label + " failed: " + errorMessage(error));
        }
    }

    function currentUserInteractionLevel() {
        try {
            return app.userInteractionLevel;
        } catch (ignored) {}

        return null;
    }

    function setUserInteractionLevel(level) {
        try {
            app.userInteractionLevel = level;
        } catch (ignored) {}
    }

    function exportAll(settings) {
        if (app.documents.length === 0) {
            throw new Error("No Illustrator document is open.");
        }

        var doc = app.activeDocument;
        settings.artboards = resolveArtboards(settings.artboards, doc);
        validateSettings(settings);

        var pdfArtboards = settings.formats.pdf && settings.pdf.outputMode === "multiple" ? selectedArtboardNumbers(settings, doc) : null;
        var pngArtboards = settings.formats.png && !settings.png.fullDocument && settings.png.artBoardClipping ? selectedArtboardNumbers(settings, doc) : null;
        var pngFileBaseNames = settings.formats.png && settings.png.useArtboardNames && pngArtboards ? pngFileBaseNamesFromArtboards(doc, pngArtboards) : null;
        var files = buildFiles(settings.folder, settings.baseName, settings.overwrite, settings.formats, pdfArtboards, pngArtboards, pngFileBaseNames);
        var originalInteraction = currentUserInteractionLevel();
        var i;

        try {
            setUserInteractionLevel(UserInteractionLevel.DONTDISPLAYALERTS);

            if (settings.formats.pdf) {
                if (files.pdfList) {
                    for (i = 0; i < files.pdfList.length; i += 1) {
                        (function (pdfFile) {
                            runExportStep("PDF artboard " + pdfFile.artboard, function () {
                                savePdf(doc, pdfFile.file, settings, pdfFile.artboard);
                            });
                        })(files.pdfList[i]);
                    }
                } else {
                    runExportStep("PDF export", function () {
                        savePdf(doc, files.pdf, settings);
                    });
                }
            }
            if (settings.formats.png) {
                if (files.pngList) {
                    for (i = 0; i < files.pngList.length; i += 1) {
                        (function (pngFile) {
                            runExportStep("PNG artboard " + pngFile.artboard, function () {
                                exportPngArtboard(doc, pngFile.file, settings, pngFile.artboard);
                            });
                        })(files.pngList[i]);
                    }
                } else {
                    runExportStep(files.pngArtboard ? "PNG artboard " + files.pngArtboard : "PNG export", function () {
                        exportPngArtboard(doc, files.png, settings, files.pngArtboard);
                    });
                }
            }
            if (settings.formats.ai) {
                runExportStep("AI save", function () {
                    saveAi(doc, files.ai, settings);
                });
            }
        } finally {
            if (originalInteraction !== null) {
                setUserInteractionLevel(originalInteraction);
            }
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
        var i;

        if (settings.formats.ai && files.ai) {
            paths.push(files.ai.fsName);
        }
        if (settings.formats.pdf && files.pdfList) {
            for (i = 0; i < files.pdfList.length; i += 1) {
                paths.push(files.pdfList[i].file.fsName);
            }
        }
        if (settings.formats.pdf && files.pdf) {
            paths.push(files.pdf.fsName);
        }
        if (settings.formats.png && files.pngList) {
            for (i = 0; i < files.pngList.length; i += 1) {
                paths.push(files.pngList[i].file.fsName);
            }
        }
        if (settings.formats.png && files.png) {
            paths.push(files.png.fsName);
        }

        return paths.join("\n");
    }

    function getDefaultsJson() {
        var hasDocument = app.documents.length > 0;
        var folder = hasDocument ? folderFromDocument(app.activeDocument) : fallbackFolder();
        var baseName = hasDocument ? defaultBaseName(app.activeDocument) : DEFAULT_BASE_NAME;
        var totalArtboards = hasDocument ? artboardCount(app.activeDocument) : 1;
        var activeArtboard = hasDocument ? activeArtboardNumber(app.activeDocument) : 1;
        var names = hasDocument ? artboardNames(app.activeDocument) : ["Artboard 1"];
        var pdfPresets = pdfPresetNames();

        return "{" +
            '"hasDocument":' + (hasDocument ? "true" : "false") + "," +
            '"documentId":' + quoteJson(hasDocument ? documentSignature(app.activeDocument) : "") + "," +
            '"artboardCount":' + totalArtboards + "," +
            '"activeArtboard":' + activeArtboard + "," +
            '"artboardNames":' + quoteJsonArray(names) + "," +
            '"version":' + quoteJson(APP_VERSION) + "," +
            '"pdfPresets":' + quoteJsonArray(pdfPresets) + "," +
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
        var aiCompatibilityValues = [
            "ILLUSTRATOR19",
            "ILLUSTRATOR17",
            "ILLUSTRATOR16",
            "ILLUSTRATOR15",
            "ILLUSTRATOR14",
            "ILLUSTRATOR13",
            "ILLUSTRATOR12",
            "ILLUSTRATOR11",
            "ILLUSTRATOR10",
            "ILLUSTRATOR9",
            "ILLUSTRATOR8",
            "JAPANESEVERSION3"
        ];
        var aiCompatibilityLabels = [
            "Illustrator 2020",
            "Illustrator CC (Legacy)",
            "Illustrator CS6",
            "Illustrator CS5",
            "Illustrator CS4",
            "Illustrator CS3",
            "Illustrator CS2",
            "Illustrator CS",
            "Illustrator 10",
            "Illustrator 9",
            "Illustrator 8",
            "Japanese Illustrator 3"
        ];
        var flattenValues = ["PRESERVEAPPEARANCE", "PRESERVEPATHS"];
        var flattenLabels = ["Preserve Appearance", "Preserve Paths"];
        var availablePdfPresets = pdfPresetNames();
        var pdfPresetValues = availablePdfPresets.length ? availablePdfPresets : [""];
        var pdfPresetLabels = availablePdfPresets.length ? availablePdfPresets : ["Custom settings"];
        var dialog = new Window("dialog", APP_NAME);
        dialog.orientation = "column";
        dialog.alignChildren = "fill";
        dialog.margins = 16;

        function selectedDropdownValue(dropdown, values, fallback) {
            if (!dropdown.selection) {
                return fallback;
            }

            return values[dropdown.selection.index] || fallback;
        }

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

        var artboardAllRadio = sharedPanel.add("radiobutton", undefined, "All artboards");
        artboardAllRadio.value = true;
        var artboardRangeRadio = sharedPanel.add("radiobutton", undefined, "Range");

        var artboardRangeGroup = sharedPanel.add("group");
        artboardRangeGroup.orientation = "row";
        artboardRangeGroup.add("statictext", undefined, "Range:");
        var artboardRangeInput = artboardRangeGroup.add("edittext", undefined, "");
        artboardRangeInput.characters = 12;
        artboardRangeGroup.add("statictext", undefined, "1-" + artboardCount(doc));

        var settingsTabs = dialog.add("tabbedpanel");
        settingsTabs.alignChildren = "fill";
        settingsTabs.preferredSize = [430, 230];

        var aiPanel = settingsTabs.add("tab", undefined, "AI");
        aiPanel.orientation = "column";
        aiPanel.alignChildren = "left";
        aiPanel.margins = 12;
        var aiCompatibilityGroup = aiPanel.add("group");
        aiCompatibilityGroup.orientation = "row";
        aiCompatibilityGroup.add("statictext", undefined, "Version:");
        var aiCompatibilityDropdown = aiCompatibilityGroup.add("dropdownlist", undefined, aiCompatibilityLabels);
        aiCompatibilityDropdown.selection = 0;
        var aiPdfCompatibleCheck = aiPanel.add("checkbox", undefined, "PDF compatible");
        aiPdfCompatibleCheck.value = true;
        var aiEmbedLinkedFilesCheck = aiPanel.add("checkbox", undefined, "Include linked files");
        aiEmbedLinkedFilesCheck.value = false;
        var aiCompressedCheck = aiPanel.add("checkbox", undefined, "Compress file");
        aiCompressedCheck.value = true;
        var aiIccCheck = aiPanel.add("checkbox", undefined, "Embed ICC profile");
        aiIccCheck.value = true;
        var aiEmbedPermittedFontsCheck = aiPanel.add("checkbox", undefined, "Embed permitted fonts for file preview");
        aiEmbedPermittedFontsCheck.value = true;
        var flattenGroup = aiPanel.add("group");
        flattenGroup.orientation = "row";
        flattenGroup.add("statictext", undefined, "Legacy transparency:");
        var flattenDropdown = flattenGroup.add("dropdownlist", undefined, flattenLabels);
        flattenDropdown.selection = 0;

        function selectedAiCompatibility() {
            return selectedDropdownValue(aiCompatibilityDropdown, aiCompatibilityValues, defaults.ai.compatibility);
        }

        function updateAiOptionAvailability() {
            var compatibility = selectedAiCompatibility();

            aiEmbedPermittedFontsCheck.enabled = supportsEmbedPermittedFonts(compatibility) && aiPdfCompatibleCheck.value;
            if (!aiEmbedPermittedFontsCheck.enabled) {
                aiEmbedPermittedFontsCheck.value = false;
            }
            flattenDropdown.enabled = supportsLegacyTransparency(compatibility);
            if (!flattenDropdown.enabled) {
                flattenDropdown.selection = 0;
            }
        }

        aiCompatibilityDropdown.onChange = updateAiOptionAvailability;
        aiPdfCompatibleCheck.onClick = updateAiOptionAvailability;
        updateAiOptionAvailability();

        var pdfPanel = settingsTabs.add("tab", undefined, "PDF");
        pdfPanel.orientation = "column";
        pdfPanel.alignChildren = "left";
        pdfPanel.margins = 12;
        var pdfPresetGroup = pdfPanel.add("group");
        pdfPresetGroup.orientation = "row";
        pdfPresetGroup.add("statictext", undefined, "Adobe PDF Preset:");
        var pdfPresetDropdown = pdfPresetGroup.add("dropdownlist", undefined, pdfPresetLabels);
        pdfPresetDropdown.selection = 0;
        var pdfSingleFileRadio = pdfPanel.add("radiobutton", undefined, "Single File");
        pdfSingleFileRadio.value = true;
        var pdfMultipleFilesRadio = pdfPanel.add("radiobutton", undefined, "Multiple Files");
        pdfPanel.add("statictext", undefined, "Use Edit > Adobe PDF Presets to view, modify, or create new presets.");

        var pngPanel = settingsTabs.add("tab", undefined, "PNG");
        pngPanel.orientation = "column";
        pngPanel.alignChildren = "left";
        pngPanel.margins = 12;
        var pngTransparencyCheck = pngPanel.add("checkbox", undefined, "Transparent background");
        pngTransparencyCheck.value = true;
        var pngArtboardCheck = pngPanel.add("checkbox", undefined, "Clip to selected artboards");
        pngArtboardCheck.value = true;
        var pngIncludeBleedCheck = pngPanel.add("checkbox", undefined, "Include Bleed");
        pngIncludeBleedCheck.value = true;
        var pngFullDocumentCheck = pngPanel.add("checkbox", undefined, "Full Document");
        pngFullDocumentCheck.value = false;
        var pngUseArtboardNamesCheck = pngPanel.add("checkbox", undefined, "Use artboard names as file names");
        pngUseArtboardNamesCheck.value = false;
        var pngAntiAliasingCheck = pngPanel.add("checkbox", undefined, "Anti-aliasing");
        pngAntiAliasingCheck.value = true;

        var scaleGroup = pngPanel.add("group");
        scaleGroup.orientation = "row";
        scaleGroup.add("statictext", undefined, "Scale:");
        var scaleInput = scaleGroup.add("edittext", undefined, "100");
        scaleInput.characters = 6;
        scaleGroup.add("statictext", undefined, "%");

        settingsTabs.selection = aiPanel;

        var buttonGroup = dialog.add("group");
        buttonGroup.alignment = "right";
        var exportButton = buttonGroup.add("button", undefined, "Export", { name: "ok" });

        function updateArtboardRangeInput() {
            artboardRangeInput.enabled = artboardRangeRadio.value;
        }

        artboardAllRadio.onClick = updateArtboardRangeInput;
        artboardRangeRadio.onClick = updateArtboardRangeInput;
        updateArtboardRangeInput();

        function updatePngOptionAvailability() {
            pngUseArtboardNamesCheck.enabled = !pngFullDocumentCheck.value;
        }

        pngFullDocumentCheck.onClick = updatePngOptionAvailability;
        updatePngOptionAvailability();

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

            if (artboardRangeRadio.value) {
                try {
                    parseArtboardRange(artboardRangeInput.text, artboardCount(doc));
                } catch (error) {
                    alert(errorMessage(error));
                    return;
                }
            }

            dialog.close(1);
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
                compatibility: selectedDropdownValue(aiCompatibilityDropdown, aiCompatibilityValues, defaults.ai.compatibility),
                pdfCompatible: aiPdfCompatibleCheck.value,
                embedLinkedFiles: aiEmbedLinkedFilesCheck.value,
                compressed: aiCompressedCheck.value,
                embedICCProfile: aiIccCheck.value,
                embedPermittedFonts: aiEmbedPermittedFontsCheck.value,
                fontSubsetThreshold: aiEmbedPermittedFontsCheck.value ? 100 : 0,
                flattenOutput: selectedDropdownValue(flattenDropdown, flattenValues, defaults.ai.flattenOutput)
            },
            pdf: {
                preset: selectedDropdownValue(pdfPresetDropdown, pdfPresetValues, ""),
                outputMode: pdfMultipleFilesRadio.value ? "multiple" : "single"
            },
            png: {
                scale: parseScale(scaleInput.text),
                transparency: pngTransparencyCheck.value,
                artBoardClipping: !pngFullDocumentCheck.value && pngArtboardCheck.value,
                antiAliasing: pngAntiAliasingCheck.value,
                includeBleed: pngIncludeBleedCheck.value,
                fullDocument: pngFullDocumentCheck.value,
                useArtboardNames: !pngFullDocumentCheck.value && pngUseArtboardNamesCheck.value
            },
            artboards: {
                mode: artboardRangeRadio.value ? "range" : "all",
                range: artboardRangeRadio.value ? parseArtboardRange(artboardRangeInput.text, artboardCount(doc)) : trim(artboardRangeInput.text)
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
            return "Error: " + errorMessage(error);
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
                return "Closed";
            }

            var files = exportAll(settings);
            alert(
                "Export complete:\n\n" +
                exportedPaths(files, settings)
            );
            return "Export complete: " + exportedLabels(settings);
        } catch (error) {
            alert(APP_NAME + " failed:\n" + errorMessage(error));
            return "Error: " + errorMessage(error);
        }
    }

    $.global.AIOExporter = {
        run: run,
        runWithSettings: runWithSettings,
        exportAll: exportAll,
        getDefaultsJson: getDefaultsJson,
        selectFolder: selectFolder
    };

    if (!$.global.AIO_EXPORTER_NO_AUTORUN) {
        run();
    }
})();
