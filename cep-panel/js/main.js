(function () {
    "use strict";

    var cs = typeof CSInterface === "function" ? new CSInterface() : null;
    var busy = false;
    var updateBusy = false;
    var activeModalFormat = null;
    var STORAGE_KEY = "aioExporter.settings.v1";
    var APP_VERSION = "1.3.2";
    var GITHUB_RELEASES_URL = "https://github.com/char8294/Illustrator_Add-on/releases";
    var GITHUB_LATEST_RELEASE_API = "https://api.github.com/repos/char8294/Illustrator_Add-on/releases/latest";
    var GITHUB_TAGS_API = "https://api.github.com/repos/char8294/Illustrator_Add-on/tags";

    var AI_COMPATIBILITY_OPTIONS = [
        ["ILLUSTRATOR19", "Illustrator 19"],
        ["ILLUSTRATOR17", "Illustrator 17"],
        ["ILLUSTRATOR16", "Illustrator 16"],
        ["ILLUSTRATOR15", "Illustrator 15"],
        ["ILLUSTRATOR14", "Illustrator 14"],
        ["ILLUSTRATOR13", "Illustrator 13"],
        ["ILLUSTRATOR12", "Illustrator 12"],
        ["ILLUSTRATOR11", "Illustrator 11"],
        ["ILLUSTRATOR10", "Illustrator 10"],
        ["ILLUSTRATOR9", "Illustrator 9"],
        ["ILLUSTRATOR8", "Illustrator 8"]
    ];

    var FLATTEN_OUTPUT_OPTIONS = [
        ["PRESERVEAPPEARANCE", "Preserve Appearance"],
        ["PRESERVEPATHS", "Preserve Paths"]
    ];

    var state = {
        ai: {
            compatibility: "ILLUSTRATOR19",
            pdfCompatible: true,
            embedLinkedFiles: false,
            compressed: true,
            embedICCProfile: true,
            fontSubsetThreshold: 100,
            flattenOutput: "PRESERVEAPPEARANCE"
        },
        pdf: {
            preset: "",
            outputMode: "single"
        },
        png: {
            scale: 100,
            transparency: true,
            artBoardClipping: true,
            antiAliasing: true,
            includeBleed: true,
            fullDocument: false
        },
        artboards: {
            mode: "all",
            range: ""
        }
    };

    var documentInfo = {
        artboardCount: 1,
        activeArtboard: 1,
        artboardNames: [],
        pdfPresets: []
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
        artboardCards: document.getElementById("artboardCards"),
        artboardModeAll: document.getElementById("artboardModeAll"),
        artboardModeRange: document.getElementById("artboardModeRange"),
        artboardRangeInput: document.getElementById("artboardRangeInput"),
        artboardRangeNote: document.getElementById("artboardRangeNote"),
        versionBadge: document.getElementById("versionBadge"),
        updateButton: document.getElementById("updateButton"),
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

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function optionHtml(value, label, selected) {
        return '<option value="' + escapeHtml(value) + '"' + (selected ? " selected" : "") + ">" + escapeHtml(label) + "</option>";
    }

    function optionLabel(options, value, fallback) {
        var i;

        for (i = 0; i < options.length; i += 1) {
            if (options[i][0] === value) {
                return options[i][1];
            }
        }

        return fallback;
    }

    function boolValue(value, fallback) {
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

    function optionValue(options, value, fallback) {
        var i;

        for (i = 0; i < options.length; i += 1) {
            if (options[i][0] === value) {
                return value;
            }
        }

        return fallback;
    }

    function pdfPresetValue(value) {
        var i;

        if (!documentInfo.pdfPresets.length) {
            return "";
        }

        for (i = 0; i < documentInfo.pdfPresets.length; i += 1) {
            if (documentInfo.pdfPresets[i] === value) {
                return value;
            }
        }

        return documentInfo.pdfPresets[0] || "";
    }

    function readPersistedSettings() {
        var raw;
        var parsed;

        try {
            if (!window.localStorage) {
                return null;
            }

            raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return null;
            }

            parsed = JSON.parse(raw);
            if (parsed && parsed.settings) {
                return parsed.settings;
            }

            return parsed && typeof parsed === "object" ? parsed : null;
        } catch (ignored) {
            return null;
        }
    }

    function settingsForStorage(settings) {
        var stored;

        try {
            stored = JSON.parse(JSON.stringify(settings || {}));
        } catch (ignored) {
            stored = {};
        }

        delete stored.folder;
        delete stored.baseName;
        return stored;
    }

    function writePersistedSettings(settings) {
        try {
            if (window.localStorage) {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    version: 1,
                    settings: settingsForStorage(settings)
                }));
            }
        } catch (ignored) {}
    }

    function setStatus(message, isError) {
        elements.statusText.textContent = message;
        elements.statusText.className = isError ? "status error" : "status";
    }

    function normalizeVersion(value) {
        var match = String(value || "").match(/\d+(?:\.\d+){0,2}/);
        return match ? match[0] : "";
    }

    function versionParts(value) {
        var normalized = normalizeVersion(value);
        var pieces = normalized ? normalized.split(".") : [];
        var parts = [];
        var i;
        var number;

        for (i = 0; i < 3; i += 1) {
            number = parseInt(pieces[i] || "0", 10);
            parts.push(isNaN(number) ? 0 : number);
        }

        return parts;
    }

    function compareVersions(left, right) {
        var leftParts = versionParts(left);
        var rightParts = versionParts(right);
        var i;

        for (i = 0; i < 3; i += 1) {
            if (leftParts[i] > rightParts[i]) {
                return 1;
            }
            if (leftParts[i] < rightParts[i]) {
                return -1;
            }
        }

        return 0;
    }

    function updateVersionBadge(version) {
        if (elements.versionBadge) {
            elements.versionBadge.textContent = "v" + (normalizeVersion(version) || APP_VERSION);
        }
    }

    function openExternalUrl(url) {
        if (cs && typeof cs.openURLInDefaultBrowser === "function") {
            cs.openURLInDefaultBrowser(url);
            return;
        }

        window.open(url, "_blank");
    }

    function setUpdateBusy(nextBusy) {
        updateBusy = nextBusy;
        if (elements.updateButton) {
            elements.updateButton.disabled = updateBusy;
        }
    }

    function fetchJson(url, callback) {
        var request;
        var completed = false;

        function finish(error, release) {
            if (completed) {
                return;
            }

            completed = true;
            callback(error, release);
        }

        if (typeof XMLHttpRequest !== "function") {
            finish(new Error("This CEP runtime cannot check GitHub directly."));
            return;
        }

        request = new XMLHttpRequest();

        request.open("GET", url, true);
        request.timeout = 8000;
        request.onreadystatechange = function () {
            var release;

            if (request.readyState !== 4) {
                return;
            }

            if (request.status < 200 || request.status >= 300) {
                finish(new Error("GitHub releases are not available yet."));
                return;
            }

            try {
                release = JSON.parse(request.responseText || "{}");
            } catch (error) {
                finish(error);
                return;
            }

            finish(null, release);
        };
        request.onerror = function () {
            finish(new Error("Could not connect to GitHub."));
        };
        request.ontimeout = function () {
            finish(new Error("GitHub update check timed out."));
        };
        try {
            request.send();
        } catch (error) {
            finish(error);
        }
    }

    function fetchLatestRelease(callback) {
        fetchJson(GITHUB_LATEST_RELEASE_API, callback);
    }

    function fetchLatestTag(callback) {
        fetchJson(GITHUB_TAGS_API, function (error, tags) {
            if (error) {
                callback(error);
                return;
            }

            if (!tags || !tags.length) {
                callback(new Error("No GitHub tags found."));
                return;
            }

            callback(null, tags[0]);
        });
    }

    function releaseVersion(release) {
        return normalizeVersion(release && (release.tag_name || release.name));
    }

    function showUpdateCheckFallback(message) {
        setStatus(message || "Opening GitHub releases page...", false);
        openExternalUrl(GITHUB_RELEASES_URL);
    }

    function finishUpdateCheck(latestVersion, releaseUrl) {
        releaseUrl = releaseUrl || GITHUB_RELEASES_URL;

        if (!latestVersion) {
            showUpdateCheckFallback("No published update version found. Opening GitHub releases...");
            return;
        }

        if (compareVersions(latestVersion, APP_VERSION) > 0) {
            setStatus("Update available: v" + latestVersion, false);
            openExternalUrl(releaseUrl);
            return;
        }

        setStatus("AIO Exporter v" + APP_VERSION + " is up to date.", false);
    }

    function checkForUpdates() {
        if (updateBusy) {
            return;
        }

        setUpdateBusy(true);
        setStatus("Checking GitHub for updates...", false);

        fetchLatestRelease(function (error, release) {
            var latestVersion;
            var releaseUrl;

            if (!error) {
                latestVersion = releaseVersion(release);
                releaseUrl = release.html_url || GITHUB_RELEASES_URL;
                setUpdateBusy(false);
                finishUpdateCheck(latestVersion, releaseUrl);
                return;
            }

            fetchLatestTag(function (tagError, tag) {
                setUpdateBusy(false);

                if (tagError) {
                    showUpdateCheckFallback("GitHub release check is unavailable. Opening releases...");
                    return;
                }

                finishUpdateCheck(releaseVersion(tag), GITHUB_RELEASES_URL);
            });
        });
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

        aiSummary.push(optionLabel(AI_COMPATIBILITY_OPTIONS, state.ai.compatibility, state.ai.compatibility));

        if (state.ai.pdfCompatible) {
            aiSummary.push("PDF compatible");
        }
        if (state.ai.embedLinkedFiles) {
            aiSummary.push("Linked files");
        }
        if (state.ai.compressed) {
            aiSummary.push("Compressed");
        }
        if (state.ai.embedICCProfile) {
            aiSummary.push("ICC profile");
        }

        if (state.pdf.preset) {
            pdfSummary.push(state.pdf.preset);
        }
        pdfSummary.push(state.pdf.outputMode === "multiple" ? "Multiple files" : "Single file");

        elements.summaryAi.textContent = aiSummary.length ? aiSummary.join(", ") : "Basic save";
        elements.summaryPdf.textContent = pdfSummary.length ? pdfSummary.join(", ") : "Standard PDF";
        elements.summaryPng.textContent =
            state.png.scale + "%, " +
            (state.png.transparency ? "Transparent" : "Opaque") + ", " +
            (state.png.fullDocument ? "Full document" : "Artboard") +
            (!state.png.fullDocument && state.png.includeBleed ? " + bleed" : "");
    }

    function artboardLimitText() {
        if (documentInfo.artboardCount > 1) {
            return "1-" + documentInfo.artboardCount;
        }
        return "1";
    }

    function selectedArtboardMode() {
        return elements.artboardModeRange && elements.artboardModeRange.checked ? "range" : "all";
    }

    function setArtboardMode(mode) {
        if (elements.artboardModeAll) {
            elements.artboardModeAll.checked = mode === "all";
        }
        if (elements.artboardModeRange) {
            elements.artboardModeRange.checked = mode === "range";
        }
    }

    function updateArtboardRangeInput() {
        var isRange = selectedArtboardMode() === "range";

        if (elements.artboardRangeInput) {
            elements.artboardRangeInput.disabled = !isRange;
        }
        if (elements.artboardRangeNote) {
            elements.artboardRangeNote.textContent = artboardLimitText();
        }
    }

    function updateArtboardControls() {
        setArtboardMode(state.artboards.mode);
        if (elements.artboardRangeInput) {
            elements.artboardRangeInput.value = state.artboards.range;
        }
        renderArtboardCards();
        updateArtboardRangeInput();
    }

    function syncArtboardStateFromControls() {
        state.artboards = readArtboardSelectionFromControls();
        renderArtboardCards();
        updateArtboardRangeInput();
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

        exporterPath = escapeForExtendScript(extensionRoot + "/jsx/AIO_Exporter.jsx");
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

    function updateDocumentInfo(defaults) {
        documentInfo.artboardCount = defaults.artboardCount || 1;
        documentInfo.activeArtboard = defaults.activeArtboard || 1;
        documentInfo.artboardNames = defaults.artboardNames || [];
        documentInfo.pdfPresets = defaults.pdfPresets || [];
        updateVersionBadge(defaults.version || APP_VERSION);

        if (!state.pdf.preset && documentInfo.pdfPresets.length) {
            state.pdf.preset = documentInfo.pdfPresets[0];
        } else {
            state.pdf.preset = pdfPresetValue(state.pdf.preset);
        }
        state.artboards = normalizePersistedArtboards(state.artboards);
    }

    function loadDefaults() {
        evalExporter("AIOExporter.getDefaultsJson();", function (result) {
            var defaults;
            var savedSettings;

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

            updateDocumentInfo(defaults);

            savedSettings = readPersistedSettings();
            if (savedSettings) {
                applyPersistedSettings(savedSettings);
            }
            state.pdf.preset = pdfPresetValue(state.pdf.preset);
            state.artboards = normalizePersistedArtboards(state.artboards);
            updateArtboardControls();
            updateSummaries();
            updateFormatRows();
            updateExportButton();

            if (defaults.hasDocument === false) {
                setStatus("Open an Illustrator document before exporting.", true);
            } else {
                setStatus("Ready", false);
            }
        });
    }

    function refreshRuntimeDefaults(callback) {
        if (!cs) {
            callback(false);
            return;
        }

        evalExporter("AIOExporter.getDefaultsJson();", function (result) {
            var defaults;

            if (parseResultError(result)) {
                callback(false);
                return;
            }

            try {
                defaults = JSON.parse(result || "{}");
            } catch (error) {
                callback(false);
                return;
            }

            updateDocumentInfo(defaults);
            updateArtboardControls();
            updateSummaries();
            callback(true);
        });
    }

    function pickFolderWithCep(currentPath) {
        var fs = window.cep && window.cep.fs ? window.cep.fs : null;
        var result;

        if (!fs) {
            return null;
        }

        try {
            if (typeof fs.showOpenDialogEx === "function") {
                result = fs.showOpenDialogEx(false, true, "Pick Location", currentPath || "", [], "");
            } else if (typeof fs.showOpenDialog === "function") {
                result = fs.showOpenDialog(false, true, "Pick Location", currentPath || "", []);
            } else {
                return null;
            }
        } catch (ignored) {
            return null;
        }

        if (result && result.err === 0 && result.data && result.data.length) {
            return result.data[0];
        }

        return "";
    }

    function browseFolder() {
        var currentPath = JSON.stringify(elements.folderInput.value || "");
        var cepSelected;

        setBusy(true);
        setStatus("Choosing folder...", false);

        cepSelected = pickFolderWithCep(elements.folderInput.value || "");
        if (cepSelected !== null) {
            setBusy(false);
            if (cepSelected) {
                elements.folderInput.value = cepSelected;
                persistCurrentSettings();
                setStatus("Ready", false);
            } else {
                setStatus("Folder unchanged", false);
            }
            return;
        }

        evalExporter("AIOExporter.selectFolder(" + currentPath + ");", function (result) {
            setBusy(false);

            if (parseResultError(result)) {
                setStatus(result, true);
                return;
            }

            if (result) {
                elements.folderInput.value = result;
                persistCurrentSettings();
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

    function tabButtonHtml(tab, label) {
        return '<button class="modal-tab" type="button" data-settings-tab="' + tab + '" role="tab">' + label + "</button>";
    }

    function panelHtml(tab, html) {
        return '<div class="settings-panel" data-settings-panel="' + tab + '" role="tabpanel">' + html + "</div>";
    }

    function optionsHtml(options, selectedValue) {
        var html = "";
        var i;

        for (i = 0; i < options.length; i += 1) {
            html += optionHtml(options[i][0], options[i][1], options[i][0] === selectedValue);
        }

        return html;
    }

    function pdfPresetOptionsHtml() {
        var html = "";
        var i;

        if (!documentInfo.pdfPresets.length) {
            return optionHtml("", "Custom settings", true);
        }

        for (i = 0; i < documentInfo.pdfPresets.length; i += 1) {
            html += optionHtml(documentInfo.pdfPresets[i], documentInfo.pdfPresets[i], documentInfo.pdfPresets[i] === state.pdf.preset);
        }

        return html;
    }

    function renderSettingsModal(activeTab) {
        elements.modalTitle.textContent = "Settings";
        elements.modalBody.innerHTML =
            '<div class="modal-tabs" role="tablist">' +
            tabButtonHtml("ai", "AI") +
            tabButtonHtml("pdf", "PDF") +
            tabButtonHtml("png", "PNG") +
            "</div>" +
            panelHtml(
                "ai",
                '<label class="modal-field wide-modal-field" for="modalAiCompatibility">' +
                "<span>Version</span>" +
                '<select id="modalAiCompatibility" class="select-field">' + optionsHtml(AI_COMPATIBILITY_OPTIONS, state.ai.compatibility) + "</select>" +
                "</label>" +
                controlHtml("modalAiPdfCompatible", "PDF compatible", state.ai.pdfCompatible) +
                controlHtml("modalAiEmbedLinkedFiles", "Include linked files", state.ai.embedLinkedFiles) +
                controlHtml("modalAiCompressed", "Compress file", state.ai.compressed) +
                controlHtml("modalAiEmbedICCProfile", "Embed ICC profile", state.ai.embedICCProfile) +
                '<label class="modal-field number-modal-field" for="modalAiFontSubsetThreshold">' +
                "<span>Subset fonts below</span>" +
                '<input id="modalAiFontSubsetThreshold" class="text-field" type="number" min="0" max="100" value="' + state.ai.fontSubsetThreshold + '">' +
                "<span>%</span>" +
                "</label>" +
                '<label class="modal-field wide-modal-field" for="modalAiFlattenOutput">' +
                "<span>Legacy transparency</span>" +
                '<select id="modalAiFlattenOutput" class="select-field">' + optionsHtml(FLATTEN_OUTPUT_OPTIONS, state.ai.flattenOutput) + "</select>" +
                "</label>"
            ) +
            panelHtml(
                "pdf",
                '<label class="modal-field pdf-preset-field" for="modalPdfPreset">' +
                "<span>Adobe PDF Preset:</span>" +
                '<select id="modalPdfPreset" class="select-field">' + pdfPresetOptionsHtml() + "</select>" +
                "</label>" +
                '<div class="option-group">' +
                '<label class="radio-line">' +
                '<input name="modalPdfOutputMode" type="radio" value="single"' + (state.pdf.outputMode === "multiple" ? "" : " checked") + ">" +
                "<span>Single File</span>" +
                "</label>" +
                '<label class="radio-line">' +
                '<input name="modalPdfOutputMode" type="radio" value="multiple"' + (state.pdf.outputMode === "multiple" ? " checked" : "") + ">" +
                "<span>Multiple Files</span>" +
                "</label>" +
                "</div>" +
                '<div class="info-line">' +
                '<span class="info-icon" aria-hidden="true">i</span>' +
                "<span>Use Edit &gt; Adobe PDF Presets to view, modify, or create new presets.</span>" +
                "</div>"
            ) +
            panelHtml(
                "png",
                '<label class="modal-field" for="modalPngScale">' +
                "<span>Scale</span>" +
                '<input id="modalPngScale" class="text-field" type="number" min="1" max="1000" value="' + state.png.scale + '">' +
                "<span>%</span>" +
                "</label>" +
                controlHtml("modalPngTransparency", "Transparent background", state.png.transparency) +
                controlHtml("modalPngIncludeBleed", "Include Bleed", state.png.includeBleed) +
                controlHtml("modalPngFullDocument", "Full Document", state.png.fullDocument) +
                controlHtml("modalPngAntiAliasing", "Anti-aliasing", state.png.antiAliasing)
            );

        bindModalTabs();
        activateSettingsTab(activeTab || "ai");
    }

    function activateSettingsTab(tab) {
        var tabs = document.querySelectorAll("[data-settings-tab]");
        var panels = document.querySelectorAll("[data-settings-panel]");
        var i;

        activeModalFormat = tab;

        for (i = 0; i < tabs.length; i += 1) {
            tabs[i].className = tabs[i].getAttribute("data-settings-tab") === tab ? "modal-tab is-active" : "modal-tab";
        }

        for (i = 0; i < panels.length; i += 1) {
            panels[i].className = panels[i].getAttribute("data-settings-panel") === tab ? "settings-panel is-active" : "settings-panel";
        }
    }

    function bindModalTabs() {
        var tabs = document.querySelectorAll("[data-settings-tab]");
        var i;

        for (i = 0; i < tabs.length; i += 1) {
            tabs[i].addEventListener("click", function () {
                activateSettingsTab(this.getAttribute("data-settings-tab"));
            });
        }
    }

    function openSettings(format) {
        if (format === "pdf" && cs) {
            setStatus("Refreshing PDF presets...", false);
            refreshRuntimeDefaults(function () {
                renderSettingsModal(format);
                elements.settingsModal.className = "modal";
                setStatus("Ready", false);
            });
            return;
        }

        renderSettingsModal(format);
        elements.settingsModal.className = "modal";
    }

    function closeSettings() {
        activeModalFormat = null;
        elements.settingsModal.className = "modal is-hidden";
    }

    function checked(id) {
        return document.getElementById(id).checked;
    }

    function fieldValue(id, fallback) {
        var field = document.getElementById(id);
        return field ? field.value : fallback;
    }

    function selectedInputValue(name, fallback) {
        var selected = document.querySelector('input[name="' + name + '"]:checked');
        return selected ? selected.value : fallback;
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

    function readPercent(id, fallback) {
        var raw = Number(fieldValue(id, fallback));

        if (isNaN(raw)) {
            return fallback;
        }
        if (raw < 0) {
            return 0;
        }
        if (raw > 100) {
            return 100;
        }
        return Math.round(raw);
    }

    function parseArtboardRange(rawRange) {
        var count = documentInfo.artboardCount || 1;
        var compact = trim(rawRange).replace(/\s+/g, "");
        var parts;
        var normalized = [];
        var i;
        var part;
        var match;
        var start;
        var end;

        if (!compact) {
            return {
                error: "Enter an artboard range.",
                range: ""
            };
        }

        parts = compact.split(",");
        for (i = 0; i < parts.length; i += 1) {
            part = parts[i];
            if (!part) {
                return {
                    error: "Use artboard ranges like 1,3-5.",
                    range: ""
                };
            }

            match = part.match(/^(\d+)(?:-(\d+))?$/);
            if (!match) {
                return {
                    error: "Use artboard ranges like 1,3-5.",
                    range: ""
                };
            }

            start = parseInt(match[1], 10);
            end = match[2] ? parseInt(match[2], 10) : start;

            if (start < 1 || end < 1 || start > count || end > count || start > end) {
                return {
                    error: "Artboard range must be within 1-" + count + ".",
                    range: ""
                };
            }

            normalized.push(start === end ? String(start) : start + "-" + end);
        }

        return {
            error: "",
            range: normalized.join(",")
        };
    }

    function numbersFromRange(rawRange) {
        var parsed = parseArtboardRange(rawRange);
        var numbers = {};
        var parts;
        var i;
        var match;
        var start;
        var end;
        var value;

        if (parsed.error) {
            return numbers;
        }

        parts = parsed.range.split(",");
        for (i = 0; i < parts.length; i += 1) {
            match = parts[i].match(/^(\d+)(?:-(\d+))?$/);
            if (match) {
                start = parseInt(match[1], 10);
                end = match[2] ? parseInt(match[2], 10) : start;
                for (value = start; value <= end; value += 1) {
                    numbers[value] = true;
                }
            }
        }

        return numbers;
    }

    function compactArtboardRange(numbers) {
        var values = [];
        var ranges = [];
        var i;
        var start;
        var previous;

        for (i = 1; i <= documentInfo.artboardCount; i += 1) {
            if (numbers[i]) {
                values.push(i);
            }
        }

        if (!values.length) {
            return "";
        }

        start = values[0];
        previous = values[0];

        for (i = 1; i <= values.length; i += 1) {
            if (values[i] === previous + 1) {
                previous = values[i];
            } else {
                ranges.push(start === previous ? String(start) : start + "-" + previous);
                start = values[i];
                previous = values[i];
            }
        }

        return ranges.join(",");
    }

    function allArtboardsSelected(numbers) {
        var i;

        for (i = 1; i <= documentInfo.artboardCount; i += 1) {
            if (!numbers[i]) {
                return false;
            }
        }

        return true;
    }

    function selectedArtboardNumbers() {
        var mode = state.artboards.mode;
        var numbers = {};
        var i;

        if (mode === "all") {
            for (i = 1; i <= documentInfo.artboardCount; i += 1) {
                numbers[i] = true;
            }
            return numbers;
        }

        if (mode === "range") {
            return numbersFromRange(state.artboards.range);
        }

        return numbers;
    }

    function selectionFromArtboardNumbers(numbers) {
        var range = compactArtboardRange(numbers);

        if (!range) {
            return {
                mode: "range",
                range: ""
            };
        }

        if (allArtboardsSelected(numbers)) {
            return {
                mode: "all",
                range: ""
            };
        }

        return {
            mode: "range",
            range: range
        };
    }

    function renderArtboardCards() {
        var selected = selectedArtboardNumbers();
        var html = "";
        var i;
        var count = Math.max(1, documentInfo.artboardCount || 1);
        var classes;
        var label;

        for (i = 1; i <= count; i += 1) {
            classes = "artboard-card";
            if (selected[i]) {
                classes += " is-selected";
            }
            label = trim(documentInfo.artboardNames[i - 1] || "") || ("Artboard " + i);
            html +=
                '<label class="' + classes + '" title="' + escapeHtml(label) + '">' +
                '<input class="artboard-checkbox" type="checkbox" data-artboard="' + i + '"' + (selected[i] ? " checked" : "") + ">" +
                '<span class="artboard-name">' + escapeHtml(label) + "</span>" +
                "</label>";
        }

        elements.artboardCards.innerHTML = html;
    }

    function readArtboardSelectionFromList() {
        var selected = {};
        var inputs = elements.artboardCards.querySelectorAll("input[data-artboard]");
        var i;
        var artboardNumber;

        for (i = 0; i < inputs.length; i += 1) {
            if (inputs[i].checked) {
                artboardNumber = parseInt(inputs[i].getAttribute("data-artboard"), 10);
                if (!isNaN(artboardNumber)) {
                    selected[artboardNumber] = true;
                }
            }
        }

        return selectionFromArtboardNumbers(selected);
    }

    function readArtboardSelectionFromControls() {
        var mode = selectedArtboardMode();

        if (mode === "range") {
            return {
                mode: "range",
                range: trim(elements.artboardRangeInput ? elements.artboardRangeInput.value : "")
            };
        }

        return {
            mode: "all",
            range: ""
        };
    }

    function applyArtboardSelectionFromList() {
        state.artboards = readArtboardSelectionFromList();
        setArtboardMode(state.artboards.mode);
        if (elements.artboardRangeInput) {
            elements.artboardRangeInput.value = state.artboards.range;
        }
        renderArtboardCards();
        updateArtboardRangeInput();
    }

    function readArtboardSettings() {
        var mode = state.artboards.mode;
        var range = trim(state.artboards.range);
        var parsed;

        if (mode === "range") {
            if (!range) {
                return {
                    error: "Select at least one artboard."
                };
            }

            parsed = parseArtboardRange(range);
            if (parsed.error) {
                return {
                    error: parsed.error
                };
            }
            range = parsed.range;
        }

        return {
            error: "",
            mode: mode,
            range: range
        };
    }

    function normalizePersistedArtboards(savedArtboards) {
        var mode = savedArtboards && savedArtboards.mode === "range" ? "range" : "all";
        var range = trim(savedArtboards && savedArtboards.range);
        var parsed;

        if (mode === "range") {
            parsed = parseArtboardRange(range);
            if (parsed.error) {
                return {
                    mode: "all",
                    range: ""
                };
            }
            range = parsed.range;
        } else {
            range = "";
        }

        return {
            mode: mode,
            range: range
        };
    }

    function applyPersistedSettings(saved) {
        var savedFormats;
        var savedAi;
        var savedPdf;
        var savedPng;

        if (!saved || typeof saved !== "object") {
            return false;
        }

        elements.overwriteCheckbox.checked = boolValue(saved.overwrite, elements.overwriteCheckbox.checked);

        savedFormats = saved.formats || {};
        elements.formatAi.checked = boolValue(savedFormats.ai, elements.formatAi.checked);
        elements.formatPdf.checked = boolValue(savedFormats.pdf, elements.formatPdf.checked);
        elements.formatPng.checked = boolValue(savedFormats.png, elements.formatPng.checked);

        savedAi = saved.ai || {};
        state.ai.compatibility = optionValue(AI_COMPATIBILITY_OPTIONS, savedAi.compatibility, state.ai.compatibility);
        state.ai.pdfCompatible = boolValue(savedAi.pdfCompatible, state.ai.pdfCompatible);
        state.ai.embedLinkedFiles = boolValue(savedAi.embedLinkedFiles, state.ai.embedLinkedFiles);
        state.ai.compressed = boolValue(savedAi.compressed, state.ai.compressed);
        state.ai.embedICCProfile = boolValue(savedAi.embedICCProfile, state.ai.embedICCProfile);
        state.ai.fontSubsetThreshold = numberInRange(savedAi.fontSubsetThreshold, state.ai.fontSubsetThreshold, 0, 100);
        state.ai.flattenOutput = optionValue(FLATTEN_OUTPUT_OPTIONS, savedAi.flattenOutput, state.ai.flattenOutput);

        savedPdf = saved.pdf || {};
        state.pdf.preset = pdfPresetValue(savedPdf.preset);
        state.pdf.outputMode = savedPdf.outputMode === "multiple" ? "multiple" : "single";

        savedPng = saved.png || {};
        state.png.scale = numberInRange(savedPng.scale, state.png.scale, 1, 1000);
        state.png.transparency = boolValue(savedPng.transparency, state.png.transparency);
        state.png.includeBleed = boolValue(savedPng.includeBleed, state.png.includeBleed);
        state.png.fullDocument = boolValue(savedPng.fullDocument, state.png.fullDocument);
        state.png.artBoardClipping = !state.png.fullDocument && boolValue(savedPng.artBoardClipping, state.png.artBoardClipping);
        state.png.antiAliasing = boolValue(savedPng.antiAliasing, state.png.antiAliasing);
        state.artboards = normalizePersistedArtboards(saved.artboards);

        return true;
    }

    function persistCurrentSettings() {
        writePersistedSettings(copySettings());
    }

    function saveSettings() {
        state.ai.compatibility = fieldValue("modalAiCompatibility", state.ai.compatibility);
        state.ai.pdfCompatible = checked("modalAiPdfCompatible");
        state.ai.embedLinkedFiles = checked("modalAiEmbedLinkedFiles");
        state.ai.compressed = checked("modalAiCompressed");
        state.ai.embedICCProfile = checked("modalAiEmbedICCProfile");
        state.ai.fontSubsetThreshold = readPercent("modalAiFontSubsetThreshold", state.ai.fontSubsetThreshold);
        state.ai.flattenOutput = fieldValue("modalAiFlattenOutput", state.ai.flattenOutput);
        state.pdf.preset = fieldValue("modalPdfPreset", "");
        state.pdf.outputMode = selectedInputValue("modalPdfOutputMode", state.pdf.outputMode);
        state.png.scale = readScale();
        state.png.transparency = checked("modalPngTransparency");
        state.png.includeBleed = checked("modalPngIncludeBleed");
        state.png.fullDocument = checked("modalPngFullDocument");
        state.png.artBoardClipping = !state.png.fullDocument;
        state.png.antiAliasing = checked("modalPngAntiAliasing");

        updateSummaries();
        persistCurrentSettings();
        closeSettings();
    }

    function copySettings() {
        syncArtboardStateFromControls();

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
                compatibility: state.ai.compatibility,
                pdfCompatible: state.ai.pdfCompatible,
                embedLinkedFiles: state.ai.embedLinkedFiles,
                compressed: state.ai.compressed,
                embedICCProfile: state.ai.embedICCProfile,
                fontSubsetThreshold: state.ai.fontSubsetThreshold,
                flattenOutput: state.ai.flattenOutput
            },
            pdf: {
                preset: state.pdf.preset,
                outputMode: state.pdf.outputMode
            },
            png: {
                scale: state.png.scale,
                transparency: state.png.transparency,
                artBoardClipping: !state.png.fullDocument,
                antiAliasing: state.png.antiAliasing,
                includeBleed: state.png.includeBleed,
                fullDocument: state.png.fullDocument
            },
            artboards: {
                mode: state.artboards.mode,
                range: state.artboards.range
            }
        };
    }

    function validateSettings(settings) {
        var parsedArtboards;

        if (!settings.folder) {
            return "Choose an export folder.";
        }
        if (!settings.baseName) {
            return "Enter a base file name.";
        }
        if (!settings.formats.ai && !settings.formats.pdf && !settings.formats.png) {
            return "Select at least one export format.";
        }
        if (settings.artboards && settings.artboards.mode === "range") {
            if (!trim(settings.artboards.range)) {
                return "Select at least one artboard.";
            }
            parsedArtboards = parseArtboardRange(settings.artboards.range);
            if (parsedArtboards.error) {
                return parsedArtboards.error;
            }
            settings.artboards.range = parsedArtboards.range;
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

        writePersistedSettings(settings);
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
        if (elements.updateButton) {
            elements.updateButton.addEventListener("click", checkForUpdates);
        }
        elements.modalCancelButton.addEventListener("click", closeSettings);
        elements.modalDoneButton.addEventListener("click", saveSettings);
        elements.overwriteCheckbox.addEventListener("change", persistCurrentSettings);
        elements.artboardModeAll.addEventListener("change", function () {
            syncArtboardStateFromControls();
            persistCurrentSettings();
        });
        elements.artboardModeRange.addEventListener("change", function () {
            syncArtboardStateFromControls();
            persistCurrentSettings();
        });
        elements.artboardRangeInput.addEventListener("input", function () {
            setArtboardMode("range");
            syncArtboardStateFromControls();
            persistCurrentSettings();
        });
        elements.artboardCards.addEventListener("change", function (event) {
            var target = event.target;

            if (target && target.getAttribute && target.getAttribute("data-artboard")) {
                applyArtboardSelectionFromList();
                persistCurrentSettings();
            }
        });

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
                persistCurrentSettings();
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
    updateVersionBadge(APP_VERSION);
    updateArtboardControls();
    updateSummaries();
    updateFormatRows();
    updateExportButton();

    if (cs) {
        loadDefaults();
    } else {
        setStatus("Preview mode: Illustrator runtime is not available.", true);
    }
})();
