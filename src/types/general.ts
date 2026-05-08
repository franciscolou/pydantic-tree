import * as ParserTypes from './parser';

export interface ClassNode {
    id: string;
    name: string;
    bases: ParserTypes.BaseRef[];
    attributes: ParserTypes.AttrDef[];
    methods: ParserTypes.MethodDef[];
    definedAtLine: number;
    fileUri: string;
}

export type ClassRef = { fileUri: string; line: number };
