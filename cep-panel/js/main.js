(function () {
    "use strict";

    var cs = typeof CSInterface === "function" ? new CSInterface() : null;
    var busy = false;
    var updateBusy = false;
    var activeModalFormat = null;
    var activeUpdateUrl = "";
    var activeUpdateVersion = "";
    var activeUpdateRef = "";
    var activeUpdateArchiveUrl = "";
    var STORAGE_KEY = "aioExporter.settings.v1";
    var APP_VERSION = "1.5.0";
    var GITHUB_OWNER = "char8294";
    var GITHUB_REPO = "AIO_Exporter_Illustrator_Add-on";
    var GITHUB_REPO_URL = "https://github.com/char8294/AIO_Exporter_Illustrator_Add-on";
    var GITHUB_RELEASES_URL = "https://github.com/char8294/AIO_Exporter_Illustrator_Add-on/releases";
    var GITHUB_LATEST_RELEASE_API = "https://api.github.com/repos/char8294/AIO_Exporter_Illustrator_Add-on/releases/latest";
    var GITHUB_TAGS_API = "https://api.github.com/repos/char8294/AIO_Exporter_Illustrator_Add-on/tags";
    var GITHUB_RAW_REPO_BASE_URL = "https://raw.githubusercontent.com/char8294/AIO_Exporter_Illustrator_Add-on/";
    var GITHUB_RAW_MAIN_JS_URL = GITHUB_RAW_REPO_BASE_URL + "main/cep-panel/js/main.js";
    var GITHUB_CODELOAD_TAG_ZIP_URL = "https://codeload.github.com/" + GITHUB_OWNER + "/" + GITHUB_REPO + "/zip/refs/tags/";
    var UPDATE_FILE_PATHS = [
        "CSXS/manifest.xml",
        "css/styles.css",
        "index.html",
        "js/CSInterface.js",
        "js/main.js",
        "jsx/AIO_Exporter.jsx"
    ];

    var AI_COMPATIBILITY_OPTIONS = [
        ["ILLUSTRATOR19", "Illustrator 2020"],
        ["ILLUSTRATOR17", "Illustrator CC (Legacy)"],
        ["ILLUSTRATOR16", "Illustrator CS6"],
        ["ILLUSTRATOR15", "Illustrator CS5"],
        ["ILLUSTRATOR14", "Illustrator CS4"],
        ["ILLUSTRATOR13", "Illustrator CS3"],
        ["ILLUSTRATOR12", "Illustrator CS2"],
        ["ILLUSTRATOR11", "Illustrator CS"],
        ["ILLUSTRATOR10", "Illustrator 10"],
        ["ILLUSTRATOR9", "Illustrator 9"],
        ["ILLUSTRATOR8", "Illustrator 8"],
        ["JAPANESEVERSION3", "Japanese Illustrator 3"]
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
            embedPermittedFonts: true,
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
            fullDocument: false,
            useArtboardNames: false
        },
        artboards: {
            mode: "all",
            range: ""
        }
    };

    var documentInfo = {
        hasDocument: false,
        documentId: "",
        artboardCount: 1,
        activeArtboard: 1,
        artboardNames: [],
        pdfPresets: []
    };

    var elements = {
        folderInput: document.getElementById("folderInput"),
        baseNameInput: document.getElementById("baseNameInput"),
        browseButton: document.getElementById("browseButton"),
        refreshDocumentButton: document.getElementById("refreshDocumentButton"),
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

    function aiCompatibilityOptionsHtml() {
        var html = "";
        var i;

        for (i = 0; i < AI_COMPATIBILITY_OPTIONS.length; i += 1) {
            if (i === 1) {
                html += '<option value="" disabled>Legacy Formats</option>';
            }
            html += optionHtml(AI_COMPATIBILITY_OPTIONS[i][0], AI_COMPATIBILITY_OPTIONS[i][1], AI_COMPATIBILITY_OPTIONS[i][0] === state.ai.compatibility);
        }

        return html;
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

    function normalizeAiState() {
        if (!supportsEmbedPermittedFonts(state.ai.compatibility)) {
            state.ai.embedPermittedFonts = false;
        }
        state.ai.fontSubsetThreshold = state.ai.embedPermittedFonts ? 100 : 0;

        if (!supportsLegacyTransparency(state.ai.compatibility)) {
            state.ai.flattenOutput = "PRESERVEAPPEARANCE";
        }
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
        if (window.cep && window.cep.util && typeof window.cep.util.openURLInDefaultBrowser === "function") {
            window.cep.util.openURLInDefaultBrowser(url);
            return;
        }

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

    function fetchUrl(url, callback) {
        var request;
        var completed = false;

        function finish(error, text) {
            if (completed) {
                return;
            }

            completed = true;
            callback(error, text);
        }

        if (typeof XMLHttpRequest !== "function") {
            finish(new Error("This CEP runtime cannot check GitHub directly."));
            return;
        }

        request = new XMLHttpRequest();

        request.open("GET", url, true);
        request.timeout = 8000;
        request.onreadystatechange = function () {
            if (request.readyState !== 4) {
                return;
            }

            if (request.status < 200 || request.status >= 300) {
                finish(new Error("GitHub returned HTTP " + request.status + " for " + url + "."));
                return;
            }

            finish(null, request.responseText || "");
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

    function fetchJson(url, callback) {
        fetchUrl(url, function (error, text) {
            var data;

            if (error) {
                callback(error);
                return;
            }

            try {
                data = JSON.parse(text || "{}");
            } catch (parseError) {
                callback(parseError);
                return;
            }

            callback(null, data);
        });
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

    function releaseRef(release) {
        return trim(release && (release.tag_name || release.name));
    }

    function archiveUrlForRef(ref) {
        ref = trim(ref);
        return ref ? GITHUB_CODELOAD_TAG_ZIP_URL + encodeURIComponent(ref) : "";
    }

    function releaseArchiveUrl(release, ref) {
        return archiveUrlForRef(ref || releaseRef(release));
    }

    function rawPanelBaseUrl(ref) {
        return GITHUB_RAW_REPO_BASE_URL + encodeURIComponent(ref || "main") + "/cep-panel/";
    }

    function fetchRawMainVersion(callback) {
        fetchUrl(GITHUB_RAW_MAIN_JS_URL, function (error, text) {
            var match;

            if (error) {
                callback(error);
                return;
            }

            match = String(text || "").match(/APP_VERSION\s*=\s*["']([^"']+)["']/);
            if (!match) {
                callback(new Error("Could not read source version."));
                return;
            }

            callback(null, normalizeVersion(match[1]));
        });
    }

    function getCepFileSystem() {
        return window.cep && window.cep.fs ? window.cep.fs : null;
    }

    function normalizeCepSystemPath(value) {
        var path = String(value || "");

        try {
            path = decodeURI(path);
        } catch (ignored) {}

        path = path.replace(/\\/g, "/");
        path = path.replace(/^file:\/\//i, "");
        path = path.replace(/^localhost\//i, "");
        path = path.replace(/^\/([A-Za-z]:\/)/, "$1");
        path = path.replace(/^file:\//i, "");

        return path;
    }

    function extensionFilePath(extensionRoot, relativePath) {
        return normalizeCepSystemPath(extensionRoot).replace(/[\\\/]+$/, "") + "/" + relativePath;
    }

    function describeUpdateError(error) {
        var message = error && error.message ? error.message : String(error || "Unknown error");

        return message.replace(/\s+/g, " ").slice(0, 220);
    }

    function writeUpdateFile(extensionRoot, relativePath, contents) {
        var fs = getCepFileSystem();
        var hasEncoding = window.cep && window.cep.encoding && typeof window.cep.encoding.UTF8 !== "undefined";
        var encoding = hasEncoding ? window.cep.encoding.UTF8 : null;
        var targetPath = extensionFilePath(extensionRoot, relativePath);
        var result;

        if (!fs || typeof fs.writeFile !== "function") {
            return new Error("CEP file writer is not available.");
        }

        try {
            result = hasEncoding ?
                fs.writeFile(targetPath, contents, encoding) :
                fs.writeFile(targetPath, contents);
        } catch (error) {
            return error;
        }

        if (result && result.err && result.err !== 0) {
            return new Error("Could not write " + relativePath + " (CEP error " + result.err + ", path: " + targetPath + ").");
        }

        return null;
    }

    function readUpdateFile(extensionRoot, relativePath) {
        var fs = getCepFileSystem();
        var hasEncoding = window.cep && window.cep.encoding && typeof window.cep.encoding.UTF8 !== "undefined";
        var encoding = hasEncoding ? window.cep.encoding.UTF8 : null;
        var targetPath = extensionFilePath(extensionRoot, relativePath);
        var result;

        if (!fs || typeof fs.readFile !== "function") {
            return {
                error: new Error("CEP file reader is not available.")
            };
        }

        try {
            result = hasEncoding ?
                fs.readFile(targetPath, encoding) :
                fs.readFile(targetPath);
        } catch (error) {
            return {
                error: error
            };
        }

        if (result && result.err && result.err !== 0) {
            return {
                error: new Error("Could not back up " + relativePath + " (CEP error " + result.err + ", path: " + targetPath + ").")
            };
        }

        return {
            text: result && typeof result.data !== "undefined" ? result.data : String(result || "")
        };
    }

    function backupUpdateFiles(extensionRoot, files) {
        var backups = [];
        var readResult;
        var i;

        for (i = 0; i < files.length; i += 1) {
            readResult = readUpdateFile(extensionRoot, files[i].path);
            if (readResult.error) {
                return {
                    error: readResult.error,
                    backups: backups
                };
            }
            backups.push({
                path: files[i].path,
                text: readResult.text
            });
        }

        return {
            backups: backups
        };
    }

    function restoreUpdateFiles(extensionRoot, backups) {
        var error;
        var i;

        for (i = 0; i < backups.length; i += 1) {
            error = writeUpdateFile(extensionRoot, backups[i].path, backups[i].text);
            if (error) {
                return error;
            }
        }

        return null;
    }

    function updateFileText(files, relativePath) {
        var i;

        for (i = 0; i < files.length; i += 1) {
            if (files[i].path === relativePath) {
                return files[i].text;
            }
        }

        return "";
    }

    function validateUpdateFiles(files, latestVersion) {
        var mainJs = updateFileText(files, "js/main.js");
        var match = String(mainJs || "").match(/APP_VERSION\s*=\s*["']([^"']+)["']/);
        var downloadedVersion;

        if (!match) {
            return new Error("Downloaded update does not include a readable app version.");
        }

        downloadedVersion = normalizeVersion(match[1]);
        if (latestVersion && compareVersions(downloadedVersion, latestVersion) !== 0) {
            return new Error("Downloaded update version v" + downloadedVersion + " does not match v" + latestVersion + ".");
        }

        return null;
    }

    function getNodeRequire() {
        var nodeRequire = null;

        try {
            if (typeof require === "function") {
                nodeRequire = require;
            }
        } catch (ignoredRequire) {}

        try {
            if (!nodeRequire && window.cep_node && typeof window.cep_node.require === "function") {
                nodeRequire = window.cep_node.require;
            }
        } catch (ignoredCepNode) {}

        return nodeRequire;
    }

    function getNodeUpdateModules() {
        var nodeRequire = getNodeRequire();

        if (!nodeRequire) {
            return {
                error: new Error("Zip updater needs Node.js support. Install this version once with Install-CEP-Panel.ps1.")
            };
        }

        try {
            return {
                fs: nodeRequire("fs"),
                path: nodeRequire("path"),
                os: nodeRequire("os"),
                http: nodeRequire("http"),
                https: nodeRequire("https"),
                url: nodeRequire("url"),
                childProcess: nodeRequire("child_process")
            };
        } catch (error) {
            return {
                error: error
            };
        }
    }

    function nodeEnsureDirectory(dirPath, modules) {
        var parent;

        if (!dirPath || modules.fs.existsSync(dirPath)) {
            return;
        }

        parent = modules.path.dirname(dirPath);
        if (parent && parent !== dirPath) {
            nodeEnsureDirectory(parent, modules);
        }
        modules.fs.mkdirSync(dirPath);
    }

    function nodeRemoveDirectory(dirPath, modules) {
        var entries;
        var i;
        var entryPath;
        var stat;

        if (!dirPath || !modules.fs.existsSync(dirPath)) {
            return;
        }

        entries = modules.fs.readdirSync(dirPath);
        for (i = 0; i < entries.length; i += 1) {
            entryPath = modules.path.join(dirPath, entries[i]);
            stat = modules.fs.lstatSync(entryPath);
            if (stat.isDirectory() && !stat.isSymbolicLink()) {
                nodeRemoveDirectory(entryPath, modules);
            } else {
                modules.fs.unlinkSync(entryPath);
            }
        }
        modules.fs.rmdirSync(dirPath);
    }

    function nodeCopyDirectory(sourceDir, targetDir, modules) {
        var entries = modules.fs.readdirSync(sourceDir);
        var i;
        var sourcePath;
        var targetPath;
        var stat;

        nodeEnsureDirectory(targetDir, modules);
        for (i = 0; i < entries.length; i += 1) {
            sourcePath = modules.path.join(sourceDir, entries[i]);
            targetPath = modules.path.join(targetDir, entries[i]);
            stat = modules.fs.lstatSync(sourcePath);

            if (stat.isDirectory() && !stat.isSymbolicLink()) {
                nodeCopyDirectory(sourcePath, targetPath, modules);
            } else {
                modules.fs.copyFileSync(sourcePath, targetPath);
            }
        }
    }

    function nodeIsPanelDirectory(dirPath, modules) {
        return !!(
            dirPath &&
            modules.fs.existsSync(modules.path.join(dirPath, "index.html")) &&
            modules.fs.existsSync(modules.path.join(dirPath, "js", "main.js")) &&
            modules.fs.existsSync(modules.path.join(dirPath, "jsx", "AIO_Exporter.jsx")) &&
            modules.fs.existsSync(modules.path.join(dirPath, "CSXS", "manifest.xml"))
        );
    }

    function nodeFindCepPanelDirectory(rootDir, modules) {
        var entries;
        var i;
        var entryPath;
        var cepPanelPath;

        if (nodeIsPanelDirectory(rootDir, modules)) {
            return rootDir;
        }

        cepPanelPath = modules.path.join(rootDir, "cep-panel");
        if (nodeIsPanelDirectory(cepPanelPath, modules)) {
            return cepPanelPath;
        }

        entries = modules.fs.readdirSync(rootDir);
        for (i = 0; i < entries.length; i += 1) {
            entryPath = modules.path.join(rootDir, entries[i]);
            if (!modules.fs.lstatSync(entryPath).isDirectory()) {
                continue;
            }
            if (nodeIsPanelDirectory(entryPath, modules)) {
                return entryPath;
            }
            cepPanelPath = modules.path.join(entryPath, "cep-panel");
            if (nodeIsPanelDirectory(cepPanelPath, modules)) {
                return cepPanelPath;
            }
        }

        return "";
    }

    function validateNodePanelDirectory(panelDir, latestVersion, modules) {
        var mainJsPath = modules.path.join(panelDir, "js", "main.js");
        var mainJs;
        var match;
        var downloadedVersion;

        if (!nodeIsPanelDirectory(panelDir, modules)) {
            return new Error("Downloaded archive does not include a valid cep-panel folder.");
        }

        mainJs = modules.fs.readFileSync(mainJsPath, "utf8");
        match = String(mainJs || "").match(/APP_VERSION\s*=\s*["']([^"']+)["']/);
        if (!match) {
            return new Error("Downloaded update does not include a readable app version.");
        }

        downloadedVersion = normalizeVersion(match[1]);
        if (latestVersion && compareVersions(downloadedVersion, latestVersion) !== 0) {
            return new Error("Downloaded update version v" + downloadedVersion + " does not match v" + latestVersion + ".");
        }

        return null;
    }

    function nodeDownloadFile(url, targetPath, modules, redirectCount, callback) {
        var parsed;
        var transport;
        var request;
        var completed = false;

        function finish(error) {
            if (completed) {
                return;
            }
            completed = true;
            callback(error);
        }

        if (!url) {
            finish(new Error("Update archive URL is missing."));
            return;
        }
        if (redirectCount > 5) {
            finish(new Error("GitHub archive download redirected too many times."));
            return;
        }

        parsed = modules.url.parse(url);
        transport = parsed.protocol === "http:" ? modules.http : modules.https;
        request = transport.get({
            protocol: parsed.protocol,
            hostname: parsed.hostname,
            port: parsed.port,
            path: parsed.path,
            headers: {
                "User-Agent": "AIO-Exporter-Updater/" + APP_VERSION,
                "Accept": "*/*"
            }
        }, function (response) {
            var output;
            var redirectUrl;

            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                redirectUrl = modules.url.resolve(url, response.headers.location);
                response.resume();
                nodeDownloadFile(redirectUrl, targetPath, modules, redirectCount + 1, callback);
                completed = true;
                return;
            }

            if (response.statusCode < 200 || response.statusCode >= 300) {
                response.resume();
                finish(new Error("GitHub archive download returned HTTP " + response.statusCode + "."));
                return;
            }

            output = modules.fs.createWriteStream(targetPath);
            output.on("error", function (error) {
                try {
                    if (modules.fs.existsSync(targetPath)) {
                        modules.fs.unlinkSync(targetPath);
                    }
                } catch (ignoredUnlink) {}
                finish(error);
            });
            output.on("finish", function () {
                output.close(function () {
                    finish(null);
                });
            });
            response.on("error", finish);
            response.pipe(output);
        });

        request.setTimeout(45000, function () {
            request.abort();
            finish(new Error("GitHub archive download timed out."));
        });
        request.on("error", finish);
    }

    function powershellQuote(value) {
        return "'" + String(value || "").replace(/'/g, "''") + "'";
    }

    function nodeExpandZip(zipPath, destinationPath, modules, callback) {
        var command;

        if (!zipPath || !destinationPath) {
            callback(new Error("Update archive path is missing."));
            return;
        }

        command = "$ErrorActionPreference = 'Stop'; Expand-Archive -LiteralPath " +
            powershellQuote(zipPath) +
            " -DestinationPath " +
            powershellQuote(destinationPath) +
            " -Force";

        modules.childProcess.execFile(
            "powershell.exe",
            ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
            {
                windowsHide: true
            },
            function (error, stdout, stderr) {
                if (error) {
                    callback(new Error("Could not extract update archive: " + describeUpdateError(stderr || error)));
                    return;
                }
                callback(null);
            }
        );
    }

    function installZipUpdate(extensionRoot, latestVersion, updateRef, archiveUrl, callback) {
        var modules = getNodeUpdateModules();
        var tempRoot;
        var zipPath;
        var extractRoot;
        var backupRoot;

        if (modules.error) {
            callback(modules.error);
            return;
        }

        try {
            tempRoot = modules.fs.mkdtempSync(modules.path.join(modules.os.tmpdir(), "aio-exporter-update-"));
            zipPath = modules.path.join(tempRoot, "update.zip");
            extractRoot = modules.path.join(tempRoot, "extract");
            backupRoot = modules.path.join(tempRoot, "backup");
            nodeEnsureDirectory(extractRoot, modules);
        } catch (error) {
            callback(error);
            return;
        }

        setStatus("Downloading update archive...", false);
        nodeDownloadFile(archiveUrl || archiveUrlForRef(updateRef), zipPath, modules, 0, function (downloadError) {
            if (downloadError) {
                try {
                    nodeRemoveDirectory(tempRoot, modules);
                } catch (ignoredDownloadCleanup) {}
                callback(downloadError);
                return;
            }

            setStatus("Extracting update archive...", false);
            nodeExpandZip(zipPath, extractRoot, modules, function (extractError) {
                var panelDir;
                var validationError;

                if (extractError) {
                    try {
                        nodeRemoveDirectory(tempRoot, modules);
                    } catch (ignoredExtractCleanup) {}
                    callback(extractError);
                    return;
                }

                try {
                    panelDir = nodeFindCepPanelDirectory(extractRoot, modules);
                    validationError = validateNodePanelDirectory(panelDir, latestVersion, modules);
                    if (validationError) {
                        throw validationError;
                    }

                    setStatus("Backing up current panel...", false);
                    nodeCopyDirectory(extensionRoot, backupRoot, modules);

                    setStatus("Installing update files...", false);
                    nodeCopyDirectory(panelDir, extensionRoot, modules);

                    try {
                        nodeRemoveDirectory(tempRoot, modules);
                    } catch (ignoredSuccessCleanup) {}
                    callback(null);
                } catch (installError) {
                    try {
                        if (backupRoot && modules.fs.existsSync(backupRoot)) {
                            nodeCopyDirectory(backupRoot, extensionRoot, modules);
                        }
                    } catch (rollbackError) {
                        installError = new Error(describeUpdateError(installError) + " Rollback also failed: " + describeUpdateError(rollbackError));
                    }
                    try {
                        nodeRemoveDirectory(tempRoot, modules);
                    } catch (ignoredInstallCleanup) {}
                    callback(installError);
                }
            });
        });
    }

    function fetchUpdateFiles(updateRef, index, files, callback) {
        var relativePath;

        if (index >= UPDATE_FILE_PATHS.length) {
            callback(null, files);
            return;
        }

        relativePath = UPDATE_FILE_PATHS[index];
        setStatus("Downloading update file " + (index + 1) + "/" + UPDATE_FILE_PATHS.length + "...", false);

        fetchUrl(rawPanelBaseUrl(updateRef) + relativePath, function (error, text) {
            if (error) {
                callback(error);
                return;
            }

            files.push({
                path: relativePath,
                text: text
            });
            fetchUpdateFiles(updateRef, index + 1, files, callback);
        });
    }

    function writeUpdateFiles(extensionRoot, files) {
        var error;
        var i;

        for (i = 0; i < files.length; i += 1) {
            error = writeUpdateFile(extensionRoot, files[i].path, files[i].text);
            if (error) {
                return error;
            }
        }

        return null;
    }

    function writeUpdateFilesWithRollback(extensionRoot, files) {
        var backupResult = backupUpdateFiles(extensionRoot, files);
        var writeError;
        var restoreError;

        if (backupResult.error) {
            return backupResult.error;
        }

        writeError = writeUpdateFiles(extensionRoot, files);
        if (!writeError) {
            return null;
        }

        restoreError = restoreUpdateFiles(extensionRoot, backupResult.backups);
        if (restoreError) {
            return new Error(describeUpdateError(writeError) + " Rollback also failed: " + describeUpdateError(restoreError));
        }

        return writeError;
    }

    function installUpdateFromGitHub(updateUrl, latestVersion, updateRef, archiveUrl) {
        var extensionRoot = normalizeCepSystemPath(getExtensionRoot());

        if (!updateRef) {
            showUpdateCheckFallback("Automatic update needs a published GitHub release or tag. Open GitHub update page?", updateUrl || GITHUB_RELEASES_URL, true, "Update failed");
            return;
        }

        if (!extensionRoot) {
            showUpdateCheckFallback("Automatic update is unavailable in this CEP runtime. Open GitHub update page?", updateUrl || GITHUB_RELEASES_URL, true, "Update failed");
            return;
        }

        setUpdateBusy(true);
        installZipUpdate(extensionRoot, latestVersion, updateRef, archiveUrl, function (installError) {
            setUpdateBusy(false);

            if (installError) {
                showUpdateCheckFallback("Update install failed: " + describeUpdateError(installError) + ". Open GitHub update page?", updateUrl || GITHUB_RELEASES_URL, true, "Update failed");
                return;
            }

            APP_VERSION = normalizeVersion(latestVersion) || APP_VERSION;
            updateVersionBadge(APP_VERSION);
            setStatus("Update installed. Restart Illustrator to load v" + APP_VERSION + ".", false);
        });
    }

    function openUpdateLinkModal(title, messageHtml, primaryLabel, url) {
        activeModalFormat = "update";
        activeUpdateUrl = url || GITHUB_RELEASES_URL;
        activeUpdateVersion = "";
        activeUpdateRef = "";
        activeUpdateArchiveUrl = "";
        elements.modalTitle.textContent = title || "Update";
        elements.modalBody.innerHTML =
            '<div class="info-line">' +
            '<span class="info-icon" aria-hidden="true">i</span>' +
            '<span>' + messageHtml + "</span>" +
            "</div>";
        elements.modalDoneButton.textContent = primaryLabel || "Update";
        elements.settingsModal.className = "modal";
    }

    function openUpdateAvailableModal(latestVersion, releaseUrl, updateRef, archiveUrl) {
        openUpdateLinkModal(
            "Update available",
            "AIO Exporter v" + escapeHtml(latestVersion) + " is available.<br>" +
                "Installed version: v" + escapeHtml(APP_VERSION) + "<br>" +
                "Click Update to download the GitHub archive and install, then restart Illustrator.",
            "Update",
            releaseUrl
        );
        activeUpdateVersion = normalizeVersion(latestVersion);
        activeUpdateRef = trim(updateRef);
        activeUpdateArchiveUrl = trim(archiveUrl);
    }

    function showUpdateCheckFallback(message, url, isError, title) {
        var fallbackMessage = message || "GitHub update check is unavailable. Open GitHub releases?";

        setStatus(fallbackMessage, !!isError);
        openUpdateLinkModal(title || "GitHub update check", escapeHtml(fallbackMessage), "Open GitHub", url || GITHUB_RELEASES_URL);
    }

    function finishUpdateCheck(latestVersion, releaseUrl, updateRef, archiveUrl) {
        releaseUrl = releaseUrl || GITHUB_RELEASES_URL;
        archiveUrl = trim(archiveUrl) || archiveUrlForRef(updateRef);

        if (!latestVersion) {
            showUpdateCheckFallback("No published update version found. Open GitHub releases?", GITHUB_RELEASES_URL);
            return;
        }

        if (compareVersions(latestVersion, APP_VERSION) > 0) {
            setStatus("Update available: v" + latestVersion, false);
            openUpdateAvailableModal(latestVersion, releaseUrl, updateRef, archiveUrl);
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
            var updateRef;
            var archiveUrl;

            if (!error) {
                latestVersion = releaseVersion(release);
                releaseUrl = release.html_url || GITHUB_RELEASES_URL;
                updateRef = releaseRef(release);
                archiveUrl = releaseArchiveUrl(release, updateRef);
                setUpdateBusy(false);
                finishUpdateCheck(latestVersion, releaseUrl, updateRef, archiveUrl);
                return;
            }

            fetchLatestTag(function (tagError, tag) {
                if (!tagError) {
                    setUpdateBusy(false);
                    finishUpdateCheck(releaseVersion(tag), GITHUB_RELEASES_URL, releaseRef(tag), archiveUrlForRef(releaseRef(tag)));
                    return;
                }

                fetchRawMainVersion(function (sourceError, sourceVersion) {
                    setUpdateBusy(false);

                    if (sourceError) {
                        showUpdateCheckFallback("GitHub update check is unavailable. Open repository?", GITHUB_REPO_URL);
                        return;
                    }

                    if (compareVersions(sourceVersion, APP_VERSION) > 0) {
                        showUpdateCheckFallback("A newer source version exists, but no release or tag is available for automatic install. Open repository?", GITHUB_REPO_URL);
                        return;
                    }

                    setStatus("AIO Exporter v" + APP_VERSION + " is up to date.", false);
                });
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
        if (elements.refreshDocumentButton) {
            elements.refreshDocumentButton.disabled = busy || !cs;
        }
    }

    function updateExportButton() {
        elements.exportButton.disabled = busy || !hasSelectedFormat() || !cs || !documentInfo.hasDocument;
        if (elements.refreshDocumentButton) {
            elements.refreshDocumentButton.disabled = busy || !cs;
        }
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
        var pngSummary = [];

        aiSummary.push(optionLabel(AI_COMPATIBILITY_OPTIONS, state.ai.compatibility, state.ai.compatibility));

        if (state.ai.pdfCompatible) {
            aiSummary.push("PDF compatible");
        }
        if (state.ai.embedLinkedFiles) {
            aiSummary.push("Linked files");
        }
        if (state.ai.embedPermittedFonts) {
            aiSummary.push("Preview fonts");
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
        pngSummary.push(state.png.scale + "%");
        pngSummary.push(state.png.transparency ? "Transparent" : "Opaque");
        pngSummary.push(state.png.fullDocument ? "Full document" : "Artboard");
        if (!state.png.fullDocument && state.png.includeBleed) {
            pngSummary.push("Bleed");
        }
        if (!state.png.fullDocument && state.png.useArtboardNames) {
            pngSummary.push("Artboard names");
        }

        elements.summaryPng.textContent = pngSummary.join(", ");
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
        var previousDocumentId = documentInfo.documentId || "";
        var nextDocumentId = trim(defaults.documentId || "");
        var documentChanged = nextDocumentId !== previousDocumentId && !!(nextDocumentId || previousDocumentId);

        documentInfo.hasDocument = defaults.hasDocument !== false;
        documentInfo.documentId = nextDocumentId;
        documentInfo.artboardCount = defaults.artboardCount || 1;
        documentInfo.activeArtboard = defaults.activeArtboard || 1;
        documentInfo.artboardNames = defaults.artboardNames || [];
        documentInfo.pdfPresets = defaults.pdfPresets || [];
        updateVersionBadge(defaults.version || APP_VERSION);

        if (documentChanged) {
            state.artboards = {
                mode: "all",
                range: ""
            };
        }

        if (!state.pdf.preset && documentInfo.pdfPresets.length) {
            state.pdf.preset = documentInfo.pdfPresets[0];
        } else {
            state.pdf.preset = pdfPresetValue(state.pdf.preset);
        }
        state.artboards = normalizePersistedArtboards(state.artboards);

        return documentChanged;
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

    function refreshRuntimeDefaults(callback, forceFields) {
        if (!cs) {
            callback(false);
            return;
        }

        evalExporter("AIOExporter.getDefaultsJson();", function (result) {
            var defaults;
            var documentChanged;

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

            documentChanged = updateDocumentInfo(defaults);
            if (documentChanged || forceFields) {
                if (defaults.folder) {
                    elements.folderInput.value = defaults.folder;
                }
                if (defaults.baseName) {
                    elements.baseNameInput.value = defaults.baseName;
                }
            }
            updateArtboardControls();
            updateSummaries();
            updateFormatRows();
            updateExportButton();
            callback(true, documentChanged);
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

    function controlHtml(id, label, checked, disabled) {
        return (
            '<label class="check-line">' +
            '<input id="' + id + '" type="checkbox"' + (checked ? " checked" : "") + (disabled ? " disabled" : "") + ">" +
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
        var embedPermittedFontsDisabled = !supportsEmbedPermittedFonts(state.ai.compatibility);
        var legacyTransparencyDisabled = !supportsLegacyTransparency(state.ai.compatibility);

        normalizeAiState();

        elements.modalTitle.textContent = "Settings";
        elements.modalDoneButton.textContent = "Done";
        activeUpdateUrl = "";
        activeUpdateVersion = "";
        activeUpdateRef = "";
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
                '<select id="modalAiCompatibility" class="select-field">' + aiCompatibilityOptionsHtml() + "</select>" +
                "</label>" +
                controlHtml("modalAiEmbedPermittedFonts", "Embed permitted fonts for file preview <span class=\"info-icon\" aria-hidden=\"true\">i</span>", state.ai.embedPermittedFonts, embedPermittedFontsDisabled) +
                controlHtml("modalAiPdfCompatible", "Create PDF Compatible File", state.ai.pdfCompatible) +
                controlHtml("modalAiEmbedLinkedFiles", "Include Linked Files", state.ai.embedLinkedFiles) +
                controlHtml("modalAiEmbedICCProfile", "Embed ICC Profiles", state.ai.embedICCProfile) +
                controlHtml("modalAiCompressed", "Use Compression", state.ai.compressed) +
                '<label class="modal-field wide-modal-field" for="modalAiFlattenOutput">' +
                "<span>Legacy transparency</span>" +
                '<select id="modalAiFlattenOutput" class="select-field"' + (legacyTransparencyDisabled ? " disabled" : "") + ">" + optionsHtml(FLATTEN_OUTPUT_OPTIONS, state.ai.flattenOutput) + "</select>" +
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
                '<label class="modal-field number-modal-field" for="modalPngScale">' +
                "<span>Scale</span>" +
                '<input id="modalPngScale" class="text-field" type="number" min="1" max="1000" value="' + state.png.scale + '">' +
                "<span>%</span>" +
                "</label>" +
                controlHtml("modalPngTransparency", "Transparent background", state.png.transparency) +
                controlHtml("modalPngIncludeBleed", "Include Bleed", state.png.includeBleed) +
                controlHtml("modalPngFullDocument", "Full Document", state.png.fullDocument) +
                controlHtml("modalPngUseArtboardNames", "Use artboard names as file names", state.png.useArtboardNames, state.png.fullDocument) +
                controlHtml("modalPngAntiAliasing", "Anti-aliasing", state.png.antiAliasing)
            );

        bindModalTabs();
        bindAiSettingsControls();
        bindPngSettingsControls();
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

    function bindAiSettingsControls() {
        var compatibilityField = document.getElementById("modalAiCompatibility");
        var pdfCompatibleField = document.getElementById("modalAiPdfCompatible");
        var embedPermittedFontsField = document.getElementById("modalAiEmbedPermittedFonts");
        var flattenOutputField = document.getElementById("modalAiFlattenOutput");

        function updateAiOptionAvailability() {
            var compatibility = compatibilityField ? compatibilityField.value : state.ai.compatibility;
            var pdfCompatible = pdfCompatibleField ? pdfCompatibleField.checked : state.ai.pdfCompatible;
            var embedDisabled = !supportsEmbedPermittedFonts(compatibility);
            var flattenDisabled = !supportsLegacyTransparency(compatibility);

            if (embedPermittedFontsField) {
                embedPermittedFontsField.disabled = embedDisabled;
                if (embedDisabled) {
                    embedPermittedFontsField.checked = false;
                }
            }
            if (flattenOutputField) {
                flattenOutputField.disabled = flattenDisabled;
                if (flattenDisabled) {
                    flattenOutputField.value = "PRESERVEAPPEARANCE";
                }
            }
        }

        if (compatibilityField) {
            compatibilityField.addEventListener("change", updateAiOptionAvailability);
        }
        if (pdfCompatibleField) {
            pdfCompatibleField.addEventListener("change", updateAiOptionAvailability);
        }
        updateAiOptionAvailability();
    }

    function bindPngSettingsControls() {
        var fullDocumentField = document.getElementById("modalPngFullDocument");
        var useArtboardNamesField = document.getElementById("modalPngUseArtboardNames");

        function updatePngOptionAvailability() {
            if (useArtboardNamesField) {
                useArtboardNamesField.disabled = fullDocumentField && fullDocumentField.checked;
            }
        }

        if (fullDocumentField) {
            fullDocumentField.addEventListener("change", updatePngOptionAvailability);
        }
        updatePngOptionAvailability();
    }

    function openSettings(format) {
        if (cs) {
            setStatus("Refreshing active document...", false);
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
        activeUpdateUrl = "";
        activeUpdateVersion = "";
        activeUpdateRef = "";
        activeUpdateArchiveUrl = "";
        elements.settingsModal.className = "modal is-hidden";
    }

    function confirmUpdateLink() {
        var url = activeUpdateUrl || GITHUB_RELEASES_URL;
        var latestVersion = activeUpdateVersion;
        var updateRef = activeUpdateRef;
        var archiveUrl = activeUpdateArchiveUrl;

        closeSettings();
        if (!latestVersion) {
            setStatus("Opening GitHub update page...", false);
            openExternalUrl(url);
            return;
        }

        installUpdateFromGitHub(url, latestVersion, updateRef, archiveUrl);
    }

    function handleModalDone() {
        if (activeModalFormat === "update") {
            confirmUpdateLink();
            return;
        }

        saveSettings();
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
                '<label class="' + classes + '" title="' + i + ". " + escapeHtml(label) + '">' +
                '<input class="artboard-checkbox" type="checkbox" data-artboard="' + i + '"' + (selected[i] ? " checked" : "") + ">" +
                '<span class="artboard-index">' + i + "</span>" +
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
        state.ai.embedPermittedFonts = boolValue(savedAi.embedPermittedFonts, numberInRange(savedAi.fontSubsetThreshold, state.ai.fontSubsetThreshold, 0, 100) > 0);
        state.ai.fontSubsetThreshold = numberInRange(savedAi.fontSubsetThreshold, state.ai.fontSubsetThreshold, 0, 100);
        state.ai.flattenOutput = optionValue(FLATTEN_OUTPUT_OPTIONS, savedAi.flattenOutput, state.ai.flattenOutput);
        normalizeAiState();

        savedPdf = saved.pdf || {};
        state.pdf.preset = pdfPresetValue(savedPdf.preset);
        state.pdf.outputMode = savedPdf.outputMode === "multiple" ? "multiple" : "single";

        savedPng = saved.png || {};
        state.png.scale = numberInRange(savedPng.scale, state.png.scale, 1, 1000);
        state.png.transparency = boolValue(savedPng.transparency, state.png.transparency);
        state.png.includeBleed = boolValue(savedPng.includeBleed, state.png.includeBleed);
        state.png.fullDocument = boolValue(savedPng.fullDocument, state.png.fullDocument);
        state.png.useArtboardNames = !state.png.fullDocument && boolValue(savedPng.useArtboardNames, state.png.useArtboardNames);
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
        state.ai.embedPermittedFonts = checked("modalAiEmbedPermittedFonts");
        state.ai.fontSubsetThreshold = state.ai.embedPermittedFonts ? 100 : 0;
        state.ai.flattenOutput = fieldValue("modalAiFlattenOutput", state.ai.flattenOutput);
        normalizeAiState();
        state.pdf.preset = fieldValue("modalPdfPreset", "");
        state.pdf.outputMode = selectedInputValue("modalPdfOutputMode", state.pdf.outputMode);
        state.png.scale = readScale();
        state.png.transparency = checked("modalPngTransparency");
        state.png.includeBleed = checked("modalPngIncludeBleed");
        state.png.fullDocument = checked("modalPngFullDocument");
        state.png.useArtboardNames = !state.png.fullDocument && checked("modalPngUseArtboardNames");
        state.png.artBoardClipping = !state.png.fullDocument;
        state.png.antiAliasing = checked("modalPngAntiAliasing");

        updateSummaries();
        persistCurrentSettings();
        closeSettings();
    }

    function copySettings() {
        syncArtboardStateFromControls();
        normalizeAiState();

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
                embedPermittedFonts: state.ai.embedPermittedFonts,
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
                fullDocument: state.png.fullDocument,
                useArtboardNames: state.png.useArtboardNames
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

    function runExporterWithCurrentSettings() {
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

    function runExporter() {
        if (!cs) {
            runExporterWithCurrentSettings();
            return;
        }

        setBusy(true);
        setStatus("Refreshing active document...", false);
        refreshRuntimeDefaults(function () {
            setBusy(false);
            if (!documentInfo.hasDocument) {
                setStatus("Open an Illustrator document before exporting.", true);
                updateExportButton();
                return;
            }
            runExporterWithCurrentSettings();
        });
    }

    function refreshActiveDocumentIfNeeded() {
        if (!cs || busy || updateBusy || activeModalFormat) {
            return;
        }

        refreshRuntimeDefaults(function (success, documentChanged) {
            if (success && documentChanged) {
                setStatus("Active document refreshed.", false);
            }
        });
    }

    function refreshActiveDocumentFromButton() {
        if (!cs || busy || updateBusy) {
            return;
        }

        setBusy(true);
        setStatus("Refreshing active document...", false);
        refreshRuntimeDefaults(function (success) {
            setBusy(false);
            if (!success) {
                setStatus("Could not refresh active document.", true);
                return;
            }

            setStatus("Active document refreshed.", false);
        }, true);
    }

    function bindEvents() {
        var settingsButtons = document.querySelectorAll(".settings-button");
        var closeButtons = document.querySelectorAll("[data-close-modal]");
        var formatInputs = [elements.formatAi, elements.formatPdf, elements.formatPng];
        var i;

        elements.browseButton.addEventListener("click", browseFolder);
        if (elements.refreshDocumentButton) {
            elements.refreshDocumentButton.addEventListener("click", refreshActiveDocumentFromButton);
        }
        elements.exportButton.addEventListener("click", runExporter);
        if (elements.updateButton) {
            elements.updateButton.addEventListener("click", checkForUpdates);
        }
        if (elements.versionBadge) {
            elements.versionBadge.addEventListener("click", function () {
                openExternalUrl(GITHUB_REPO_URL);
            });
        }
        elements.modalDoneButton.addEventListener("click", handleModalDone);
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

        window.addEventListener("focus", refreshActiveDocumentIfNeeded);
        document.addEventListener("visibilitychange", function () {
            if (!document.hidden) {
                refreshActiveDocumentIfNeeded();
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
