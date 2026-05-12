import * as vscode from 'vscode';
import { resolveClassNode, resolveLayeredNodes } from '../utils/resolve';
import { ClassRef } from '../types';
import { buildInheritanceMap } from '../utils/parser';
import { collectAncestors } from '../ui/utils/resolve';
import { openWebview } from '../utils/webview';
import { Messages } from '../config';
import { renderClassTree } from '../ui/render/trees/single';

export async function showClassTree(
    context: vscode.ExtensionContext,
    ref?: ClassRef
) {
    const focusNode = await resolveClassNode(ref);
    if (!focusNode) {
        vscode.window.showInformationMessage(Messages.noClassUnderCursor);
        return;
    }

    const document = await vscode.workspace.openTextDocument(
        vscode.Uri.parse(focusNode.fileUri)
    );
    const classes = await buildInheritanceMap(focusNode.id, document);
    const ancestors = resolveLayeredNodes(
        collectAncestors(focusNode.id, classes),
        classes
    );

    const fileUris = [...new Set([...classes.values()].map(n => n.fileUri))];
    await openWebview(
        context,
        'pytreeClassTree',
        Messages.webView.titles.classTree(focusNode.name),
        renderClassTree(focusNode, ancestors, []),
        fileUris
    );
}
