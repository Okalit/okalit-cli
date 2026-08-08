import fs from 'node:fs';
import chalk from 'chalk';
import path from 'node:path';
import gradient from 'gradient-string';
import { fileURLToPath } from 'node:url';
import inquirer from 'inquirer';
import ora from 'ora';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATE_DIR = path.resolve(__dirname, '../templates/app');
const TEMPLATE_EMPTY = path.resolve(__dirname, '../templates/empty');
const TEMPLATE_COMPONENT = path.resolve(__dirname, '../templates/component');
const TEMPLATE_CATALOG = path.resolve(__dirname, '../templates/catalog');

const LOGO = `
  ▄███████▄      ██████╗ ██╗  ██╗ █████╗ ██╗     ██╗████████╗
▄██       ██▄   ██╔═══██╗██║ ██╔╝██╔══██╗██║     ██║╚══██╔══╝
██         ██   ██║   ██║█████╔╝ ███████║██║     ██║   ██║
██         ██   ██║   ██║██╔═██╗ ██╔══██║██║     ██║   ██║
▀██       ██▀   ╚██████╔╝██║  ██╗██║  ██║███████╗██║   ██║
  ▀███████▀      ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝   ╚═╝
`;

const okalitGradient = gradient(['#6366f1', '#8b5cf6', '#a855f7', '#3b82f6', '#06b6d4']);
const titleGradient = gradient(['#f59e0b', '#f97316', '#ef4444', '#ec4899', '#8b5cf6']);

function buildHelpContent() {
  const separator = chalk.dim('─'.repeat(65));
  return `
${chalk.bold.white('                  Okalit CLI')} ${chalk.bgHex('#8b5cf6').white(' v0.5.3')}
${chalk.dim('           Build Web Apps with Web Components')}

${separator}

${titleGradient.multiline('  ◆ Scaffold')}
    ${chalk.cyan('new')} <name>                Create a project, component, or catalog

${titleGradient.multiline('  ◆ Add from catalog')}
    ${chalk.cyan('add')} <name>                Install a component/page from a registry
        ${chalk.gray('--registry <url>')}     GitHub registry URL
        ${chalk.gray('--path <dest>')}        Custom destination path
        ${chalk.gray('--type <type>')}        Force type: component | page

${titleGradient.multiline('  ◆ Update')}
    ${chalk.cyan('update')}                   Update all catalog components
    ${chalk.cyan('update')} <name>            Update a specific component

${titleGradient.multiline('  ◆ Generate')}
    ${chalk.cyan('-g')} ${chalk.gray('-c, --component')} <path>  Create a component
    ${chalk.cyan('-g')} ${chalk.gray('-p, --page')} <path>       Create a page
    ${chalk.cyan('-g')} ${chalk.gray('-s, --service')} <path>    Create a service
    ${chalk.cyan('-g')} ${chalk.gray('    --gqservice')} <path>  Create a GraphQL service
    ${chalk.cyan('-g')} ${chalk.gray('-m, --module')} <path>     Create a module
    ${chalk.cyan('-g')} ${chalk.gray('    --guard')} <path>      Create a guard

${separator}

${chalk.yellow.bold('  Examples:')}
    ${chalk.dim('$')} ${chalk.green('okalit')} new my-app
    ${chalk.dim('$')} ${chalk.green('okalit')} new my-button              ${chalk.gray('→ select Component')}
    ${chalk.dim('$')} ${chalk.green('okalit')} add button-atom --registry github.com/org/catalog
    ${chalk.dim('$')} ${chalk.green('okalit')} add settings-page --path ./src/modules/settings/pages
    ${chalk.dim('$')} ${chalk.green('okalit')} -g -c ./src/components/user-card

${separator}
${chalk.dim('                            Made with ♥ by')} ${chalk.bold('LIAPF')}
`;
}

async function showAnimatedHelp() {
  process.stdout.write('\x1B[2J\x1B[H');
  console.log(okalitGradient.multiline(LOGO));
  console.log(buildHelpContent());
}

function getHelpText() {
  return okalitGradient.multiline(LOGO) + buildHelpContent();
}

export async function main(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    await showAnimatedHelp();
    return;
  }

  const command = argv[0];

  if (command === 'add') {
    await handleAdd(argv.slice(1), process.cwd());
    return;
  }

  if (command === 'update') {
    await handleUpdate(argv.slice(1), process.cwd());
    return;
  }

  if (command === 'new') {
    const appName = argv[1];
    
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'appName',
        message: 'What is your project name?',
        default: appName || 'my-okalit-app',
        when: !appName
      },
      {
        type: 'rawlist',
        name: 'creationType',
        message: 'What do you want to create?',
        choices: [
          { name: 'Project', value: 'project' },
          { name: 'Component', value: 'component' },
          { name: 'Catalog', value: 'catalog' },
        ],
      },
      {
        type: 'rawlist',
        name: 'styleType',
        message: 'Which style format?',
        choices: [
          { name: 'SCSS', value: 'scss' },
          { name: 'CSS', value: 'css' },
        ],
        when: (ans) => ans.creationType === 'component' || ans.creationType === 'catalog',
      },
      {
        type: 'confirm',
        name: 'templateType',
        message: 'Empty Project:',
        default: false,
        when: (ans) => ans.creationType === 'project',
      }
    ]);

    const finalName = appName || answers.appName;

    switch (answers.creationType) {
      case 'component':
        await createComponent(finalName, process.cwd(), answers.styleType || 'scss');
        break;
      case 'catalog':
        await createCatalog(finalName, process.cwd(), answers.styleType || 'scss');
        break;
      default:
        await createApp(finalName, process.cwd(), answers);
        break;
    }

    return;
  }

  if (argv.includes('-g') || argv.includes('--generate')) {
    await handleGenerate(argv, process.cwd());
    return;
  }

  throw new Error('Unknown command. Use --help to see available options.');
}

async function createApp(rawName, cwd, options = {}) {
  const appName = toKebabCase(rawName);
  const targetDir = path.resolve(cwd, appName);
  const isEmpty = options.templateType === true;
  const selectedTemplate = isEmpty ? TEMPLATE_EMPTY : TEMPLATE_DIR;

  // 1. Check if folder already exists
  if (fs.existsSync(targetDir)) {
    throw new Error(`The folder already exists: ${targetDir}`);
  }

  const spinner = ora({
    text: chalk.blue(`Creating project "${chalk.bold(appName)}"...`),
    spinner: 'arc',
    color: 'magenta',
  }).start();

  // 3. Copy files from Template
  // In the future, you can switch based on options.templateType here
  copyDirectory(selectedTemplate, targetDir);

  // 4. Resolve paths for replacement
  const initialClassName = toPascalCase(appName);
  const mainAppFile = path.join(targetDir, 'src', 'main-app.js');
  const packageJsonFile = path.join(targetDir, 'package.json');
  const indexHtmlFile = path.join(targetDir, 'index.html');
  
  const routesFile = [
    path.join(targetDir, 'src', 'app.routes.ts'),
    path.join(targetDir, 'src', 'app.routes.js'),
  ].find((filePath) => fs.existsSync(filePath));

  if (!routesFile) {
    throw new Error('Could not find the app routes file in template.');
  }

  const routesExtension = path.extname(routesFile);

  // 5. Apply replacements
  replaceInFile(packageJsonFile, '"name": "okalit-app"', `"name": "${appName}"`);
  replaceInFile(indexHtmlFile, '<title>Okalit App</title>', `<title>${initialClassName}</title>`);
  
  // Update main-app.js imports to match the actual routes extension
  replaceManyInFile(mainAppFile, [
    ['./app.routes.js', `./app.routes${routesExtension}`],
    ['./app.routes.ts', `./app.routes${routesExtension}`],
  ]);

  // 6. Handle future flags (Optional logic placeholder)
  if (options.includeTauri) {
    // Logic for Tauri setup will go here
  }

  // 7. Success Feedback
  spinner.succeed(gradient(['#10b981', '#06b6d4'])('Project generated successfully!'));
  
  console.log(`\n${chalk.yellow.bold('Next steps:')}`);
  console.log(`  ${chalk.cyan('cd')} ${appName}`);
  console.log(`  ${chalk.cyan('npm install')}`);
  console.log(`  ${chalk.cyan('npm run dev')}\n`);
}

async function createComponent(rawName, cwd, styleExt = 'scss') {
  const componentName = toKebabCase(rawName);
  const targetDir = path.resolve(cwd, componentName);
  const className = toPascalCase(componentName);

  if (fs.existsSync(targetDir)) {
    throw new Error(`The folder already exists: ${targetDir}`);
  }

  const spinner = ora({
    text: chalk.blue(`Creating component "${chalk.bold(componentName)}"...`),
    spinner: 'arc',
    color: 'magenta',
  }).start();

  copyDirectory(TEMPLATE_COMPONENT, targetDir);

  const jsFile = path.join(targetDir, 'src', 'component-name.js');
  const scssFile = path.join(targetDir, 'src', 'component-name.scss');
  const packageJsonFile = path.join(targetDir, 'package.json');
  const registryFile = path.join(targetDir, 'registry.json');
  const indexHtmlFile = path.join(targetDir, 'index.html');

  // Rename files with chosen style extension
  const jsTarget = path.join(targetDir, 'src', `${componentName}.js`);
  const styleTarget = path.join(targetDir, 'src', `${componentName}.${styleExt}`);
  fs.renameSync(jsFile, jsTarget);
  fs.renameSync(scssFile, styleTarget);

  // Replace placeholders in JS (including style extension)
  replaceManyInFile(jsTarget, [
    ['component-name.scss', `${componentName}.${styleExt}`],
    ['component-name', componentName],
    ['ComponentName', className],
  ]);

  // Replace in package.json
  replaceManyInFile(packageJsonFile, [
    ['component-name', componentName],
  ]);

  // Remove sass from devDependencies if using CSS
  if (styleExt === 'css') {
    const pkgContent = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8'));
    if (pkgContent.devDependencies?.sass) {
      delete pkgContent.devDependencies.sass;
      if (Object.keys(pkgContent.devDependencies).length === 0) {
        delete pkgContent.devDependencies;
      }
    }
    fs.writeFileSync(packageJsonFile, JSON.stringify(pkgContent, null, 2) + '\n', 'utf8');
  }

  // Replace in registry.json
  replaceManyInFile(registryFile, [
    ['component-name.scss', `${componentName}.${styleExt}`],
    ['component-name', componentName],
  ]);

  // Replace in index.html
  replaceManyInFile(indexHtmlFile, [
    ['component-name', componentName],
  ]);

  // Replace in rsbuild.config.mjs
  const rsbuildFile = path.join(targetDir, 'rsbuild.config.mjs');
  replaceManyInFile(rsbuildFile, [
    ['component-name', componentName],
  ]);

  // Replace in demo.js
  const demoFile = path.join(targetDir, 'demo.js');
  replaceManyInFile(demoFile, [
    ['component-name', componentName],
    ['ComponentName', className],
  ]);

  spinner.succeed(gradient(['#10b981', '#06b6d4'])('Component created successfully!'));

  console.log(`\n${chalk.yellow.bold('Next steps:')}`);
  console.log(`  ${chalk.cyan('cd')} ${componentName}`);
  console.log(`  ${chalk.cyan('npm install')}`);
  console.log(`  ${chalk.cyan('npm run dev')}   ${chalk.dim('← preview your component')}`);
  console.log(`  ${chalk.dim('Push to GitHub when ready to share')}\n`);
}

async function createCatalog(rawName, cwd, styleExt = 'scss') {
  const catalogName = toKebabCase(rawName);
  const targetDir = path.resolve(cwd, catalogName);

  if (fs.existsSync(targetDir)) {
    throw new Error(`The folder already exists: ${targetDir}`);
  }

  const spinner = ora({
    text: chalk.blue(`Creating catalog "${chalk.bold(catalogName)}"...`),
    spinner: 'arc',
    color: 'magenta',
  }).start();

  copyDirectory(TEMPLATE_CATALOG, targetDir);

  const packageJsonFile = path.join(targetDir, 'package.json');
  replaceManyInFile(packageJsonFile, [
    ['catalog-name', catalogName],
  ]);

  // Adapt example-button to chosen style extension
  const exampleDir = path.join(targetDir, 'components', 'example-button');
  const exampleJs = path.join(exampleDir, 'example-button.js');
  const exampleScss = path.join(exampleDir, 'example-button.scss');

  if (styleExt === 'css') {
    const cssTarget = path.join(exampleDir, 'example-button.css');
    fs.renameSync(exampleScss, cssTarget);
    replaceManyInFile(exampleJs, [
      ['example-button.scss', 'example-button.css'],
    ]);
  }

  // Update registry.json to reflect actual file extension
  const registryFile = path.join(targetDir, 'registry.json');
  replaceManyInFile(registryFile, [
    ['example-button.scss', `example-button.${styleExt}`],
  ]);

  spinner.succeed(gradient(['#10b981', '#06b6d4'])('Catalog created successfully!'));

  console.log(`\n${chalk.yellow.bold('Structure:')}`);
  console.log(`  ${chalk.dim(catalogName + '/')}`);
  console.log(`  ${chalk.dim('├──')} registry.json       ${chalk.gray('← component index')}`);
  console.log(`  ${chalk.dim('├──')} package.json`);
  console.log(`  ${chalk.dim('└── components/')}`);
  console.log(`      ${chalk.dim('└── example-button/')} ${chalk.gray('← sample component')}`);

  console.log(`\n${chalk.yellow.bold('Next steps:')}`);
  console.log(`  ${chalk.cyan('cd')} ${catalogName}`);
  console.log(`  Add components in ${chalk.cyan('components/<name>/')}`);
  console.log(`  Update ${chalk.cyan('registry.json')} to index them`);
  console.log(`  ${chalk.dim('Push to GitHub to share your catalog')}\n`);
}

async function handleGenerate(argv, cwd) {
  const projectRoot = findProjectRoot(cwd);
  const styleExt = detectStyleExtension(projectRoot);
  const coreAlias = detectCoreAlias(projectRoot);
  const globalStyleSpecifier = detectGlobalStyleSpecifier(projectRoot);

  const targets = [
    { kind: 'component', flags: ['-c', '--component'] },
    { kind: 'page', flags: ['-p', '--page'] },
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
      case 'page':
        generatePage(projectRoot, value, styleExt, coreAlias, globalStyleSpecifier);
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

// --- Add from catalog ---

const DEFAULT_CATALOG_DEST = 'src/catalogs';
const DEFAULT_PAGE_DEST = 'src/pages';

async function handleAdd(argv, cwd) {
  const componentName = argv[0];
  if (!componentName) {
    throw new Error('You must specify a component name. Usage: okalit add <name> --registry <url>');
  }

  const registryUrl = readFlagValue(argv, ['--registry', '-r']);
  const customPath = readFlagValue(argv, ['--path']);
  const forceType = readFlagValue(argv, ['--type']);
  const projectRoot = findProjectRoot(cwd);

  // Resolve registry: flag > package.json > prompt
  const registry = registryUrl || readRegistryFromPackageJson(projectRoot);
  if (!registry) {
    throw new Error(
      'No registry specified. Use --registry <url> or set "okalit.registry" in package.json.'
    );
  }

  const spinner = ora({
    text: chalk.blue(`Fetching "${chalk.bold(componentName)}" from registry...`),
    spinner: 'arc',
    color: 'magenta',
  }).start();

  const registryData = normalizeRegistryData(await fetchRegistryJson(registry), componentName);
  const entry = registryData.components?.[componentName];

  if (!entry) {
    spinner.fail(chalk.red(`Component "${componentName}" not found in registry.`));
    const available = Object.keys(registryData.components || {});
    if (available.length) {
      console.log(`\n${chalk.yellow('Available:')}`);
      for (const name of available) {
        const meta = registryData.components[name];
        console.log(`  ${chalk.cyan(name)} ${chalk.dim(meta.type || 'component')}`);
      }
    }
    return;
  }

  // Resolve full dependency tree (breadth-first, deduplicated)
  const installPlan = resolveDependencyTree(componentName, registryData);

  spinner.text = chalk.blue(`Installing ${installPlan.length} component(s)...`);

  const installed = [];
  const skipped = [];

  for (const depName of installPlan) {
    const depEntry = registryData.components[depName];
    if (!depEntry) {
      console.log(chalk.yellow(`  ⚠ Dependency "${depName}" not found in registry, skipping.`));
      continue;
    }

    const depType = (depName === componentName && forceType) ? forceType : (depEntry.type || 'component');
    const depDest = (depName === componentName && customPath)
      ? resolveDestination(projectRoot, customPath, depType, depName)
      : resolveDestination(projectRoot, null, depType, depName);

    // Skip if already exists (deduplication)
    if (fs.existsSync(depDest)) {
      skipped.push(depName);
      continue;
    }

    const files = depEntry.files || [];
    const remotePath = depEntry.path || `components/${depName}`;
    fs.mkdirSync(depDest, { recursive: true });

    for (const file of files) {
      const content = await fetchFileFromRegistry(registry, remotePath, file);
      fs.writeFileSync(path.join(depDest, file), content, 'utf8');
    }

    installed.push({ name: depName, dest: depDest, type: depType });
  }

  // Track installed components in lock file
  if (installed.length) {
    const lock = readLockFile(projectRoot);
    for (const { name, dest, type } of installed) {
      lock[name] = {
        registry,
        type,
        path: path.relative(projectRoot, dest),
        installedAt: new Date().toISOString(),
      };
    }
    writeLockFile(projectRoot, lock);
  }

  spinner.succeed(gradient(['#10b981', '#06b6d4'])(`Done!`));

  // Report installed
  if (installed.length) {
    console.log(`\n${chalk.green.bold('  Installed:')}`);
    for (const { name, dest, type } of installed) {
      const rel = path.relative(projectRoot, dest);
      const badge = type === 'page' ? chalk.bgBlue.white(' page ') : chalk.bgMagenta.white(' comp ');
      console.log(`    ${badge} ${chalk.cyan(name)} ${chalk.dim('→')} ${rel}`);
    }
  }

  // Report skipped (already existed)
  if (skipped.length) {
    console.log(`\n${chalk.dim('  Already installed (skipped):')}`);
    for (const name of skipped) {
      console.log(`    ${chalk.dim('•')} ${name}`);
    }
  }

  // Show channels info for the main component
  if (entry.channels?.length) {
    console.log(`\n${chalk.yellow('  Channels used:')}`);
    for (const ch of entry.channels) {
      console.log(`    ${chalk.dim('•')} ${chalk.magenta(ch)}`);
    }
    console.log(chalk.dim('  Make sure these channels are defined in your app.'));
  }

  console.log('');
}

/**
 * Resolves the full dependency tree in install order (dependencies first).
 * Deduplicates: each component appears only once.
 */
function resolveDependencyTree(rootName, registryData) {
  const visited = new Set();
  const order = [];

  function walk(name) {
    if (visited.has(name)) return;
    visited.add(name);

    const entry = registryData.components?.[name];
    if (!entry) return;

    // Install dependencies first
    for (const dep of entry.dependencies || []) {
      walk(dep);
    }

    order.push(name);
  }

  walk(rootName);
  return order;
}

// --- Lock file management ---

const LOCK_FILE = 'okalit.lock.json';

function readLockFile(projectRoot) {
  const lockPath = path.join(projectRoot, LOCK_FILE);
  if (!fs.existsSync(lockPath)) return {};
  return JSON.parse(fs.readFileSync(lockPath, 'utf8'));
}

function writeLockFile(projectRoot, lock) {
  const lockPath = path.join(projectRoot, LOCK_FILE);
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf8');
}

// --- Expected dependency versions (bumped with each CLI release) ---

const LATEST_VERSIONS = {
  '@okalit/core': '^0.1.9',
  '@okalit/demo-components': '^0.1.2',
  'lit': '^3.0.0',
  'uhtml': '^5.0.9',
  '@biomejs/biome': '2.4.11',
  '@rsbuild/core': '^1.7.5',
  '@rsbuild/plugin-babel': '^1.1.2',
  '@rsbuild/plugin-sass': '^1.5.1',
  '@babel/core': '^7.29.0',
  '@babel/plugin-proposal-decorators': '^7.29.0',
};

const BIOME_SCHEMA = 'https://biomejs.dev/schemas/2.4.11/schema.json';

// --- Update command ---

async function handleUpdate(argv, cwd) {
  const targetName = argv[0];
  const projectRoot = findProjectRoot(cwd);

  // If a specific component name is given, only update that catalog component
  if (targetName) {
    await updateCatalogComponents(projectRoot, targetName);
    return;
  }

  // Otherwise: full project update + catalog update
  console.log('');
  await updateProjectStructure(projectRoot);
  await updateCatalogComponents(projectRoot, null);
}

async function updateProjectStructure(projectRoot) {
  const pkgPath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) return;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const projectType = detectProjectType(projectRoot, pkg);
  const changes = [];

  // 1. Update dependency versions
  const depsToCheck = {
    app: ['@okalit/core', 'lit', 'uhtml'],
    component: ['@okalit/core', '@okalit/demo-components', 'lit', 'uhtml'],
    catalog: [],
  };

  const devDepsToCheck = {
    app: ['@biomejs/biome', '@rsbuild/core', '@rsbuild/plugin-babel', '@rsbuild/plugin-sass', '@babel/core', '@babel/plugin-proposal-decorators'],
    component: ['@biomejs/biome', '@rsbuild/core', '@rsbuild/plugin-babel', '@rsbuild/plugin-sass', '@babel/core', '@babel/plugin-proposal-decorators'],
    catalog: ['@biomejs/biome'],
  };

  for (const dep of depsToCheck[projectType] || []) {
    if (dep === pkg.name) continue;
    const current = pkg.dependencies?.[dep];
    const inPeers = pkg.peerDependencies?.[dep];
    const inDev = pkg.devDependencies?.[dep];
    const latest = LATEST_VERSIONS[dep];
    if (inPeers) {
      if (latest && inPeers !== latest) {
        pkg.peerDependencies[dep] = latest;
        changes.push(`${dep} (peer): ${inPeers} → ${latest}`);
      }
      if (inDev && latest && inDev !== latest) {
        pkg.devDependencies[dep] = latest;
        changes.push(`${dep} (dev): ${inDev} → ${latest}`);
      }
      continue;
    }
    if (latest && current && current !== latest) {
      pkg.dependencies[dep] = latest;
      changes.push(`${dep}: ${current} → ${latest}`);
    } else if (latest && !current) {
      pkg.dependencies = pkg.dependencies || {};
      pkg.dependencies[dep] = latest;
      changes.push(`${dep}: added (${latest})`);
    }
  }

  for (const dep of devDepsToCheck[projectType] || []) {
    if (dep === pkg.name) continue;
    const current = pkg.devDependencies?.[dep];
    const latest = LATEST_VERSIONS[dep];
    if (latest && current && current !== latest) {
      pkg.devDependencies[dep] = latest;
      changes.push(`${dep}: ${current} → ${latest}`);
    } else if (latest && !current) {
      pkg.devDependencies = pkg.devDependencies || {};
      pkg.devDependencies[dep] = latest;
      changes.push(`${dep}: added (${latest})`);
    }
  }

  if (changes.length) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  }

  // 2. Update biome.json schema version
  const biomePath = path.join(projectRoot, 'biome.json');
  if (fs.existsSync(biomePath)) {
    const biome = JSON.parse(fs.readFileSync(biomePath, 'utf8'));
    if (biome.$schema && biome.$schema !== BIOME_SCHEMA) {
      const oldSchema = biome.$schema;
      biome.$schema = BIOME_SCHEMA;
      fs.writeFileSync(biomePath, JSON.stringify(biome, null, 2) + '\n', 'utf8');
      changes.push(`biome.json schema updated`);
    }
  }

  // 3. Ensure @catalogs alias exists in rsbuild (app projects)
  if (projectType === 'app') {
    const rsbuildPath = path.join(projectRoot, 'rsbuild.config.mjs');
    if (fs.existsSync(rsbuildPath)) {
      let rsbuildContent = fs.readFileSync(rsbuildPath, 'utf8');
      if (!rsbuildContent.includes('@catalogs')) {
        rsbuildContent = rsbuildContent.replace(
          /alias:\s*\{/,
          `alias: {\n      '@catalogs': path.resolve(__dirname, 'src/catalogs'),`
        );
        fs.writeFileSync(rsbuildPath, rsbuildContent, 'utf8');
        changes.push(`rsbuild: added @catalogs alias`);
      }
    }
  }

  // 4. Ensure src/catalogs/ directory exists (app projects)
  if (projectType === 'app') {
    const catalogsDir = path.join(projectRoot, 'src', 'catalogs');
    if (!fs.existsSync(catalogsDir)) {
      fs.mkdirSync(catalogsDir, { recursive: true });
      changes.push(`created src/catalogs/`);
    }
  }

  // Report
  if (changes.length) {
    console.log(chalk.green.bold('  Project updated:'));
    for (const change of changes) {
      console.log(`    ${chalk.cyan('↺')} ${change}`);
    }
    console.log(chalk.dim('\n  Run `npm install` to apply dependency changes.\n'));
  } else {
    console.log(chalk.dim('  Project is up to date.\n'));
  }
}

function detectProjectType(projectRoot, pkg) {
  // Catalog: has components/ dir and no src/
  if (fs.existsSync(path.join(projectRoot, 'components')) && !fs.existsSync(path.join(projectRoot, 'src', 'main-app.js'))) {
    return 'catalog';
  }
  // App: has src/main-app.js or src/app.routes.js
  if (fs.existsSync(path.join(projectRoot, 'src', 'main-app.js')) || fs.existsSync(path.join(projectRoot, 'src', 'app.routes.js'))) {
    return 'app';
  }
  // Component: has demo.js or registry.json with "tag" field
  if (fs.existsSync(path.join(projectRoot, 'demo.js'))) {
    return 'component';
  }
  // Fallback
  return 'app';
}

async function updateCatalogComponents(projectRoot, targetName) {
  const lock = readLockFile(projectRoot);

  if (Object.keys(lock).length === 0) {
    if (targetName) {
      throw new Error(`"${targetName}" is not tracked in ${LOCK_FILE}.`);
    }
    return;
  }

  const toUpdate = targetName
    ? { [targetName]: lock[targetName] }
    : lock;

  if (targetName && !lock[targetName]) {
    throw new Error(
      `"${targetName}" is not tracked in ${LOCK_FILE}. Available: ${Object.keys(lock).join(', ')}`
    );
  }

  const spinner = ora({
    text: chalk.blue(`Updating ${Object.keys(toUpdate).length} catalog component(s)...`),
    spinner: 'arc',
    color: 'magenta',
  }).start();

  const updated = [];
  const failed = [];

  for (const [name, meta] of Object.entries(toUpdate)) {
    try {
      const registryData = normalizeRegistryData(await fetchRegistryJson(meta.registry), name);
      const entry = registryData.components?.[name];

      if (!entry) {
        failed.push({ name, reason: 'not found in registry' });
        continue;
      }

      const destDir = path.resolve(projectRoot, meta.path);
      const files = entry.files || [];
      const remotePath = entry.path || `components/${name}`;

      fs.mkdirSync(destDir, { recursive: true });
      for (const file of files) {
        const content = await fetchFileFromRegistry(meta.registry, remotePath, file);
        fs.writeFileSync(path.join(destDir, file), content, 'utf8');
      }

      lock[name].updatedAt = new Date().toISOString();
      updated.push(name);
    } catch (err) {
      failed.push({ name, reason: err.message });
    }
  }

  writeLockFile(projectRoot, lock);
  spinner.succeed(gradient(['#10b981', '#06b6d4'])('Catalogs updated!'));

  if (updated.length) {
    console.log(`\n${chalk.green.bold('  Updated:')}`);
    for (const name of updated) {
      console.log(`    ${chalk.cyan('↺')} ${name}`);
    }
  }

  if (failed.length) {
    console.log(`\n${chalk.red.bold('  Failed:')}`);
    for (const { name, reason } of failed) {
      console.log(`    ${chalk.red('✗')} ${name} ${chalk.dim(`— ${reason}`)}`);
    }
  }

  console.log('');
}

function resolveDestination(projectRoot, customPath, type, componentName) {
  if (customPath) {
    const resolved = path.resolve(projectRoot, customPath);
    if (path.basename(resolved) === componentName) return resolved;
    return path.join(resolved, componentName);
  }

  const defaultBase = type === 'page' ? DEFAULT_PAGE_DEST : DEFAULT_CATALOG_DEST;
  return path.join(projectRoot, defaultBase, componentName);
}

function readRegistryFromPackageJson(projectRoot) {
  const pkgPath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  return pkg.okalit?.registry || null;
}

async function fetchRegistryJson(registry) {
  const rawUrl = buildRawUrl(registry, 'registry.json');
  const response = await fetch(rawUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch registry.json from ${rawUrl} (${response.status})`);
  }
  return response.json();
}

// Supports both standalone component format and catalog format
function normalizeRegistryData(data, componentName) {
  if (data.components) return data;

  // Standalone component format: { name, tag, files, ... }
  return {
    components: {
      [data.name || data.tag || componentName]: {
        type: data.type || 'component',
        path: data.path || 'src',
        files: data.files || [],
        channels: data.channels || [],
        dependencies: data.dependencies || [],
      },
    },
  };
}

async function fetchFileFromRegistry(registry, remotePath, fileName) {
  const rawUrl = buildRawUrl(registry, `${remotePath}/${fileName}`);
  const response = await fetch(rawUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${fileName} from ${rawUrl} (${response.status})`);
  }
  return response.text();
}

function buildRawUrl(registry, filePath) {
  // Support formats: github.com/user/repo, https://github.com/user/repo
  const cleaned = registry.replace(/^https?:\/\//, '').replace(/\/$/, '');

  if (cleaned.startsWith('github.com/')) {
    const repoPath = cleaned.replace('github.com/', '');
    return `https://raw.githubusercontent.com/${repoPath}/main/${filePath}`;
  }

  // Fallback: treat as a direct base URL
  return `${registry.replace(/\/$/, '')}/${filePath}`;
}

function generatePage(projectRoot, targetPath, styleExt, coreAlias, globalStyleSpecifier) {
  const normalizedTarget = normalizeProjectPath(projectRoot, targetPath);
  const baseName = toKebabCase(path.basename(normalizedTarget));
  const componentDir = normalizedTarget;
  const jsFile = path.join(componentDir, `${baseName}.js`);
  const styleFile = path.join(componentDir, `${baseName}.${styleExt}`);
  const className = toPascalCase(baseName);

  ensureMissing(componentDir);
  fs.mkdirSync(componentDir, { recursive: true });
  fs.writeFileSync(jsFile, buildPageTemplateDefault(baseName, className, styleExt, coreAlias, globalStyleSpecifier));
  fs.writeFileSync(styleFile, '', 'utf8');

  console.log(`Page created: ${path.relative(projectRoot, componentDir)}`);
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

function buildPageTemplateDefault(tagName, className, styleExt, coreAlias, globalStyleSpecifier) {
  const globalStyleImport = globalStyleSpecifier
    ? `\nimport global from "${globalStyleSpecifier}";`
    : '';
  const stylesArray = globalStyleSpecifier ? '[styles, global]' : '[styles]';

  return `import { Okalit, defineElement, html, PageMixin } from "${coreAlias}";

import styles from "./${tagName}.${styleExt}?inline";${globalStyleImport}

@defineElement({
  tag: "${tagName}",
  styles: ${stylesArray}
})
export class ${className} extends PageMixin(Okalit) {
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
  return '@okalit/core';
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