import * as vscode from 'vscode';
import { ClassNode } from '../types';
import { scanWorkspaceClasses } from '../utils/scan';
import { Messages } from '../config';
import { resolveLayeredNodes } from '../utils/resolve';
import { collectAncestors, collectDescendants } from '../ui/utils/resolve';
import { openWebview } from '../utils/webview';
import { renderMultiTree } from '../ui/render/trees/pick';

export async function showPickClassesTree(context: vscode.ExtensionContext) {
    const treeTypeItem = await vscode.window.showQuickPick(
        [
            {
                label: Messages.commands.pickClasses.labels.simpleTree.title,
                description:
                    Messages.commands.pickClasses.labels.simpleTree.description,
            },
            {
                label: Messages.commands.pickClasses.labels.completeTree.title,
                description:
                    Messages.commands.pickClasses.labels.completeTree
                        .description,
            },
        ],
        { placeHolder: Messages.commands.pickClasses.labels.placeholder }
    );
    if (!treeTypeItem) {
        return;
    }
    const isComplete =
        treeTypeItem.label ===
        Messages.commands.pickClasses.labels.completeTree.title;

    let allClasses = new Map<string, ClassNode>();
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: Messages.status.scanningFiles,
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

    const workspaceRoot =
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    const items = [...allClasses.values()].map(node => {
        const filePath = vscode.Uri.parse(node.fileUri).fsPath;
        const relPath = workspaceRoot
            ? filePath.replace(workspaceRoot + '/', '')
            : filePath;
        return { label: node.name, description: relPath, nodeId: node.id };
    });

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select classes to display',
        canPickMany: true,
    });
    if (!selected || selected.length === 0) {
        return;
    }

    const trees = selected.map(item => {
        const focus = allClasses.get(item.nodeId)!;
        const ancestorLayers = resolveLayeredNodes(
            collectAncestors(focus.id, allClasses),
            allClasses
        );
        const descendantLayers = isComplete
            ? resolveLayeredNodes(
                  collectDescendants(focus.id, allClasses),
                  allClasses
              )
            : [];
        return { focus, ancestorLayers, descendantLayers };
    });

    const fileUris = [...new Set([...allClasses.values()].map(n => n.fileUri))];
    const extraKey = [
        isComplete ? 'complete' : 'simple',
        ...selected.map(s => s.nodeId).sort(),
    ].join('\0');
    await openWebview(
        context,
        'pytreePickedClasses',
        Messages.webView.titles.pickedClassesTree,
        renderMultiTree(trees),
        fileUris,
        extraKey
    );
}
