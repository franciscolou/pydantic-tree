import * as vscode from 'vscode';
import { ClassNode } from '../types';
import { Messages } from '../config';
import { scanWorkspaceClasses } from '../utils/scan';
import {
    buildComponentLayers,
    buildConnectedComponents,
} from '../ui/utils/resolve';
import { openWebview } from '../utils/webview';
import { renderProjectTree } from '../ui/render/trees/project';

export async function showProjectTree(context: vscode.ExtensionContext) {
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

    const components = buildConnectedComponents(allClasses);
    const componentLayers = components.map(comp => buildComponentLayers(comp));

    const fileUris = [...new Set([...allClasses.values()].map(n => n.fileUri))];
    await openWebview(
        context,
        'pytreeProjectTree',
        Messages.webView.titles.projectTree,
        renderProjectTree(componentLayers, allClasses),
        fileUris
    );
}
