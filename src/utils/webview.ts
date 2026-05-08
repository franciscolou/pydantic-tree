import * as vscode from 'vscode';

export function openWebview(
    context: vscode.ExtensionContext,
    viewType: string,
    title: string,
    html: string
) {
    const panel = vscode.window.createWebviewPanel(
        viewType,
        title,
        vscode.ViewColumn.Beside,
        { enableScripts: true }
    );
    panel.iconPath = vscode.Uri.joinPath(
        context.extensionUri,
        ...'assets/images/pytree.svg'.split('/')
    );
    panel.webview.html = html;

    panel.webview.onDidReceiveMessage(async msg => {
        if (msg.command !== 'navigate') {
            return;
        }

        const uri = vscode.Uri.parse(msg.fileUri);
        const pos = new vscode.Position(msg.line, 0);

        const existingEditor = vscode.window.visibleTextEditors.find(
            e => e.document.uri.toString() === uri.toString()
        );

        let editor;

        if (existingEditor) {
            editor = await vscode.window.showTextDocument(
                existingEditor.document,
                existingEditor.viewColumn
            );
        } else {
            editor = await vscode.window.showTextDocument(uri, {
                preview: true,
            });
        }

        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(
            new vscode.Range(pos, pos),
            vscode.TextEditorRevealType.InCenter
        );
    });
}
