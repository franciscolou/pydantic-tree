import * as vscode from 'vscode';
import { extractClasses, buildInheritanceMap } from './parser';
import { ClassNode } from './types';
import { renderClassTreeSVG } from './ui/render';
import { collectAncestors, collectDescendants } from './ui/resolve';
import { renderClassMarkdown } from './ui/hover';
import { Messages } from './config';

/* =========================================================
   EXTENSION (MAIN)
========================================================= */

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        registerHoverProvider(),
        registerShowClassCommand()
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

/* =========================================================
   COMMAND HANDLER
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

    openClassTreeWebview(focusNode, ancestors, descendants);
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

function openClassTreeWebview(
    focus: ClassNode,
    ancestors: ClassNode[][],
    descendants: ClassNode[][]
) {
    const panel = vscode.window.createWebviewPanel(
        'pydanticClassTree',
        Messages.titles.classTree(focus.name),
        vscode.ViewColumn.Beside,
        { enableScripts: true }
    );
    panel.webview.html = renderClassTreeSVG(focus, ancestors, descendants);
}
