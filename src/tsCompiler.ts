import ts from "typescript";
import { Project, SourceFile, FunctionDeclaration, ArrowFunction, FunctionExpression, SyntaxKind } from "ts-morph";
import path from "path";


export type Error = {
    message: string;
    category: ts.DiagnosticCategory;
    code: number;
    start: number;
    length: number;
}

/**
 * JSDoc parsing utilities to extract documentation comments
 */
interface JSDocInfo {
    description: string;
    params: Record<string, string>;
    returns: string;
}

/**
 * Parses JSDoc comments to extract description, parameters and return documentation
 * @param commentText The raw JSDoc comment text
 * @returns Structured JSDoc information
 */
function parseJSDoc(commentText: string): JSDocInfo {
    const result: JSDocInfo = {
        description: '',
        params: {},
        returns: ''
    };

    // Clean up the comment text
    const cleanText = commentText
        .replace(/\/\*\*|\*\//g, '')
        .replace(/^\s*\*\s?/gm, '')
        .trim();

    // Split by @ tags
    const parts = cleanText.split(/\s*@(?=[a-zA-Z])/);

    // First part is the description
    if (parts.length > 0) {
        result.description = parts[0].trim();
    }

    // Process tags
    for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        const match = part.match(/^([a-zA-Z]+)\s+(.*?)(?:$|(?=\s*@))/s);

        if (match) {
            const [, tagName, content] = match;

            if (tagName === 'param' || tagName === 'parameter') {
                // Parse parameter
                const paramMatch = content.match(/^(?:{[^}]*})?\s*(\w+)(?:\s*-\s*|\s+)(.*)/s);
                if (paramMatch) {
                    const [, paramName, paramDesc] = paramMatch;
                    result.params[paramName] = paramDesc.trim();
                } else {
                    // Alternative format: just name followed by description
                    const simplerMatch = content.match(/^(\w+)\s+(.*)/s);
                    if (simplerMatch) {
                        const [, paramName, paramDesc] = simplerMatch;
                        result.params[paramName] = paramDesc.trim();
                    }
                }
            } else if (tagName === 'return' || tagName === 'returns') {
                // Parse return
                result.returns = content.trim();
            }
        }
    }

    return result;
}

export type JsonSchema = {
    type: string;
    description?: string;
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    additionalProperties?: boolean | JsonSchema;
    enum?: any[];
}

/**
 * Finds the default export function in the given source file
 * @param sourceCode The TypeScript source code
 * @returns The default export function or null if not found
 */
const findDefaultExportFunction = (sourceCode: string): {
    function: FunctionDeclaration | ArrowFunction | FunctionExpression | null,
    name: string | undefined
} => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile("index.ts", sourceCode);

    // Find export default statements
    const exportAssignments = sourceFile.getExportAssignments();
    for (const exportAssignment of exportAssignments) {
        if (exportAssignment.isExportEquals()) continue;

        const expression = exportAssignment.getExpression();

        // Handle direct function expressions
        if (expression.getKind() === SyntaxKind.FunctionExpression ||
            expression.getKind() === SyntaxKind.ArrowFunction) {
            return {
                function: expression as ArrowFunction | FunctionExpression,
                name: undefined
            };
        }

        // Handle identifier references to functions
        if (expression.getKind() === SyntaxKind.Identifier) {
            const identifier = expression.getText();

            // Try to find the function declaration
            const functionDeclaration = sourceFile.getFunction(identifier);
            if (functionDeclaration) {
                return {
                    function: functionDeclaration,
                    name: identifier
                };
            }

            // Try to find variable declarations with function expressions
            const variableDeclaration = sourceFile.getVariableDeclaration(identifier);
            if (variableDeclaration) {
                const initializer = variableDeclaration.getInitializer();
                if (initializer &&
                    (initializer.getKind() === SyntaxKind.FunctionExpression ||
                        initializer.getKind() === SyntaxKind.ArrowFunction)) {
                    return {
                        function: initializer as ArrowFunction | FunctionExpression,
                        name: identifier
                    };
                }
            }
        }
    }

    // Check for export default function declarations
    const exportedDeclarations = sourceFile.getExportedDeclarations();
    for (const [name, declarations] of exportedDeclarations) {
        if (name === "default") {
            for (const declaration of declarations) {
                if (declaration.getKind() === SyntaxKind.FunctionDeclaration) {
                    return {
                        function: declaration as FunctionDeclaration,
                        name: declaration.getFirstChildByKind(SyntaxKind.Identifier)?.getText()
                    };
                }
            }
        }
    }

    return { function: null, name: undefined };
};

/**
 * Generates a JSON schema for a function based on its TypeScript type information
 * @param funcNode The function node to analyze
 * @param sourceFile The source file containing the function
 * @returns A JSON schema describing the function parameters and return type
 */
const generateJsonSchema = (
    funcNode: FunctionDeclaration | ArrowFunction | FunctionExpression,
    sourceFile: SourceFile
): JsonSchema => {
    const schema: JsonSchema = {
        type: "object",
        properties: {},
    };

    // Get function JSDoc
    const functionJSDoc = funcNode.getLeadingCommentRanges()
        .map(range => range.getText())
        .join('\n');

    // Parse JSDoc
    const jsDocInfo = parseJSDoc(functionJSDoc);


    const parameters = funcNode.getParameters();
    const requiredParams: string[] = [];

    for (const param of parameters) {
        const paramName = param.getName();
        const paramType = param.getType();
        const typeText = paramType.getText();

        // Get parameter description from parsed JSDoc
        const paramDescription = jsDocInfo.params[paramName] || '';

        // Create parameter schema
        const paramSchema: JsonSchema = {
            type: mapTsTypeToJsonType(typeText),
            description: paramDescription
        };

        // Handle complex types
        if (paramType.isObject()) {
            paramSchema.properties = {};
            paramSchema.required = [];

            const properties = paramType.getProperties();
            for (const prop of properties) {
                const propName = prop.getName();
                const propType = prop.getValueDeclaration()?.getType();

                if (propType) {
                    paramSchema.properties[propName] = {
                        type: mapTsTypeToJsonType(propType.getText()),
                    };

                    // Check if property is optional
                    if (!prop.isOptional()) {
                        paramSchema.required!.push(propName);
                    }
                }
            }
        } else if (paramType.isArray()) {
            const arrayElementType = paramType.getArrayElementType();
            if (arrayElementType) {
                paramSchema.items = {
                    type: mapTsTypeToJsonType(arrayElementType.getText())
                };
            }
        } else if (paramType.isEnum()) {
            const enumMembers = paramType.getSymbol()?.getDeclarations()[0]
                ?.getSourceFile().getEnum(paramType.getText())?.getMembers();

            if (enumMembers) {
                paramSchema.enum = enumMembers.map(member => {
                    const value = member.getValue();
                    return typeof value === 'string' ? value : member.getName();
                });
            }
        }

        schema.properties![paramName] = paramSchema;

        // Add to required parameters if not optional
        if (!param.isOptional()) {
            requiredParams.push(paramName);
        }
    }

    if (requiredParams.length > 0) {
        schema.required = requiredParams;
    }

    return schema;
};

/**
 * Maps TypeScript types to JSON Schema types
 * @param tsType The TypeScript type as string
 * @returns The corresponding JSON Schema type
 */
const mapTsTypeToJsonType = (tsType: string): string => {
    if (tsType.includes('string')) return 'string';
    if (tsType.includes('number')) return 'number';
    if (tsType.includes('boolean')) return 'boolean';
    if (tsType.includes('null')) return 'null';
    if (tsType.includes('undefined')) return 'null';
    if (tsType.includes('any')) return 'object';
    if (tsType.includes('[]') || tsType.includes('Array')) return 'array';
    if (tsType.includes('object') || tsType.includes('{')) return 'object';
    return 'object';
};

export type CompileResult ={
    code: string;
    title?: string;
    description?: string;
    inputSchema?: JsonSchema;
    outputSchema?: JsonSchema;
} | {
    errors: Error[];
}

export const compile = async (tsCode: string, skipGlobals: boolean = false): Promise<CompileResult> => {
    if (!tsCode || tsCode.trim() === "") {
        throw new Error("No TypeScript code provided");
    }
    console.log("Compiling TypeScript code...");
    const sourceFileName = "index.ts";

    const sourceFile = ts.createSourceFile(sourceFileName, tsCode, ts.ScriptTarget.ESNext);

    const defaultCompilerHost = ts.createCompilerHost({});

    const customCompilerHost: ts.CompilerHost = {
        ...defaultCompilerHost,
        getSourceFile: (name, languageVersion) => {
            if (name === sourceFileName) {
                return sourceFile;
            } else {
                return defaultCompilerHost.getSourceFile(
                    name, languageVersion
                );
            }
        },
    };

    const program = ts.createProgram({
        rootNames: skipGlobals ? ["index.ts"] : ["index.ts", path.join(import.meta.dirname, "../workspaceTemplate/index.d.ts")],
        options: {
            esModuleInterop: true,
            types: ["node"],
            lib: ["lib.es2022.d.ts"],
            //typeRoots: ["./node_modules/@types"],
            //noLib: true,
            target: ts.ScriptTarget.ESNext,
            module: ts.ModuleKind.CommonJS,
            noEmitOnError: true,
            //skipLibCheck: true,
            //allowNonTsExtensions: true,
            moduleResolution: ts.ModuleResolutionKind.Node10,
        },
        host: customCompilerHost,
        projectReferences: undefined,
    });


    return new Promise((resolve, reject) => {

        const result = program.emit(sourceFile, (fileName, compiledJs) => {
            try {
                // Find the default export function using ts-morph
                const { function: defaultExportFunc, name } = findDefaultExportFunction(tsCode);

                if (!defaultExportFunc) {
                    reject(new Error("No default export function found in the source file"));
                    return;
                }

                // Create a project and source file for analysis
                const project = new Project({ useInMemoryFileSystem: true });
                const morpSourceFile = project.createSourceFile("index.ts", tsCode);

                // Get JSDoc for the function description
                const functionJSDoc = defaultExportFunc.getLeadingCommentRanges()
                    .map(range => range.getText())
                    .join('\n');

                const jsDocInfo = parseJSDoc(functionJSDoc);

                // Generate JSON schema for the function
                const inputSchema = generateJsonSchema(defaultExportFunc, morpSourceFile);

                // Get return type
                const returnType = defaultExportFunc.getReturnType();

                // Use return description from parsed JSDoc
                const outputSchema = {
                    type: mapTsTypeToJsonType(returnType.getText()),
                    description: jsDocInfo.returns
                };

                resolve({
                    code: compiledJs,
                    title: name || "default",
                    description: jsDocInfo.description,
                    inputSchema,
                    outputSchema,
                });
            } catch (error) {
                console.error("Error analyzing default export function:", error);
                resolve({ code: compiledJs });
            }
        });

        if (result.emitSkipped) {
            const { diagnostics } = result;

            if (diagnostics && diagnostics.length > 0) {
                resolve(({
                    errors: diagnostics.map(d => ({
                        message: d.messageText,
                        category: d.category,
                        code: d.code,
                        start: d.start,
                        length: d.length,
                    } as Error))
                }));

                return;
            }
        }
        reject(new Error("emitSkipped"));
    });
}