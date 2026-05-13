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
    isAbstract?: boolean;
    isClassMethod?: boolean;
    isStaticMethod?: boolean;
}

export interface BaseRef {
    name: string;
    id?: string;
}
