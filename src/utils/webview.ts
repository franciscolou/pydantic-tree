import * as vscode from 'vscode';

type PanelEntry = {
    panel: vscode.WebviewPanel;
    fileVersions: Map<string, number>;
    extraKey: string;
};

const panelRegistry = new Map<string, PanelEntry>();

async function getFileVersions(
    fileUris: string[]
): Promise<Map<string, number>> {
    const versions = new Map<string, number>();
    for (const uri of fileUris) {
        try {
            const doc = await vscode.workspace.openTextDocument(
                vscode.Uri.parse(uri)
            );
            versions.set(uri, doc.version);
        } catch {
            versions.set(uri, -1);
        }
    }
    return versions;
}

function panelEntryMatches(
    entry: PanelEntry,
    fileVersions: Map<string, number>,
    extraKey: string
): boolean {
    if (entry.extraKey !== extraKey) {
        return false;
    }
    if (entry.fileVersions.size !== fileVersions.size) {
        return false;
    }
    for (const [uri, version] of entry.fileVersions) {
        if (fileVersions.get(uri) !== version) {
            return false;
        }
    }
    return true;
}

function setupPanel(
    context: vscode.ExtensionContext,
    viewType: string,
    title: string,
    html: string
): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
        viewType,
        title,
        vscode.ViewColumn.Beside,
        { enableScripts: true }
    );
    panel.iconPath = vscode.Uri.joinPath(
        context.extensionUri,
        ...'assets/images/file-icon.svg'.split('/')
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

    return panel;
}

/**
 * Opens a webview panel. When `fileUris` is provided, reuses an existing
 * panel of the same viewType if all involved files are unchanged (same VSCode
 * document version) and `extraKey` matches. If any file changed or the key
 * differs, a new panel is created so both versions can be compared side-by-side.
 */
export async function openWebview(
    context: vscode.ExtensionContext,
    viewType: string,
    title: string,
    html: string,
    fileUris?: string[],
    extraKey = ''
): Promise<void> {
    if (fileUris?.length) {
        const currentVersions = await getFileVersions(fileUris);
        const entry = panelRegistry.get(viewType);
        if (entry && panelEntryMatches(entry, currentVersions, extraKey)) {
            entry.panel.reveal();
            return;
        }
        const panel = setupPanel(context, viewType, title, html);
        panelRegistry.set(viewType, {
            panel,
            fileVersions: currentVersions,
            extraKey,
        });
        panel.onDidDispose(() => {
            if (panelRegistry.get(viewType)?.panel === panel) {
                panelRegistry.delete(viewType);
            }
        });
        return;
    }

    setupPanel(context, viewType, title, html);
}
