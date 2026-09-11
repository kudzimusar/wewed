import ts from 'typescript'
const config=ts.readConfigFile('tsconfig.json',ts.sys.readFile)
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,process.cwd())
const program=ts.createProgram(parsed.fileNames,{...parsed.options,noEmit:true,incremental:false})
const diagnostics=ts.getPreEmitDiagnostics(program)
const affected=/ivory-floral|premium-invitation-experience|digital-invitation-card|wedding-public-access|guest-session\/route|gift-registry|install-prompt|pwa-register/
const relevant=diagnostics.filter(d=>d.file&&affected.test(d.file.fileName))
if(relevant.length){console.error(ts.formatDiagnosticsWithColorAndContext(relevant,{getCanonicalFileName:x=>x,getCurrentDirectory:ts.sys.getCurrentDirectory,getNewLine:()=> '\n'}));process.exitCode=1}
else console.log(`Invitation TypeScript gate passed; ${diagnostics.length} repository diagnostics outside this scope remain.`)
