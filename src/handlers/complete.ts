import * as vscode from 'vscode';
import { openWebview, PanelState } from '../utils/webview';
import { resolveClassNode, resolveLayeredNodes } from '../utils/resolve';
import { collectAncestors, collectDescendants } from '../ui/utils/resolve';
import { Messages } from '../config';
import { buildInheritanceMap } from '../utils/parser';
import {
    collectSubtypesIntoClasses,
    prepareTypeHierarchyAt,
} from '../utils/typeHierarchy';
import { renderClassTree } from '../ui/render/trees/single';
import { ClassRef } from '../types';

export async function showCompleteClassTree(
    context: vscode.ExtensionContext,
    ref?: ClassRef
) {
    const focusNode = await resolveClassNode(ref);
    if (!focusNode) {
        vscode.window.showInformationMessage(Messages.errors.noClassUnderCursor);
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
        const rootItem = await prepareTypeHierarchyAt(node);
        if (!rootItem) {
            vscode.window.showInformationMessage(Messages.errors.pylanceRequired);
            return null;
        }
        await collectSubtypesIntoClasses(rootItem, classes);
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

    const state = await computeState();
    if (!state) {
        return;
    }

    await openWebview(
        context,
        'pytreeClassTree',
        Messages.webView.titles.completeClassTree(focusNode.name),
        state.html,
        state.fileUris,
        'complete:' + focusNode.id,
        computeState
    );
}
