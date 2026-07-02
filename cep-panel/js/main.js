(function () {
    "use strict";

    var cs = typeof CSInterface === "function" ? new CSInterface() : null;
    var busy = false;
    var activeModalFormat = null;

    var state = {
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

    var elements = {
        folderInput: document.getElementById("folderInput"),
        baseNameInput: document.getElementById("baseNameInput"),
        browseButton: document.getElementById("browseButton"),
        overwriteCheckbox: document.getElementById("overwriteCheckbox"),
        formatAi: document.getElementById("formatAi"),
        formatPdf: document.getElementById("formatPdf"),
        formatPng: document.getElementById("formatPng"),
        summaryAi: document.getElementById("summaryAi"),
        summaryPdf: document.getElementById("summaryPdf"),
        summaryPng: document.getElementById("summaryPng"),
        exportButton: document.getElementById("exportButton"),
        statusText: document.getElementById("statusText"),
        settingsModal: document.getElementById("settingsModal"),
        modalTitle: document.getElementById("modalTitle"),
        modalBody: document.getElementById("modalBody"),
        modalCancelButton: document.getElementById("modalCancelButton"),
        modalDoneButton: document.getElementById("modalDoneButton")
    };

    function trim(value) {
        return String(value || "").replace(/^\s+|\s+$/g, "");
    }

    function setStatus(message, isError) {
        elements.statusText.textContent = message;
        elements.statusText.className = isError ? "status error" : "status";
    }

    function escapeForExtendScript(value) {
        return String(value)
            .replace(/\\/g, "/")
            .replace(/"/g, '\\"');
    }

    function hasSelectedFormat() {
        return elements.formatAi.checked || elements.formatPdf.checked || elements.formatPng.checked;
    }

    function setBusy(nextBusy) {
        busy = nextBusy;
        updateExportButton();
        elements.browseButton.disabled = busy;
    }

    function updateExportButton() {
        elements.exportButton.disabled = busy || !hasSelectedFormat() || !cs;
    }

    function updateFormatRows() {
        var formats = [
            ["ai", elements.formatAi],
            ["pdf", elements.formatPdf],
            ["png", elements.formatPng]
        ];
        var i;
        var row;

        for (i = 0; i < formats.length; i += 1) {
            row = document.querySelector('[data-format-row="' + formats[i][0] + '"]');
            if (row) {
                row.className = formats[i][1].checked ? "format-row" : "format-row is-disabled";
            }
        }
    }

    function updateSummaries() {
        var aiSummary = [];
        var pdfSummary = [];

        if (state.ai.pdfCompatible) {
            aiSummary.push("PDF compatible");
        }
        if (state.ai.compressed) {
            aiSummary.push("Compressed");
        }
        if (state.ai.embedICCProfile) {
            aiSummary.push("ICC profile");
        }

        if (state.pdf.preserveEditability) {
            pdfSummary.push("Editable");
        }
        if (state.pdf.generateThumbnails) {
            pdfSummary.push("Thumbnails");
        }
        if (state.pdf.viewAfterSaving) {
            pdfSummary.push("View after saving");
        }

        elements.summaryAi.textContent = aiSummary.length ? aiSummary.join(", ") : "Basic save";
        elements.summaryPdf.textContent = pdfSummary.length ? pdfSummary.join(", ") : "Standard PDF";
        elements.summaryPng.textContent =
            state.png.scale + "%, " +
            (state.png.transparency ? "Transparent" : "Opaque") + ", " +
            (state.png.artBoardClipping ? "Artboard" : "Artwork");
    }

    function getExtensionRoot() {
        if (!cs || typeof SystemPath === "undefined") {
            return "";
        }
        return cs.getSystemPath(SystemPath.EXTENSION);
    }

    function buildExporterScript(expression) {
        var extensionRoot = getExtensionRoot();
        var exporterPath;

        if (!extensionRoot) {
            setStatus("CEP runtime is not available.", true);
            return null;
        }

        exporterPath = escapeForExtendScript(extensionRoot + "/jsx/TripleFormatExporter.jsx");
        return (
            'try {' +
            '$.global.AIO_EXPORTER_NO_AUTORUN = true;' +
            '$.evalFile(new File("' + exporterPath + '"));' +
            '$.global.AIO_EXPORTER_NO_AUTORUN = false;' +
            expression +
            '} catch (e) {' +
            '"Error: " + e.message;' +
            '}'
        );
    }

    function evalExporter(expression, callback) {
        var script = buildExporterScript(expression);

        if (!script || !cs) {
            if (callback) {
                callback("Error: CEP runtime is not available.");
            }
            return;
        }

        cs.evalScript(script, callback);
    }

    function parseResultError(result) {
        return /^Error:/i.test(result || "");
    }

    function loadDefaults() {
        evalExporter("AIOExporter.getDefaultsJson();", function (result) {
            var defaults;

            if (parseResultError(result)) {
                setStatus(result, true);
                return;
            }

            try {
                defaults = JSON.parse(result || "{}");
            } catch (error) {
                setStatus("Could not read document defaults.", true);
                return;
            }

            if (defaults.folder) {
                elements.folderInput.value = defaults.folder;
            }
            if (defaults.baseName) {
                elements.baseNameInput.value = defaults.baseName;
            }

            if (defaults.hasDocument === false) {
                setStatus("Open an Illustrator document before exporting.", true);
            } else {
                setStatus("Ready", false);
            }
        });
    }

    function browseFolder() {
        var currentPath = JSON.stringify(elements.folderInput.value || "");

        setBusy(true);
        setStatus("Choosing folder...", false);

        evalExporter("AIOExporter.selectFolder(" + currentPath + ");", function (result) {
            setBusy(false);

            if (parseResultError(result)) {
                setStatus(result, true);
                return;
            }

            if (result) {
                elements.folderInput.value = result;
                setStatus("Ready", false);
            } else {
                setStatus("Folder unchanged", false);
            }
        });
    }

    function controlHtml(id, label, checked) {
        return (
            '<label class="check-line">' +
            '<input id="' + id + '" type="checkbox"' + (checked ? " checked" : "") + ">" +
            "<span>" + label + "</span>" +
            "</label>"
        );
    }

    function renderAiSettings() {
        elements.modalTitle.textContent = "AI Settings";
        elements.modalBody.innerHTML =
            controlHtml("modalAiPdfCompatible", "PDF compatible", state.ai.pdfCompatible) +
            controlHtml("modalAiCompressed", "Compress file", state.ai.compressed) +
            controlHtml("modalAiEmbedICCProfile", "Embed ICC profile", state.ai.embedICCProfile);
    }

    function renderPdfSettings() {
        elements.modalTitle.textContent = "PDF Settings";
        elements.modalBody.innerHTML =
            controlHtml("modalPdfPreserveEditability", "Preserve editability", state.pdf.preserveEditability) +
            controlHtml("modalPdfGenerateThumbnails", "Generate thumbnails", state.pdf.generateThumbnails) +
            controlHtml("modalPdfViewAfterSaving", "View after saving", state.pdf.viewAfterSaving);
    }

    function renderPngSettings() {
        elements.modalTitle.textContent = "PNG Settings";
        elements.modalBody.innerHTML =
            '<label class="modal-field" for="modalPngScale">' +
            "<span>Scale</span>" +
            '<input id="modalPngScale" class="text-field" type="number" min="1" max="1000" value="' + state.png.scale + '">' +
            "<span>%</span>" +
            "</label>" +
            controlHtml("modalPngTransparency", "Transparent background", state.png.transparency) +
            controlHtml("modalPngArtBoardClipping", "Clip to active artboard", state.png.artBoardClipping) +
            controlHtml("modalPngAntiAliasing", "Anti-aliasing", state.png.antiAliasing);
    }

    function openSettings(format) {
        activeModalFormat = format;

        if (format === "ai") {
            renderAiSettings();
        } else if (format === "pdf") {
            renderPdfSettings();
        } else {
            renderPngSettings();
        }

        elements.settingsModal.className = "modal";
    }

    function closeSettings() {
        activeModalFormat = null;
        elements.settingsModal.className = "modal is-hidden";
    }

    function checked(id) {
        return document.getElementById(id).checked;
    }

    function readScale() {
        var raw = Number(document.getElementById("modalPngScale").value);

        if (isNaN(raw) || raw <= 0) {
            return 100;
        }
        if (raw > 1000) {
            return 1000;
        }
        return Math.round(raw);
    }

    function saveSettings() {
        if (activeModalFormat === "ai") {
            state.ai.pdfCompatible = checked("modalAiPdfCompatible");
            state.ai.compressed = checked("modalAiCompressed");
            state.ai.embedICCProfile = checked("modalAiEmbedICCProfile");
        } else if (activeModalFormat === "pdf") {
            state.pdf.preserveEditability = checked("modalPdfPreserveEditability");
            state.pdf.generateThumbnails = checked("modalPdfGenerateThumbnails");
            state.pdf.viewAfterSaving = checked("modalPdfViewAfterSaving");
        } else if (activeModalFormat === "png") {
            state.png.scale = readScale();
            state.png.transparency = checked("modalPngTransparency");
            state.png.artBoardClipping = checked("modalPngArtBoardClipping");
            state.png.antiAliasing = checked("modalPngAntiAliasing");
        }

        updateSummaries();
        closeSettings();
    }

    function copySettings() {
        return {
            folder: trim(elements.folderInput.value),
            baseName: trim(elements.baseNameInput.value),
            overwrite: elements.overwriteCheckbox.checked,
            formats: {
                ai: elements.formatAi.checked,
                pdf: elements.formatPdf.checked,
                png: elements.formatPng.checked
            },
            ai: {
                pdfCompatible: state.ai.pdfCompatible,
                compressed: state.ai.compressed,
                embedICCProfile: state.ai.embedICCProfile
            },
            pdf: {
                preserveEditability: state.pdf.preserveEditability,
                generateThumbnails: state.pdf.generateThumbnails,
                viewAfterSaving: state.pdf.viewAfterSaving
            },
            png: {
                scale: state.png.scale,
                transparency: state.png.transparency,
                artBoardClipping: state.png.artBoardClipping,
                antiAliasing: state.png.antiAliasing
            }
        };
    }

    function validateSettings(settings) {
        if (!settings.folder) {
            return "Choose an export folder.";
        }
        if (!settings.baseName) {
            return "Enter a base file name.";
        }
        if (!settings.formats.ai && !settings.formats.pdf && !settings.formats.png) {
            return "Select at least one export format.";
        }
        return "";
    }

    function runExporter() {
        var settings = copySettings();
        var validationMessage = validateSettings(settings);
        var expression;

        if (validationMessage) {
            setStatus(validationMessage, true);
            updateExportButton();
            return;
        }

        expression = "AIOExporter.runWithSettings(" + JSON.stringify(settings) + ");";
        setBusy(true);
        setStatus("Exporting selected formats...", false);

        evalExporter(expression, function (result) {
            setBusy(false);
            setStatus(result || "Done", parseResultError(result));
        });
    }

    function bindEvents() {
        var settingsButtons = document.querySelectorAll(".settings-button");
        var closeButtons = document.querySelectorAll("[data-close-modal]");
        var formatInputs = [elements.formatAi, elements.formatPdf, elements.formatPng];
        var i;

        elements.browseButton.addEventListener("click", browseFolder);
        elements.exportButton.addEventListener("click", runExporter);
        elements.modalCancelButton.addEventListener("click", closeSettings);
        elements.modalDoneButton.addEventListener("click", saveSettings);

        for (i = 0; i < settingsButtons.length; i += 1) {
            settingsButtons[i].addEventListener("click", function () {
                openSettings(this.getAttribute("data-format"));
            });
        }

        for (i = 0; i < closeButtons.length; i += 1) {
            closeButtons[i].addEventListener("click", closeSettings);
        }

        for (i = 0; i < formatInputs.length; i += 1) {
            formatInputs[i].addEventListener("change", function () {
                updateFormatRows();
                updateExportButton();
                if (!hasSelectedFormat()) {
                    setStatus("Select at least one export format.", true);
                } else {
                    setStatus("Ready", false);
                }
            });
        }

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && activeModalFormat) {
                closeSettings();
            }
        });
    }

    bindEvents();
    updateSummaries();
    updateFormatRows();
    updateExportButton();

    if (cs) {
        loadDefaults();
    } else {
        setStatus("Preview mode: Illustrator runtime is not available.", true);
    }
})();
