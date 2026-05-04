import * as vscode from 'vscode';
import { extractClasses, buildInheritanceMap } from './parser';
import { ClassNode } from './types';
import { renderClassTreeSVG } from './ui/render';
import { collectAncestors, collectDescendants, buildConnectedComponents, buildComponentLayers } from './ui/resolve';
import { renderForestSVG } from './ui/renderForest';
import { scanWorkspaceClasses } from './projectScanner';
import { renderClassMarkdown } from './ui/hover';
import { Messages } from './config';

/* =========================================================
   EXTENSION (MAIN)
========================================================= */

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        registerHoverProvider(),
        registerShowClassCommand(),
        registerShowProjectTreeCommand()
    );
}

export function deactivate() {}

/* =========================================================
   REGISTRATIONS
========================================================= */

function registerHoverProvider(): vscode.Disposable {
    return vscode.languages.registerHoverProvider('python', {
        async provideHover(document, position) {
            const node = await getClassUnderCursor(document, position);
            if (!node) return;
            return new vscode.Hover(new vscode.MarkdownString(renderClassMarkdown(node)));
        },
    });
}

function registerShowClassCommand(): vscode.Disposable {
    return vscode.commands.registerCommand('pydanticTree.showClass', showClassTree);
}

function registerShowProjectTreeCommand(): vscode.Disposable {
    return vscode.commands.registerCommand('pydanticTree.showProjectTree', showProjectTree);
}

/* =========================================================
   COMMAND HANDLERS
========================================================= */

async function showClassTree() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const { document, selection } = editor;
    const focusNode = await getClassUnderCursor(document, selection.active);

    if (!focusNode) {
        vscode.window.showInformationMessage(Messages.noClassUnderCursor);
        return;
    }

    const classes = await buildInheritanceMap(focusNode.name, document);
    const ancestors = resolveLayeredNodes(collectAncestors(focusNode.name, classes), classes);
    const descendants = resolveLayeredNodes(collectDescendants(focusNode.name, classes), classes);

    openWebview(
        'pydanticClassTree',
        Messages.titles.classTree(focusNode.name),
        renderClassTreeSVG(focusNode, ancestors, descendants)
    );
}

async function showProjectTree() {
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
        'pydanticProjectTree',
        Messages.titles.projectTree,
        renderForestSVG(componentLayers, allClasses)
    );
}

/* =========================================================
   CLASS RESOLUTION
========================================================= */

async function getClassUnderCursor(
    document: vscode.TextDocument,
    position: vscode.Position
): Promise<ClassNode | undefined> {
    const range = document.getWordRangeAtPosition(position);
    if (!range) return;
    const word = document.getText(range);
    const classes = await extractClasses(document);
    return classes.get(word);
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

function openWebview(viewType: string, title: string, html: string) {
    const panel = vscode.window.createWebviewPanel(
        viewType,
        title,
        vscode.ViewColumn.Beside,
        { enableScripts: true }
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
