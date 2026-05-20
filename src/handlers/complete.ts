import * as vscode from 'vscode';
import { openWebview, PanelState } from '../utils/webview';
import { resolveClassNode } from '../utils/resolve';
import { Messages } from '../config';
import { extractClasses } from '../utils/parser';
import {
    buildAncestorLayers,
    buildDescendantLayers,
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
        const classes = await extractClasses(document);
        const rootItem = await prepareTypeHierarchyAt(node);
        if (!rootItem) {
            vscode.window.showInformationMessage(Messages.errors.pylanceRequired);
            return null;
        }
        const [ancestors, descendants] = await Promise.all([
            buildAncestorLayers(rootItem, node, classes),
            buildDescendantLayers(rootItem, node, classes),
        ]);
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
