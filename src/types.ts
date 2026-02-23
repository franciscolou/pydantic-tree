export interface AttrDef {
    name: string;
    type?: string;
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

export interface ClassNode {
    name: string;
    bases: string[];
    attributes: AttrDef[];
    methods: MethodDef[];
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
