const vscode = require('vscode');
const PinegrowVS = require('./lib/pinegrow-vs');

var pgvs = new PinegrowVS();
var activeEditor = null;

function activate(context) {
    pgvs.init();

    vscode.window.onDidChangeActiveTextEditor(function (editor) {
        pgvs.activeEditorChanged(editor, activeEditor);
        if(editor) {
            pgvs.visibleEditorChanged(editor);
        }
        activeEditor = editor;
    })

    vscode.workspace.onDidChangeTextDocument(function (editor) {
        pgvs.editorTextChanged(editor);
    });

    vscode.workspace.onDidSaveTextDocument(function (document) {
        pgvs.editorTextSaved(document);
    });

    var selectInPg = vscode.commands.registerCommand('extension.selectInPG', function () {
        var editor = vscode.window.activeTextEditor;
        pgvs.selectInPinegrow(editor);
    });

    var openInPg = vscode.commands.registerCommand('extension.openInPG', function () {
        var editor = vscode.window.activeTextEditor;
        pgvs.openInPinegrow(editor);
    });

    var reconnect = vscode.commands.registerCommand('extension.reconnect', function () {
        pgvs.reconnect();
    });

    var detectMapping = vscode.commands.registerCommand('extension.detectMapping', function () {
        pgvs.autoDetectMapping();
    });

    var downloadPinegrow = vscode.commands.registerCommand('extension.downloadPinegrow', function () {
        vscode.commands.executeCommand('vscode.open', vscode.Uri.parse('http://pinegrow.com'));
    });

    var refreshPage = vscode.commands.registerCommand('extension.refreshPage', function () {
        var editor = vscode.window.activeTextEditor;
        pgvs.refreshPage(editor);
    });

    context.subscriptions.push(selectInPg, openInPg, reconnect, detectMapping, downloadPinegrow, refreshPage);
}
exports.activate = activate;

function deactivate() {
    pgvs.destroy();
}
exports.deactivate = deactivate;