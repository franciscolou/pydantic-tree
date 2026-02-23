import * as vscode from 'vscode';
import { extractClasses } from './parser';
import { ClassNode } from './types';
import { renderClassTreeSVG } from './ui/render';
import { collectAncestors, collectDescendants } from './ui/resolve';
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
        provideHover(document, position) {
            const node = getClassUnderCursor(document, position);
            if (!node) return;

            return createClassHover(node);
        },
    });
}

function registerShowClassCommand(): vscode.Disposable {
    return vscode.commands.registerCommand(
        'pydanticTree.showClass',
        showClassTree
    );
}

/* =========================================================
   COMMAND HANDLERS
   ========================================================= */

function showClassTree() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const document = editor.document;
    const position = editor.selection.active;

    const classes = extractClasses(document);
    const focusNode = getClassUnderCursor(document, position, classes);

    if (!focusNode) {
        vscode.window.showInformationMessage(Messages.noClassUnderCursor);
        return;
    }

    const ancestors = resolveAncestors(focusNode.name, classes);
    const descendants = resolveDescendants(focusNode.name, classes);

    openClassTreeWebview(focusNode, ancestors, descendants);
}

/* =========================================================
   CLASS RESOLUTION
   ========================================================= */

function getClassUnderCursor(
    document: vscode.TextDocument,
    position: vscode.Position,
    cached?: Map<string, ClassNode>
): ClassNode | undefined {
    const range = document.getWordRangeAtPosition(position);
    if (!range) return;

    const word = document.getText(range);
    const classes = cached ?? extractClasses(document);

    return classes.get(word);
}

function resolveAncestors(
    className: string,
    classes: Map<string, ClassNode>
): ClassNode[][] {
    return collectAncestors(className, classes).map(layer =>
        layer
            .map(name => classes.get(name))
            .filter((n): n is ClassNode => Boolean(n))
    );
}

function resolveDescendants(
    className: string,
    classes: Map<string, ClassNode>
): ClassNode[][] {
    return collectDescendants(className, classes).map(layer =>
        layer
            .map(name => classes.get(name))
            .filter((n): n is ClassNode => Boolean(n))
    );
}

/* =========================================================
   UI
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

function createClassHover(node: ClassNode): vscode.Hover {
    return new vscode.Hover(
        new vscode.MarkdownString(renderClassMarkdown(node))
    );
}

/* =========================================================
   MARKDOWN RENDERING
   ========================================================= */

function renderClassMarkdown(node: ClassNode): string {
    return `
### Classe \`${node.name}\`

**Bases:** ${formatBases(node)}

**Atributos:**  
${formatAttributes(node)}

**Métodos:**  
${formatMethods(node)}
`;
}

function formatBases(node: ClassNode): string {
    return node.bases.length ? node.bases.join(', ') : 'nenhuma';
}

function formatAttributes(node: ClassNode): string {
    if (!node.attributes.length) return '_nenhum_';

    return node.attributes
        .map(a => `• \`${a.name}: ${a.type ?? '?'}\``)
        .join('\n\n');
}

function formatMethods(node: ClassNode): string {
    if (!node.methods.length) return '_nenhum_';

    return node.methods
        .map(m => {
            const params = m.params
                .map(p => {
                    let s = p.name;
                    if (p.type) s += `: ${p.type}`;
                    if (p.defaultValue) s += ` = ${p.defaultValue}`;
                    return s;
                })
                .join(', ');

            const ret = m.returnType ? ` → ${m.returnType}` : '';
            return `• \`${m.name}(${params})${ret}\``;
        })
        .join('\n\n');
}
