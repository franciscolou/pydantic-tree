import * as ParserTypes from './parser';

export interface ClassNode {
    id: string;
    name: string;
    bases: ParserTypes.BaseRef[];
    attributes: ParserTypes.AttrDef[];
    properties: ParserTypes.PropDef[];
    methods: ParserTypes.MethodDef[];
    definedAtLine: number;
    fileUri: string;
    isAbstract?: boolean;
}

export type ClassRef = { fileUri: string; line: number };
