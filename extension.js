const vscode = require('vscode');
const PinegrowVS = require('./lib/pinegrow-vs');

/**
 * Called when VS Code activates your extension.
 */
let pgvs;

function activate(context) {
    // Create the PinegrowVS instance.
    pgvs = new PinegrowVS();

    // Initialize PinegrowVS right away.
    pgvs.init();

    // Track the previously active editor so we can pass it to activeEditorChanged.
    let activeEditor = null;

    // Listen for changes in the active text editor.
    vscode.window.onDidChangeActiveTextEditor((editor) => {
        pgvs.activeEditorChanged(editor, activeEditor);
        if (editor) {
            pgvs.visibleEditorChanged(editor);
        }
        activeEditor = editor;
    });

    // Listen for text changes in any open document.
    vscode.workspace.onDidChangeTextDocument((event) => {
        pgvs.editorTextChanged(event);
    });

    // Listen for saves in any open document.
    vscode.workspace.onDidSaveTextDocument((document) => {
        pgvs.editorTextSaved(document);
    });

    // Reconnect Pinegrow when workspace folders are added or removed.
    const workspaceFoldersWatcher = vscode.workspace.onDidChangeWorkspaceFolders(() => {
        pgvs.reconnect();
    });

    // Whenever the user changes configuration, we check if pinegrow.urlWithPort was changed
    // and reconnect if needed.
    const configWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('pinegrow.urlWithPort') || e.affectsConfiguration('pinegrow.enabled')) {
            pgvs.reconnect();
        }
    });

    const selectInPg = vscode.commands.registerCommand('extension.selectInPG', () => {
        const editor = vscode.window.activeTextEditor;
        pgvs.selectInPinegrow(editor);
    });

    const openInPg = vscode.commands.registerCommand('extension.openInPG', () => {
        const editor = vscode.window.activeTextEditor;
        pgvs.openInPinegrow(editor);
    });

    const reconnect = vscode.commands.registerCommand('extension.reconnect', () => {
        pgvs.reconnect();
    });

    const detectMapping = vscode.commands.registerCommand('extension.detectMapping', () => {
        pgvs.autoDetectMapping();
    });

    const downloadPinegrow = vscode.commands.registerCommand('extension.downloadPinegrow', () => {
        vscode.commands.executeCommand('vscode.open', vscode.Uri.parse('https://pinegrow.com'));
    });

    const refreshPage = vscode.commands.registerCommand('extension.refreshPage', () => {
        const editor = vscode.window.activeTextEditor;
        pgvs.refreshPage(editor);
    });

    context.subscriptions.push(
        workspaceFoldersWatcher,
        configWatcher,
        selectInPg,
        openInPg,
        reconnect,
        detectMapping,
        downloadPinegrow,
        refreshPage
    );
}

function deactivate() {
    pgvs.destroy();
}

exports.activate = activate;
exports.deactivate = deactivate;
