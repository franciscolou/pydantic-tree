import * as vscode from 'vscode';
import { openWebview } from '../utils/webview';
import { resolveClassNode, resolveLayeredNodes } from '../utils/resolve';
import { collectAncestors, collectDescendants } from '../ui/utils/resolve';
import { Messages } from '../config';
import { buildInheritanceMap } from '../utils/parser';
import { scanWorkspaceClasses } from '../utils/scan';
import { renderClassTree } from '../ui/render/trees/single';
import { ClassRef } from '../types';

export async function showCompleteClassTree(
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
    let classes = await buildInheritanceMap(focusNode.id, document);

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: Messages.status.scanningFiles,
            cancellable: false,
        },
        async progress => {
            const allClasses = await scanWorkspaceClasses(progress);
            for (const [id, node] of allClasses) {
                if (!classes.has(id)) {
                    classes.set(id, node);
                }
            }
        }
    );

    const ancestors = resolveLayeredNodes(
        collectAncestors(focusNode.id, classes),
        classes
    );
    const descendants = resolveLayeredNodes(
        collectDescendants(focusNode.id, classes),
        classes
    );

    openWebview(
        context,
        'pytreeClassTree',
        Messages.webView.titles.completeClassTree(focusNode.name),
        renderClassTree(focusNode, ancestors, descendants)
    );
}
