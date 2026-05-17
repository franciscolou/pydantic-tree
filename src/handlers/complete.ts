import * as vscode from 'vscode';
import { openWebview, PanelState } from '../utils/webview';
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

    const focusRef: ClassRef = {
        fileUri: focusNode.fileUri,
        line: focusNode.definedAtLine,
    };

    const computeState = async (
        progress?: vscode.Progress<{
            message?: string;
            increment?: number;
        }>
    ): Promise<PanelState | null> => {
        const node = await resolveClassNode(focusRef);
        if (!node) {
            return null;
        }
        const document = await vscode.workspace.openTextDocument(
            vscode.Uri.parse(node.fileUri)
        );
        const classes = await buildInheritanceMap(node.id, document);
        const allClasses = await scanWorkspaceClasses(progress);
        for (const [id, n] of allClasses) {
            if (!classes.has(id)) {
                classes.set(id, n);
            }
        }
        const ancestors = resolveLayeredNodes(
            collectAncestors(node.id, classes),
            classes
        );
        const descendants = resolveLayeredNodes(
            collectDescendants(node.id, classes),
            classes
        );
        const fileUris = [
            ...new Set([...classes.values()].map(n => n.fileUri)),
        ];
        return {
            html: renderClassTree(node, ancestors, descendants),
            fileUris,
            classes,
        };
    };

    let state: PanelState | null = null;
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: Messages.status.scanningFiles,
            cancellable: false,
        },
        async progress => {
            state = await computeState(progress);
        }
    );

    if (!state) {
        return;
    }
    const finalState: PanelState = state;

    await openWebview(
        context,
        'pytreeClassTree',
        Messages.webView.titles.completeClassTree(focusNode.name),
        finalState.html,
        finalState.fileUris,
        'complete:' + focusNode.id,
        () => computeState()
    );
}
