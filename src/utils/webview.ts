import * as vscode from 'vscode';
import type { ClassNode } from '../types';
import { Messages } from '../config';
import {
    detectCycle,
    detectConflicts,
    rewriteInheritance,
} from './inheritance';
import { invalidateScanCache } from './scan';

export interface PanelState {
    html: string;
    fileUris: string[];
    classes: Map<string, ClassNode>;
}

export type PanelStateProvider = () => Promise<PanelState | null>;

type PanelEntry = {
    panel: vscode.WebviewPanel;
    fileVersions: Map<string, number>;
    extraKey: string;
    provider?: PanelStateProvider;
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

async function handleNavigate(
    fileUri: string,
    line: number
): Promise<void> {
    const uri = vscode.Uri.parse(fileUri);
    const pos = new vscode.Position(line, 0);
    const existingEditor = vscode.window.visibleTextEditors.find(
        e => e.document.uri.toString() === uri.toString()
    );
    const editor = existingEditor
        ? await vscode.window.showTextDocument(
              existingEditor.document,
              existingEditor.viewColumn
          )
        : await vscode.window.showTextDocument(uri, { preview: true });
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(
        new vscode.Range(pos, pos),
        vscode.TextEditorRevealType.InCenter
    );
}

async function refreshPanel(viewType: string): Promise<void> {
    const entry = panelRegistry.get(viewType);
    if (!entry || !entry.provider) {
        return;
    }
    try {
        const state = await entry.provider();
        if (!state) {
            return;
        }
        entry.panel.webview.html = state.html;
        entry.fileVersions = await getFileVersions(state.fileUris);
    } catch {
        // ignore
    }
}

async function handleChangeInheritance(
    viewType: string,
    childId: string,
    oldParentId: string,
    newParentId: string
): Promise<void> {
    const entry = panelRegistry.get(viewType);
    if (!entry?.provider) {
        return;
    }
    const state = await entry.provider();
    if (!state) {
        return;
    }
    const { classes } = state;

    const child = classes.get(childId);
    const oldParent = classes.get(oldParentId);
    const newParent = classes.get(newParentId);
    if (!child || !oldParent || !newParent) {
        return;
    }

    if (oldParent.id === newParent.id) {
        vscode.window.showInformationMessage(
            Messages.inheritance.sameParent
        );
        return;
    }

    if (detectCycle(childId, newParentId, classes)) {
        vscode.window.showErrorMessage(
            Messages.inheritance.cycleError(child.name, newParent.name)
        );
        return;
    }

    const conflicts = detectConflicts(
        child,
        oldParentId,
        newParentId,
        classes
    );
    if (conflicts.attrs.length || conflicts.methods.length) {
        const lines: string[] = [
            Messages.inheritance.conflictTitle(child.name, newParent.name),
        ];
        if (conflicts.attrs.length) {
            lines.push(Messages.inheritance.conflictAttrs(conflicts.attrs));
        }
        if (conflicts.methods.length) {
            lines.push(Messages.inheritance.conflictMethods(conflicts.methods));
        }
        lines.push(Messages.inheritance.conflictFooter);
        const choice = await vscode.window.showWarningMessage(
            lines.join('\n\n'),
            { modal: true },
            Messages.inheritance.applyAnyway
        );
        if (choice !== Messages.inheritance.applyAnyway) {
            return;
        }
    } else {
        const choice = await vscode.window.showInformationMessage(
            Messages.inheritance.confirmTitle(
                child.name,
                oldParent.name,
                newParent.name
            ),
            { modal: true },
            Messages.inheritance.confirmApply
        );
        if (choice !== Messages.inheritance.confirmApply) {
            return;
        }
    }

    const ok = await rewriteInheritance(child, oldParent, newParent);
    if (!ok) {
        vscode.window.showErrorMessage(Messages.inheritance.rewriteFailed);
        return;
    }

    invalidateScanCache();
    await refreshPanel(viewType);
    vscode.window.showInformationMessage(
        Messages.inheritance.appliedNotice(child.name, newParent.name)
    );
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
        if (msg.command === 'navigate') {
            await handleNavigate(msg.fileUri, msg.line);
            return;
        }
        if (msg.command === 'changeInheritance') {
            await handleChangeInheritance(
                viewType,
                msg.childId,
                msg.oldParentId,
                msg.newParentId
            );
            return;
        }
    });

    return panel;
}

/**
 * Opens a webview panel. When `fileUris` is provided, reuses an existing
 * panel of the same viewType if all involved files are unchanged (same VSCode
 * document version) and `extraKey` matches. If any file changed or the key
 * differs, a new panel is created so both versions can be compared side-by-side.
 *
 * `provider`, when supplied, is invoked to refresh the panel after the user
 * mutates inheritance via drag-and-drop. It must return the up-to-date state
 * (HTML, involved file URIs, and the classes map).
 */
export async function openWebview(
    context: vscode.ExtensionContext,
    viewType: string,
    title: string,
    html: string,
    fileUris?: string[],
    extraKey = '',
    provider?: PanelStateProvider
): Promise<void> {
    if (fileUris?.length) {
        const currentVersions = await getFileVersions(fileUris);
        const entry = panelRegistry.get(viewType);
        if (entry && panelEntryMatches(entry, currentVersions, extraKey)) {
            entry.panel.reveal();
            entry.provider = provider ?? entry.provider;
            return;
        }
        const panel = setupPanel(context, viewType, title, html);
        panelRegistry.set(viewType, {
            panel,
            fileVersions: currentVersions,
            extraKey,
            provider,
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
