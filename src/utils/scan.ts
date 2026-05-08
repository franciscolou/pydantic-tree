import * as vscode from 'vscode';
import { ClassNode } from '../types';
import { extractClasses } from './parser';

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

    return allClasses;
}
