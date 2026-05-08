import * as vscode from 'vscode';
import { extractClasses, buildInheritanceMap } from './parser';
import { ClassNode } from './types';
import { renderClassTreeSVG } from './ui/render';
import { collectAncestors, collectDescendants, buildConnectedComponents, buildComponentLayers } from './ui/resolve';
import { renderForestSVG } from './ui/renderForest';
import { renderMultiTreeSVG } from './ui/renderMultiTree';
import { scanWorkspaceClasses } from './projectScanner';
import { renderClassHover } from './ui/hover';
import { Messages } from './config';

/* =========================================================
   EXTENSION (MAIN)
========================================================= */

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        registerHoverProvider(),
        registerShowClassCommand(context),
        registerShowCompleteClassCommand(context),
        registerShowProjectTreeCommand(context),
        registerPickClassesCommand(context)
    );
}

export function deactivate() {}

type ClassRef = { fileUri: string; line: number };

/* =========================================================
   REGISTRATIONS
========================================================= */

function registerHoverProvider(): vscode.Disposable {
    return vscode.languages.registerHoverProvider('python', {
        async provideHover(document, position) {
            const node = await getClassUnderCursor(document, position);
            if (!node) return;
            const md = new vscode.MarkdownString(renderClassHover(node));
            md.isTrusted = true;
            return new vscode.Hover(md);
        },
    });
}

function registerShowClassCommand(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.commands.registerCommand('pytree.showClassTree', (ref?: ClassRef) => showClassTree(context, ref));
}

function registerShowCompleteClassCommand(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.commands.registerCommand('pytree.showCompleteClassTree', (ref?: ClassRef) => showCompleteClassTree(context, ref));
}

function registerShowProjectTreeCommand(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.commands.registerCommand('pytree.showProjectTree', () => showProjectTree(context));
}

function registerPickClassesCommand(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.commands.registerCommand('pytree.pickClasses', () => showPickClassesTree(context));
}

/* =========================================================
   COMMAND HANDLERS
========================================================= */

async function showClassTree(context: vscode.ExtensionContext, ref?: ClassRef) {
    const focusNode = await resolveClassNode(ref);
    if (!focusNode) {
        vscode.window.showInformationMessage(Messages.noClassUnderCursor);
        return;
    }

    const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(focusNode.fileUri));
    const classes = await buildInheritanceMap(focusNode.id, document);
    const ancestors = resolveLayeredNodes(collectAncestors(focusNode.id, classes), classes);

    openWebview(
        context,
        'pytreeClassTree',
        Messages.titles.classTree(focusNode.name),
        renderClassTreeSVG(focusNode, ancestors, [])
    );
}

async function showCompleteClassTree(context: vscode.ExtensionContext, ref?: ClassRef) {
    const focusNode = await resolveClassNode(ref);
    if (!focusNode) {
        vscode.window.showInformationMessage(Messages.noClassUnderCursor);
        return;
    }

    const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(focusNode.fileUri));
    let classes = await buildInheritanceMap(focusNode.id, document);

    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: Messages.titles.scanningFiles, cancellable: false },
        async progress => {
            const allClasses = await scanWorkspaceClasses(progress);
            for (const [id, node] of allClasses) {
                if (!classes.has(id)) classes.set(id, node);
            }
        }
    );

    const ancestors = resolveLayeredNodes(collectAncestors(focusNode.id, classes), classes);
    const descendants = resolveLayeredNodes(collectDescendants(focusNode.id, classes), classes);

    openWebview(
        context,
        'pytreeClassTree',
        Messages.titles.classTree(focusNode.name),
        renderClassTreeSVG(focusNode, ancestors, descendants)
    );
}

async function showProjectTree(context: vscode.ExtensionContext) {
    let allClasses = new Map<string, ClassNode>();

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: Messages.titles.scanningFiles,
            cancellable: false,
        },
        async progress => {
            allClasses = await scanWorkspaceClasses(progress);
        }
    );

    if (!allClasses.size) {
        vscode.window.showInformationMessage(Messages.noClassesFound);
        return;
    }

    const components = buildConnectedComponents(allClasses);
    const componentLayers = components.map(comp => buildComponentLayers(comp));

    openWebview(
        context,
        'pytreeProjectTree',
        Messages.titles.projectTree,
        renderForestSVG(componentLayers, allClasses)
    );
}

async function showPickClassesTree(context: vscode.ExtensionContext) {
    const treeTypeItem = await vscode.window.showQuickPick(
        [
            { label: 'Simple Tree', description: 'Ancestors only' },
            { label: 'Complete Tree', description: 'Ancestors and descendants' },
        ],
        { placeHolder: 'Select tree type' }
    );
    if (!treeTypeItem) return;
    const isComplete = treeTypeItem.label === 'Complete Tree';

    let allClasses = new Map<string, ClassNode>();
    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: Messages.titles.scanningFiles, cancellable: false },
        async progress => {
            allClasses = await scanWorkspaceClasses(progress);
        }
    );

    if (!allClasses.size) {
        vscode.window.showInformationMessage(Messages.noClassesFound);
        return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    const items = [...allClasses.values()].map(node => {
        const filePath = vscode.Uri.parse(node.fileUri).fsPath;
        const relPath = workspaceRoot ? filePath.replace(workspaceRoot + '/', '') : filePath;
        return { label: node.name, description: relPath, nodeId: node.id };
    });

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select classes to display',
        canPickMany: true,
    });
    if (!selected || selected.length === 0) return;

    const trees = selected.map(item => {
        const focus = allClasses.get(item.nodeId)!;
        const ancestorLayers = resolveLayeredNodes(collectAncestors(focus.id, allClasses), allClasses);
        const descendantLayers = isComplete
            ? resolveLayeredNodes(collectDescendants(focus.id, allClasses), allClasses)
            : [];
        return { focus, ancestorLayers, descendantLayers };
    });

    openWebview(
        context,
        'pytreePickedClasses',
        'PyTree: Picked Classes',
        renderMultiTreeSVG(trees)
    );
}

/* =========================================================
   CLASS RESOLUTION
========================================================= */

async function resolveClassNode(ref?: ClassRef): Promise<ClassNode | undefined> {
    if (ref) {
        const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(ref.fileUri));
        const classes = await extractClasses(document);
        for (const node of classes.values()) {
            if (node.definedAtLine === ref.line) return node;
        }
        return undefined;
    }
    const editor = vscode.window.activeTextEditor;
    if (!editor) return undefined;
    return getClassUnderCursor(editor.document, editor.selection.active);
}

async function getClassUnderCursor(
    document: vscode.TextDocument,
    position: vscode.Position
): Promise<ClassNode | undefined> {
    const range = document.getWordRangeAtPosition(position);
    if (!range) return;
    const word = document.getText(range);
    const classes = await extractClasses(document);
    // The map is keyed by class ID; resolve by name within this document.
    // If the cursor lands on a class declaration line, prefer that class so
    // the right node is picked when this file declares multiple classes that
    // happen to share a leading word.
    for (const node of classes.values()) {
        if (node.name === word && node.definedAtLine === position.line) return node;
    }
    for (const node of classes.values()) {
        if (node.name === word) return node;
    }
    return undefined;
}

function resolveLayeredNodes(
    nameLayers: string[][],
    classes: Map<string, ClassNode>
): ClassNode[][] {
    return nameLayers.map(layer =>
        layer.map(name => classes.get(name)).filter((node): node is ClassNode => Boolean(node))
    );
}

/* =========================================================
   WEBVIEW
========================================================= */

function openWebview(
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
        ...'assets/icon/pytree.svg'.split("/")
    );
    panel.webview.html = html;

    panel.webview.onDidReceiveMessage(async msg => {
    if (msg.command !== 'navigate') return;

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
        preview: true
        });
    }

    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(
        new vscode.Range(pos, pos),
        vscode.TextEditorRevealType.InCenter
    );
    });
    }
