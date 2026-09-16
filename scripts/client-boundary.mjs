import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import { builtinModules } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
const safeDomainFiles = new Set(['types.ts','defaults.ts','capabilities.ts']);
function serverPath(file) { return /(?:^|\/)server\//.test(file) || /\.server\.[cm]?[jt]s$/.test(file) || (/\/lib\/studio-adapter\//.test(file) && !safeDomainFiles.has(file.split('/').at(-1))); }
export function assertClientBoundary(root, entry = 'src/main.tsx') {
  const seen = new Set();
  function visit(file) {
    if (seen.has(file)) return; seen.add(file);
    if (serverPath(file)) throw new Error(`Server-only module in client import graph: ${relative(root,file)}`);
    const text=readFileSync(file,'utf8');
    const ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
    const imports=[];
    function walk(node) {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        const clause=ts.isImportDeclaration(node)?node.importClause:node.exportClause;
        const typeOnly=node.isTypeOnly || clause?.isTypeOnly || (clause && ts.isNamedExports(clause) && clause.elements.every(e=>e.isTypeOnly));
        if (!typeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
      }
      if (ts.isCallExpression(node) && (node.expression.kind===ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text==='require'))) {
        if (node.arguments.length!==1 || !ts.isStringLiteral(node.arguments[0])) throw new Error('Computed client imports are not allowed by the server boundary.');
        imports.push(node.arguments[0].text);
      }
      ts.forEachChild(node,walk);
    }
    walk(ast);
    for (const spec of imports) {
      if (builtinModules.includes(spec) || /^(node:|cloudflare:|server-only$)/.test(spec)) throw new Error(`Server-only import in client: ${spec}`);
      if (!spec.startsWith('.')) continue;
      const base=resolve(dirname(file),spec);
      const target=[base,...['.ts','.tsx','.js','.mjs','/index.ts','/index.tsx'].map(ext=>base+ext)].find(p=>existsSync(p) && /\.[cm]?[jt]sx?$/.test(p));
      if (target) visit(target);
    }
  }
  visit(resolve(root,entry));
}
export function clientBoundaryPlugin(root=process.cwd()) {
  return {name:'studio-server-only-boundary',enforce:'pre',buildStart(){assertClientBoundary(root);},transform(_code,id){if (serverPath(id.split('?')[0])) throw new Error(`Server-only module cannot be served to the client: ${id}`);}};
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {assertClientBoundary(process.cwd()); console.log('Client/server boundary passed.');}
