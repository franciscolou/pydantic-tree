import * as vscode from 'vscode';
import { extractClasses } from './parser';
import type { ClassNode } from './types';

export async function scanWorkspaceClasses(
    progress?: vscode.Progress<{ message?: string; increment?: number }>
): Promise<Map<string, ClassNode>> {
    const files = await vscode.workspace.findFiles(
        '**/*.py',
        '{**/node_modules/**,**/.venv/**,**/venv/**,**/__pycache__/**,**/.git/**,**/site-packages/**}'
    );

    const allClasses = new Map<string, ClassNode>();
    const step = files.length > 0 ? 100 / files.length : 100;

    for (const uri of files) {
        progress?.report({ message: uri.fsPath.split('/').pop(), increment: step });
        try {
            const doc = await vscode.workspace.openTextDocument(uri);
            const classes = await extractClasses(doc);
            for (const [name, node] of classes) {
                if (!allClasses.has(name)) {
                    allClasses.set(name, node);
                }
            }
        } catch {
            // skip files that can't be parsed
        }
    }

    return allClasses;
}
