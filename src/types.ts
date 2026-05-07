export interface AttrDef {
    name: string;
    type?: string;
    defaultValue?: string;
    definedAtLine: number;
}

export interface MethodParam {
    name: string;
    type?: string;
    defaultValue?: string;
}

export interface MethodDef {
    name: string;
    params: MethodParam[];
    returnType?: string;
    definedAtLine: number;
}

export interface BaseRef {
    name: string;
    id?: string;
}

export interface ClassNode {
    id: string;
    name: string;
    bases: BaseRef[];
    attributes: AttrDef[];
    methods: MethodDef[];
    definedAtLine: number;
    fileUri: string;
}

/* =========================================================
UI TYPES
========================================================= */

export interface RenderedBox {
    svg: string;
    width: number;
    height: number;
}

export type BoxMeasures = {
    x: number;
    y: number;
    width: number;
    height: number;
};
