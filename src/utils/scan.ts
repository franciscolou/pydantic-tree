import * as vscode from 'vscode';
import { ClassNode } from '../types';
import { extractClasses } from './parser';

let scanCache: Map<string, ClassNode> | null = null;

export function initCache(context: vscode.ExtensionContext): void {
    const invalidate = () => {
        scanCache = null;
    };

    const watcher = vscode.workspace.createFileSystemWatcher('**/*.py');
    context.subscriptions.push(
        watcher,
        watcher.onDidCreate(invalidate),
        watcher.onDidDelete(invalidate),
        watcher.onDidChange(invalidate),
        vscode.workspace.onDidSaveTextDocument(doc => {
            if (doc.languageId === 'python') {
                invalidate();
            }
        })
    );
}

export async function scanWorkspaceClasses(
    progress?: vscode.Progress<{ message?: string; increment?: number }>
): Promise<Map<string, ClassNode>> {
    if (scanCache) {
        return scanCache;
    }

    const files = await vscode.workspace.findFiles(
        '**/*.py',
        '{**/node_modules/**,**/.venv/**,**/venv/**,**/__pycache__/**,**/.git/**,**/site-packages/**}'
    );

    const allClasses = new Map<string, ClassNode>();
    const step = files.length > 0 ? 100 / files.length : 100;

    for (const uri of files) {
        progress?.report({
            message: uri.fsPath.split('/').pop(),
            increment: step,
        });
        try {
            const doc = await vscode.workspace.openTextDocument(uri);
            const classes = await extractClasses(doc);
            for (const [id, node] of classes) {
                allClasses.set(id, node);
            }
        } catch {
            // skip files that can't be parsed
        }
    }

    scanCache = allClasses;
    return scanCache;
}
