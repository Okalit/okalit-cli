import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATE_DIR = path.resolve(__dirname, '../templates/app');
const HELP_CONTENT = `
                                                            
   ▄▄▄▄    ▄▄                  ▄▄▄▄         ██              
  ██▀▀██   ██                  ▀▀██         ▀▀       ██     
 ██    ██  ██ ▄██▀    ▄█████▄    ██       ████     ███████  
 ██    ██  ██▄██      ▀ ▄▄▄██    ██         ██       ██     
 ██    ██  ██▀██▄    ▄██▀▀▀██    ██         ██       ██     
  ██▄▄██   ██  ▀█▄   ██▄▄▄███    ██▄▄▄   ▄▄▄██▄▄▄    ██▄▄▄  
   ▀▀▀▀    ▀▀   ▀▀▀   ▀▀▀▀ ▀▀     ▀▀▀▀   ▀▀▀▀▀▀▀▀     ▀▀▀▀     
  By LIAPF                             Okalit CLI - v0.3.3

Usage:
  okalit new <app-name>
  okalit generate <type> <path>

Commands:
  new <name>                Create a new app

  generate, -g
    -c, --component <path> Create a component
    -s, --service <path>   Create a service
        --gqservice <path> Create a GraphQL service
    -m, --module <path>    Create a module
        --guard <path>     Create a guard

Examples:
  okalit new my-app
  okalit -g -c ./src/components/user-card
  okalit -g -s ./src/modules/home/services/user
`;

function getHelpText() {
  return `${HELP_CONTENT}`;
}

export async function main(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    console.log(getHelpText());
    return;
  }

  const command = argv[0];

  if (command === 'new') {
    const appName = argv[1];
    if (!appName) {
      throw new Error('You must provide an app name: okalit new <app-name>.');
    }

    await createApp(appName, process.cwd());
    return;
  }

  if (argv.includes('-g') || argv.includes('--generate')) {
    await handleGenerate(argv, process.cwd());
    return;
  }

  throw new Error('Unknown command. Use --help to see available options.');
}

async function createApp(rawName, cwd) {
  const appName = toKebabCase(rawName);
  const targetDir = path.resolve(cwd, appName);

  if (fs.existsSync(targetDir)) {
    throw new Error(`La carpeta ya existe: ${targetDir}`);
  }

  copyDirectory(TEMPLATE_DIR, targetDir);

  const initialClassName = toPascalCase(appName);
  const mainAppFile = path.join(targetDir, 'src', 'main-app.js');
  const packageJsonFile = path.join(targetDir, 'package.json');
  const indexHtmlFile = path.join(targetDir, 'index.html');
  const routesFile = [
    path.join(targetDir, 'src', 'app.routes.ts'),
    path.join(targetDir, 'src', 'app.routes.js'),
  ].find((filePath) => fs.existsSync(filePath));

  if (!routesFile) {
    throw new Error('Could not find the app routes file.');
  }

  const routesExtension = path.extname(routesFile);

  replaceInFile(packageJsonFile, '"name": "okalit-app"', `"name": "${appName}"`);
  replaceInFile(indexHtmlFile, '<title>Okalit App</title>', `<title>${initialClassName}</title>`);
  replaceManyInFile(mainAppFile, [
    ['./app.routes.js', `./app.routes${routesExtension}`],
    ['./app.routes.ts', `./app.routes${routesExtension}`],
  ]);

  console.log(`Okalit app created at ${targetDir}`);
  console.log(`\nNext steps:`);
  console.log(`  cd ${appName}`);
  console.log('  npm install');
  console.log('  npm run dev');
}

async function handleGenerate(argv, cwd) {
  const projectRoot = findProjectRoot(cwd);
  const styleExt = detectStyleExtension(projectRoot);
  const coreAlias = detectCoreAlias(projectRoot);
  const globalStyleSpecifier = detectGlobalStyleSpecifier(projectRoot);

  const targets = [
    { kind: 'component', flags: ['-c', '--component'] },
    { kind: 'service', flags: ['-s', '--service'] },
    { kind: 'gqservice', flags: ['--gqservice'] },
    { kind: 'module', flags: ['-m', '--module'] },
    { kind: 'guard', flags: ['--guard'] },
    { kind: 'interceptor', flags: ['--interceptor'] },
  ];

  for (const target of targets) {
    const value = readFlagValue(argv, target.flags);
    if (!value) {
      continue;
    }

    switch (target.kind) {
      case 'component':
        generateComponent(projectRoot, value, styleExt, coreAlias, globalStyleSpecifier);
        break;
      case 'service':
        generatePlainFile(projectRoot, value, 'service', buildServiceTemplate(value, coreAlias));
        break;
      case 'gqservice':
        generatePlainFile(projectRoot, value, 'service', buildGQServiceTemplate(value, coreAlias));
        break;
      case 'module':
        generateModule(projectRoot, value, styleExt, coreAlias, globalStyleSpecifier);
        break;
      case 'guard':
        generatePlainFile(projectRoot, value, 'guard', buildGuardTemplate(value));
        break;
      default:
        break;
    }

    return;
  }

  throw new Error('You must specify what to generate. Use -c, -s, -m, --guard or --interceptor.');
}

function generateComponent(projectRoot, targetPath, styleExt, coreAlias, globalStyleSpecifier) {
  const normalizedTarget = normalizeProjectPath(projectRoot, targetPath);
  const baseName = toKebabCase(path.basename(normalizedTarget));
  const componentDir = normalizedTarget;
  const jsFile = path.join(componentDir, `${baseName}.js`);
  const styleFile = path.join(componentDir, `${baseName}.${styleExt}`);
  const className = toPascalCase(baseName);

  ensureMissing(componentDir);
  fs.mkdirSync(componentDir, { recursive: true });
  fs.writeFileSync(jsFile, buildComponentTemplate(baseName, className, styleExt, coreAlias, globalStyleSpecifier));
  fs.writeFileSync(styleFile, '', 'utf8');

  console.log(`Component created: ${path.relative(projectRoot, componentDir)}`);
}

function generateModule(projectRoot, targetPath, styleExt, coreAlias, globalStyleSpecifier) {
  const normalizedTarget = normalizeProjectPath(projectRoot, targetPath);
  const moduleName = toKebabCase(path.basename(normalizedTarget));
  const moduleDir = normalizedTarget;
  const pagesDir = path.join(moduleDir, 'pages');
  const className = toPascalCase(moduleName);

  ensureMissing(moduleDir);
  fs.mkdirSync(pagesDir, { recursive: true });

  const moduleFile = path.join(moduleDir, `${moduleName}.module.js`);
  const routesFile = path.join(moduleDir, `${moduleName}.routes.js`);
  const pageFile = path.join(pagesDir, `${moduleName}.page.js`);
  const styleFile = path.join(pagesDir, `${moduleName}.page.${styleExt}`);

  fs.writeFileSync(moduleFile, buildModuleTemplate(moduleName, className, coreAlias));
  fs.writeFileSync(routesFile, buildModuleRoutesTemplate(moduleName), 'utf8');
  fs.writeFileSync(pageFile, buildPageTemplate(moduleName, className, styleExt, coreAlias, globalStyleSpecifier));
  fs.writeFileSync(styleFile, '', 'utf8');

  attachModuleToAppRoutes(projectRoot, moduleName, className);

  console.log(`Module created: ${path.relative(projectRoot, moduleDir)}`);
}

function generatePlainFile(projectRoot, targetPath, suffix, template) {
  const normalizedTarget = normalizeProjectPath(projectRoot, targetPath);
  const dirname = path.dirname(normalizedTarget);
  const baseName = toKebabCase(path.basename(normalizedTarget));
  const filePath = path.join(dirname, `${baseName}.${suffix}.js`);

  ensureMissing(filePath);
  fs.mkdirSync(dirname, { recursive: true });
  fs.writeFileSync(filePath, template(baseName), 'utf8');

  console.log(`File created: ${path.relative(projectRoot, filePath)}`);
}

function buildComponentTemplate(tagName, className, styleExt, coreAlias, globalStyleSpecifier) {
  const globalStyleImport = globalStyleSpecifier
    ? `\nimport global from "${globalStyleSpecifier}";`
    : '';
  const stylesArray = globalStyleSpecifier ? '[styles, global]' : '[styles]';

  return `import { Okalit, defineElement, html } from "${coreAlias}";

import styles from "./${tagName}.${styleExt}?inline";${globalStyleImport}

@defineElement({
  tag: "${tagName}",
  styles: ${stylesArray}
})
export class ${className} extends Okalit {
  render() {
    return html\`
      <div class="${tagName}">
        <slot></slot>
      </div>
    \`;
  }
}
`;
}

function buildModuleTemplate(moduleName, className, coreAlias) {
  return `import { ModuleMixin, Okalit, defineElement } from "${coreAlias}";

@defineElement({ tag: "${moduleName}-module" })
export class ${className}Module extends ModuleMixin(Okalit) {}
`;
}

function buildModuleRoutesTemplate(moduleName) {
  return `export default [
  {
    path: "",
    component: "${moduleName}-page",
    import: () => import("./pages/${moduleName}.page.js")
  }
];
`;
}

function buildPageTemplate(pageName, className, styleExt, coreAlias, globalStyleSpecifier) {
  const globalStyleImport = globalStyleSpecifier
    ? `import global from "${globalStyleSpecifier}";`
    : '';
  const stylesArray = globalStyleSpecifier ? '[styles, global]' : '[styles]';

  return `
import { Okalit, defineElement, html, PageMixin, t } from "${coreAlias}";

import styles from "./${pageName}.page.${styleExt}?inline";
${globalStyleImport}

@defineElement({
  tag: "${pageName}-page",
  styles: ${stylesArray}
})
export class ${className}Page extends PageMixin(Okalit) {
  render() {
    return html\`
      <main>
        <h1>${'${t("WELCOME")}'}</h1>
      </main>
    \`;
  }
}
`;
}

function buildGQServiceTemplate(_, coreAlias) {
  return (baseName) => {
    const className = `${toPascalCase(baseName)}Service`;
    const serviceName = `${toCamelCase(baseName)}Service`;

    return `import { OkalitGraphqlService, service } from "${coreAlias}";

@service("${serviceName}")
export class ${className} extends OkalitGraphqlService {
  constructor() {
    super();
    this.configure({
      endpoint: '',
      cache: true,
      cacheTTL: 120_000,
    });
  }
}
`;
  };
} 

function buildServiceTemplate(_, coreAlias) {
  return (baseName) => {
    const className = `${toPascalCase(baseName)}Service`;
    const serviceName = `${toCamelCase(baseName)}Service`;

    return `import { OkalitService, service } from "${coreAlias}";

@service("${serviceName}")
export class ${className} extends OkalitService {
  constructor() {
    super();
    this.configure({
      baseUrl: '',
      cache: true,
      cacheTTL: 60_000,
    });
  }
}
`;
  };
}

function buildGuardTemplate(rawTarget) {
  return (baseName) => {
    const functionName = `${toCamelCase(baseName)}Guard`;

    return `export async function ${functionName}() {
  return true;
}
`;
  };
}

function attachModuleToAppRoutes(projectRoot, moduleName, className) {
  const candidateFiles = [
    path.join(projectRoot, 'src', 'app.routes.ts'),
    path.join(projectRoot, 'src', 'app.routes.js'),
  ];
  const routesFile = candidateFiles.find((file) => fs.existsSync(file));

  if (!routesFile) {
    return;
  }

  const importLine = `import ${className}ModuleRoutes from "./modules/${moduleName}/${moduleName}.routes.js";`;
  const routeEntry = `  {\n    path: "/${moduleName}",\n    component: "${moduleName}-module",\n    import: () => import("./modules/${moduleName}/${moduleName}.module.js"),\n    children: ${className}ModuleRoutes,\n  }`;
  const source = fs.readFileSync(routesFile, 'utf8');

  if (source.includes(importLine) || source.includes(`"/${moduleName}"`)) {
    return;
  }

  let next = source;
  if (/^export default \[/m.test(next)) {
    next = `${importLine}\n\n${next}`;
  }

  next = next.replace(/export default \[(.*?)\];/s, (match, body) => {
    const trimmedBody = body.trim();
    if (!trimmedBody) {
      return `export default [\n${routeEntry}\n];`;
    }

    return `export default [\n${trimmedBody.endsWith(',') ? trimmedBody : `${trimmedBody},`}\n${routeEntry}\n];`;
  });

  fs.writeFileSync(routesFile, `${next.endsWith('\n') ? next : `${next}\n`}`, 'utf8');
}

function findProjectRoot(startDir) {
  let currentDir = startDir;

  while (true) {
    const packageJsonFile = path.join(currentDir, 'package.json');
    if (fs.existsSync(packageJsonFile)) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error('No package.json found. Run this command inside an Okalit project.');
    }

    currentDir = parentDir;
  }
}

function detectStyleExtension(projectRoot) {
  const packageJsonFile = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(packageJsonFile)) {
    return 'scss';
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8'));
  const hasSass = Boolean(packageJson.dependencies?.sass || packageJson.devDependencies?.sass);
  return hasSass ? 'scss' : 'css';
}

function detectGlobalStyleSpecifier(projectRoot) {
  const candidates = [
    {
      filePath: path.join(projectRoot, 'src', 'styles', 'global.scss'),
      specifier: '@styles/global.scss?inline',
    },
    {
      filePath: path.join(projectRoot, 'src', 'styles', 'global.css'),
      specifier: '@styles/global.css?inline',
    },
  ];

  return candidates.find((candidate) => fs.existsSync(candidate.filePath))?.specifier ?? null;
}

function detectCoreAlias(projectRoot) {
  const viteConfigFile = path.join(projectRoot, 'vite.config.js');
  if (!fs.existsSync(viteConfigFile)) {
    return '@okalit';
  }

  const viteConfig = fs.readFileSync(viteConfigFile, 'utf8');
  if (viteConfig.includes("'@core'") || viteConfig.includes('"@core"')) {
    return '@core';
  }

  if (viteConfig.includes("'@okalit'") || viteConfig.includes('"@okalit"')) {
    return '@okalit';
  }

  return '@okalit';
}

function normalizeProjectPath(projectRoot, inputPath) {
  const resolved = path.resolve(projectRoot, inputPath);
  return resolved;
}

function readFlagValue(argv, flags) {
  for (const flag of flags) {
    const index = argv.indexOf(flag);
    if (index !== -1) {
      return argv[index + 1];
    }
  }

  return null;
}

function copyDirectory(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') {
      continue;
    }

    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
      continue;
    }

    fs.copyFileSync(sourcePath, targetPath);
  }
}

function replaceInFile(filePath, searchValue, replaceValue) {
  const source = fs.readFileSync(filePath, 'utf8');
  fs.writeFileSync(filePath, source.replace(searchValue, replaceValue), 'utf8');
}

function replaceManyInFile(filePath, replacements) {
  let source = fs.readFileSync(filePath, 'utf8');

  for (const [searchValue, replaceValue] of replacements) {
    source = source.replaceAll(searchValue, replaceValue);
  }

  fs.writeFileSync(filePath, source, 'utf8');
}

function renameIfExists(sourcePath, targetPath) {
  if (fs.existsSync(sourcePath)) {
    fs.renameSync(sourcePath, targetPath);
  }
}

function ensureMissing(targetPath) {
  if (fs.existsSync(targetPath)) {
    throw new Error(`Ya existe: ${targetPath}`);
  }
}

function toKebabCase(value) {
  return value
    .replace(/^[./\\]+/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9/]+/g, '-')
    .replace(/\/+/g, '/')
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.toLowerCase().replace(/^-+|-+$/g, ''))
    .join('/');
}

function toPascalCase(value) {
  return toKebabCase(value)
    .split('/')
    .at(-1)
    .split('-')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');
}

function toCamelCase(value) {
  const pascal = toPascalCase(value);
  return pascal ? pascal[0].toLowerCase() + pascal.slice(1) : '';
}