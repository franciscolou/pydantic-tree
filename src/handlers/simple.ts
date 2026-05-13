import * as vscode from 'vscode';
import { resolveClassNode, resolveLayeredNodes } from '../utils/resolve';
import { ClassRef } from '../types';
import { buildInheritanceMap } from '../utils/parser';
import { collectAncestors } from '../ui/utils/resolve';
import { openWebview, PanelState } from '../utils/webview';
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

    const focusRef: ClassRef = {
        fileUri: focusNode.fileUri,
        line: focusNode.definedAtLine,
    };

    const computeState = async (): Promise<PanelState | null> => {
        const node = await resolveClassNode(focusRef);
        if (!node) {
            return null;
        }
        const document = await vscode.workspace.openTextDocument(
            vscode.Uri.parse(node.fileUri)
        );
        const classes = await buildInheritanceMap(node.id, document);
        const ancestors = resolveLayeredNodes(
            collectAncestors(node.id, classes),
            classes
        );
        const fileUris = [
            ...new Set([...classes.values()].map(n => n.fileUri)),
        ];
        return {
            html: renderClassTree(node, ancestors, []),
            fileUris,
            classes,
        };
    };

    const state = await computeState();
    if (!state) {
        vscode.window.showInformationMessage(Messages.noClassUnderCursor);
        return;
    }

    await openWebview(
        context,
        'pytreeClassTree',
        Messages.webView.titles.classTree(focusNode.name),
        state.html,
        state.fileUris,
        '',
        computeState
    );
}
