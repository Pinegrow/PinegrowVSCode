function PinegrowVS() {
    const vscode = require('vscode');
    const configurations = vscode.workspace.getConfiguration("pinegrow");

    const CHANGE_DELAY = 500;
    const SAVE_DELAY = 500;
    const SAVE_INTERVAL = 100;

    var io = require('socket.io-client');
    var pinegrow_url = configurations.urlWithPort;

    var pg = false;
    var editor_api = null;
    var currentSourceNodes = {};
    var editorObj = {};

    var mapPinegrowPrefix = null;
    var mapMyPrefix = null;

    var fileNotUpdated = {};

    var codeChangedInEditorTimeout = null;
    var codeSavedInEditorInterval = null;

    this.filesOpenInPinegrow = [];

    function getEditorUrl(document) {
        var file = document.fileName;
        if (!file) return null;
        var f = 'file://';
        if (file.match(/^[a-z]\:/i)) {
            file = '/' + file
        } else if (file.startsWith('\\\\')) {
            file = file.substr(2);
        }
        var r = f + encodeURI(file.replace(/\\/g, "/"));
        return r;
    }

    function getPgUrlFromEditorUrl(url) {
        if (!url || mapPinegrowPrefix === null) return url;
        return url.replace(mapMyPrefix, mapPinegrowPrefix);
    }

    function getPgEditorUrl(document) {
        return getPgUrlFromEditorUrl(getEditorUrl(document));
    }

    function autoDetectMapping(pg_urls, editor_urls) {

        var getNumberOfSameTokens = function (a, b) {
            var c = 0;
            var ai = a.length - 1;
            var bi = b.length - 1;
            while (ai >= 0 && bi >= 0) {
                if (a[ai] == b[bi]) {
                    c++;
                    ai--;
                    bi--;
                } else {
                    break;
                }
            }
            return c;
        }

        for (var i = 0; i < pg_urls.length; i++) {
            pg_urls[i] = pg_urls[i].replace('file://', '').split('/');
        }

        mapPinegrowPrefix = null;
        mapMyPrefix = null;

        var mostSimilarCount = 0;
        var mostSimilarPgUrl = null;
        var mostSimilarEditorUrl = null;

        for (var i = 0; i < editor_urls.length; i++) {
            editor_urls[i] = editor_urls[i].replace('file://', '').split('/');

            for (var j = 0; j < pg_urls.length; j++) {
                var c = getNumberOfSameTokens(pg_urls[j], editor_urls[i]);
                if (c > mostSimilarCount) {
                    mostSimilarCount = c;
                    mostSimilarPgUrl = pg_urls[j];
                    mostSimilarEditorUrl = editor_urls[i];
                }
            }
        }

        if (mostSimilarCount == 0) return false; //failed to auto detect mapPinegrowPrefix

        if (mostSimilarCount == mostSimilarPgUrl.length) return true;

        mostSimilarPgUrl.splice(mostSimilarPgUrl.length - mostSimilarCount, mostSimilarCount);
        mostSimilarEditorUrl.splice(mostSimilarEditorUrl.length - mostSimilarCount, mostSimilarCount);

        mapPinegrowPrefix = 'file://' + mostSimilarPgUrl.join('/');
        mapMyPrefix = 'file://' + mostSimilarEditorUrl.join('/');

        return true;
    }

    function doWithCurrentSourceNodeForEditor(document, func) {
        var url = getPgEditorUrl(document);
        if (currentSourceNodes[url]) {
            func(currentSourceNodes[url]);
        } else {
            if (!pg) {
                vscode.window.showErrorMessage("Didn't yet received parser module from Pinegrow.");
                if (editor_api) {
                    editor_api.emit('requestParserModule');
                }
                return;
            }
            var p = new pgParser();
            p.assignIds = false;
            p.parse(document.getText(), function () {
                currentSourceNodes[url] = p.rootNode;
                func(currentSourceNodes[url]);
            });
        }
    }

    function setText(editor, text) {
        editor.edit(function (builder) {
            const document = editor.document;
            var line = document.lineCount - 1;
            if (line < 0) line = 0;

            const lastLine = document.lineAt(line);

            const start = new vscode.Position(0, 0);
            const end = new vscode.Position(document.lineCount - 1, lastLine.text.length);

            builder.replace(new vscode.Range(start, end), text);
        });
    }

    function scrollEditorTo(editor, lineObject) {
        var showLine = 0;
        var ranges = editor.visibleRanges;
        if (ranges && ranges.length > 0) {
            var visibleRange = ranges[0];
            var visibleLine = visibleRange.start.line;
            if (visibleLine - lineObject.start > 0) {
                showLine = lineObject.start;
                if (showLine > 0) showLine--;
            } else {
                showLine = lineObject.end;
                if (showLine < editor.document.lineCount) showLine++;
            }
        }

        var lineRange = editor.document.lineAt(showLine).range;
        editor.revealRange(lineRange);
    }

    function getFormatedUrl(url) {
        if (process.platform === "win32") {
            url = url.replace(/\:\/\/\/([a-z])\:\//, function (char) {
                return char.toUpperCase();
            });
        }
        return url;
    }

    function clearChangedInEditorTimeout(force) {
        if (force || codeChangedInEditorTimeout !== null) {
            clearTimeout(codeChangedInEditorTimeout);
            codeChangedInEditorTimeout = null;
        }
    }

    function clearSavedInEditorInterval(force) {
        if (force || codeSavedInEditorInterval !== null) {
            clearTimeout(codeSavedInEditorInterval);
            codeSavedInEditorInterval = null;
        }
    }

    this.revertEditorFromDisk = function (editor) {
        vscode.commands.executeCommand('workbench.action.files.revert', editor.document.uri);
    }

    this.sourceChanged = function (url) {
        currentSourceNodes[url] = null;
    }

    this.isFileOpenInPinegrow = function (url) {
        url = getFormatedUrl(url);
        return this.filesOpenInPinegrow.indexOf(url) >= 0;
    }

    this.activeEditorChanged = function (editor, oldEditor) {
        if (oldEditor) {
            var url = getPgEditorUrl(oldEditor.document);
            editorObj[url] = true;
        }
    }

    this.editorTextChanged = function (editor) {
        if (editor) {
            var document = editor.document;
            if (document.isDirty) {
                var url = getPgEditorUrl(document);
                if (editorObj[url]) {
                    editorObj[url] = false;
                    return;
                }

                if (this.isFileOpenInPinegrow(url)) {
                    clearChangedInEditorTimeout();
                    codeChangedInEditorTimeout = setTimeout(function () {
                        clearChangedInEditorTimeout(true);
                        editor_api.emit('codeChangedInEditor', {
                            url: url,
                            code: document.getText()
                        });
                    }, CHANGE_DELAY);
                }
                this.sourceChanged(url);
            }
        }
    }

    this.editorTextSaved = function (document) {
        if (document) {
            var url = getPgEditorUrl(document);
            if (this.isFileOpenInPinegrow(url)) {
                // Wait for the changes to be sent
                codeSavedInEditorInterval = setInterval(function () {
                    if (codeChangedInEditorTimeout == null) {
                        clearSavedInEditorInterval(true);
                        // Wait a bit for change reflection
                        setTimeout(function () {
                            editor_api.emit('fileSavedInEditor', {
                                url: url
                            });
                        }, SAVE_DELAY);
                    }
                }, SAVE_INTERVAL);
            }
        }
    }

    this.getPinegrowApiEndPoint = function (endpoint, port_index) {
        port_index = port_index || 0;

        var urlparts = pinegrow_url.split(':');
        if (urlparts.length == 2) {
            urlparts.push('40000');
        }
        if (urlparts.length > 2) {
            urlparts[urlparts.length - 1] = parseInt(urlparts[urlparts.length - 1]) + port_index + 1;
        }
        return urlparts.join(':') + '/' + endpoint;
    }

    this.visibleEditorChanged = function (editor) {
        var document = editor.document;
        var url = getPgEditorUrl(document);
        var code = fileNotUpdated[url];
        if (code) {
            this.changeEditorSource(editor, url, code);
            delete fileNotUpdated[url];
        }
    }

    this.changeEditorSource = function (editor, url, code) {
        var document = editor.document;
        editorObj[url] = true;

        // Unsaved circle will appear
        // even if there is no change
        if (document.getText() != code) { // @TODO: check this
            setText(editor, code);
            this.sourceChanged(url);
        }
    }

    this.init = function () {
        var _this = this;
        var url = this.getPinegrowApiEndPoint('editor');

        if (editor_api) editor_api.destroy();

        var urlinfo = require('url').parse(url);

        if (!urlinfo.hostname || !urlinfo.port) {
            vscode.window.showErrorMessage('Hostname and port are not set in Pinegrow URL.');
            return;
        }

        editor_api = io.connect(url);

        editor_api.on('connect', function () {
            vscode.window.showInformationMessage("Connected to Pinegrow.");
            if (url.indexOf('localhost') < 0 && url.indexOf('127.0.0.1') < 0) {
                vscode.window.showInformationMessage("Use <b>Packages -&gt; Pinegrow -&gt; Detect file paths mapping</b> if Pinegrow runs on a different computer.");
            }
            if (!pg) {
                editor_api.emit('requestParserModule');
            }
        });

        editor_api.on('parserModule', function (data) {
            if (!pg) {
                require('vm').runInThisContext(data.code, 'remote_modules/pinegrowparser.js');
                pg = true;
            }
        });

        editor_api.on('disconnect', function () {
            vscode.window.showWarningMessage("Disconnected from Pinegrow.");
        });

        editor_api.on('error', function () {
            vscode.window.showErrorMessage("Unable to connect to Pinegrow at " + url + '.');
        });

        var last_error_url = null;
        editor_api.on('connect_error', function () {
            if (last_error_url != url) {
                vscode.window.showErrorMessage("Unable to connect to Pinegrow at " + url + '.');
                last_error_url = url;
            }
        });

        editor_api.on('codeChanged', function (data) {
            var fileFound = false;
            var editors = vscode.window.visibleTextEditors;
            editors.forEach(function (editor) {
                var document = editor.document;
                var url = getPgEditorUrl(document);
                url = getFormatedUrl(url);
                if (url == data.url) {
                    _this.changeEditorSource(editor, url, data.code);
                    fileFound = true;
                }
            });

            if (!fileFound) {
                fileNotUpdated[data.url] = data.code;
            }
        });

        editor_api.on('elementSelectedInPreview', function (data) {
            console.log('Element selected in preview');
            var editors = vscode.window.visibleTextEditors;
            editors.forEach(function (editor) {
                var document = editor.document;
                var url = getPgEditorUrl(document);
                url = getFormatedUrl(url);
                if (url == data.url) {
                    doWithCurrentSourceNodeForEditor(document, function (sourceNode) {
                        var node = sourceNode.getNodeFromPath(data.path);
                        if (node) {
                            var sourcePos = node.getPositionInSource();

                            var posStart = document.positionAt(sourcePos.start);
                            var posEnd = document.positionAt(sourcePos.end);

                            editor.selection = new vscode.Selection(
                                posStart.line, posStart.character,
                                posEnd.line, posEnd.character
                            );

                            var lineObject = {
                                start: posStart.line,
                                end: posEnd.line
                            }
                            scrollEditorTo(editor, lineObject);
                        }
                    })
                }
            })
        });

        editor_api.on('listOfOpenFiles', function (data) {
            _this.filesOpenInPinegrow = data.list;
        })
    }

    this.selectInPinegrow = function (editor) {
        if (editor) {
            var document = editor.document;
            var url = getPgEditorUrl(document);
            if (this.isFileOpenInPinegrow(url)) {
                var idx = document.offsetAt(editor.selection.active);
                doWithCurrentSourceNodeForEditor(document, function (sourceNode) {
                    var node = sourceNode.findNodeAtSourceIndex(idx);
                    if (node) {
                        var path = node.getPath();
                        editor_api.emit('elementSelectedInEditor', {
                            url: url,
                            path: path
                        });
                    }
                })
            }
        }
    }

    this.openInPinegrow = function (editor) {
        if (editor) {
            var document = editor.document;
            var url = getPgEditorUrl(document);
            editor_api.emit('openFile', {
                url: url
            });
        }
    }

    this.reconnect = function () {
        this.init();
    }

    this.autoDetectMapping = function () {
        var pg_urls = [];
        this.filesOpenInPinegrow.forEach(function (url) {
            pg_urls.push(url)
        });

        var editor_urls = [];
        var documents = vscode.workspace.textDocuments;
        documents.forEach(function (document) {
            var url = getEditorUrl(document);
            if (url) {
                editor_urls.push(url);
            }
        })

        if (autoDetectMapping(pg_urls, editor_urls)) {
            if (mapPinegrowPrefix === null) {
                vscode.window.showInformationMessage('File paths are the same in Pinegrow and in VS Code.');
            } else {
                vscode.window.showInformationMessage('Mapping detected: ' + mapPinegrowPrefix + ' -&gt; ' + mapMyPrefix);
            }
        } else {
            vscode.window.showErrorMessage('Could not detect PG &lt;---&gt; VS Code mapping. Did you open the same file in both editors?');
        }
    }

    this.refreshPage = function (editor) {
        if (editor) {
            var document = editor.document;
            var url = getPgEditorUrl(document);
            editor_api.emit('refreshPage', {
                url: url
            });
        }
    }

    this.destroy = function () {
        editor_api.destroy();
        editor_api = null;
    }
}

module.exports = PinegrowVS;