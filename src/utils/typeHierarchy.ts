import * as vscode from 'vscode';
import { ClassNode } from '../types';
import { extractClasses } from './parser';

const EXCLUDED_DIR =
    /[\/\\](\.venv|venv|node_modules|__pycache__|\.git|site-packages)[\/\\]/;

function isWorkspaceFile(uri: vscode.Uri): boolean {
    if (!vscode.workspace.getWorkspaceFolder(uri)) {
        return false;
    }
    return !EXCLUDED_DIR.test(uri.fsPath);
}

function itemKey(item: vscode.TypeHierarchyItem): string {
    return `${item.uri.toString()}#${item.selectionRange.start.line}`;
}

export async function prepareTypeHierarchyAt(
    node: ClassNode
): Promise<vscode.TypeHierarchyItem | undefined> {
    const uri = vscode.Uri.parse(node.fileUri);
    const doc = await vscode.workspace.openTextDocument(uri);
    const lineText = doc.lineAt(node.definedAtLine).text;
    const classKwIdx = lineText.indexOf('class');
    const nameIdx = lineText.indexOf(
        node.name,
        classKwIdx >= 0 ? classKwIdx : 0
    );
    if (nameIdx < 0) {
        return undefined;
    }
    const pos = new vscode.Position(node.definedAtLine, nameIdx);

    const items = await vscode.commands.executeCommand<
        vscode.TypeHierarchyItem[]
    >('vscode.prepareTypeHierarchy', uri, pos);
    if (!items || items.length === 0) {
        return undefined;
    }
    return items.find(it => it.name === node.name) ?? items[0];
}

export async function collectSubtypesIntoClasses(
    rootItem: vscode.TypeHierarchyItem,
    classes: Map<string, ClassNode>
): Promise<void> {
    const seen = new Set<string>([itemKey(rootItem)]);
    const fileUris = new Set<string>();

    let frontier: vscode.TypeHierarchyItem[] = [rootItem];
    while (frontier.length > 0) {
        const results = await Promise.all(
            frontier.map(it =>
                vscode.commands.executeCommand<vscode.TypeHierarchyItem[]>(
                    'vscode.provideSubtypes',
                    it
                )
            )
        );
        const next: vscode.TypeHierarchyItem[] = [];
        for (const subs of results) {
            for (const sub of subs ?? []) {
                if (!isWorkspaceFile(sub.uri)) {
                    continue;
                }
                const key = itemKey(sub);
                if (seen.has(key)) {
                    continue;
                }
                seen.add(key);
                fileUris.add(sub.uri.toString());
                next.push(sub);
            }
        }
        frontier = next;
    }

    for (const uriStr of fileUris) {
        try {
            const doc = await vscode.workspace.openTextDocument(
                vscode.Uri.parse(uriStr)
            );
            const local = await extractClasses(doc);
            for (const [id, n] of local) {
                if (!classes.has(id)) {
                    classes.set(id, n);
                }
            }
        } catch {
            // skip unreadable files
        }
    }
}
