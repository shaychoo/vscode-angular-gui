import {
  basename,
  copyFolder,
  dirname,
  existsSync,
  globSync,
  join,
  readFile,
  readFiles,
  rmdirp,
  unlinkp,
  updateJson,
  writeFile
} from './helpers';

import { uniqueFn } from './utils';

const EXTENSION_UNIQUE_IDENTIFIER = 'sasxa-net.angular-gui';

/**
 * Exposes file system commands for specific files
 */
export class FilesManager {
  extensionRoot;
  extensionRootDir = '.angular-gui'; // For development only
  extensionProjectFolder;

  workspaceRoot;
  workspaceRootDir;
  workspaceCommandsFolder;
  workspaceSchematicsFolder;

  constructor(private config) {
    this.extensionRoot = this.config.extensionRoot;
    this.workspaceRoot = this.config.workspaceRoot;

    if (this.extensionRoot.includes(EXTENSION_UNIQUE_IDENTIFIER)) {
      this.extensionRootDir = '';
    }

    this.extensionProjectFolder = join(this.extensionRoot, this.extensionRootDir, basename(this.workspaceRoot));
    this.workspaceRootDir = join(this.workspaceRoot, this.config.rootDir);
    this.workspaceCommandsFolder = join(this.workspaceRootDir, 'commands');
    this.workspaceSchematicsFolder = join(this.workspaceRootDir, 'schematics');
  }

  /**
   * Copy installed project schematics
   * from workspace "node_modules" to extension "node_modules"
   */
  copyProjectSchematics(collections: string[]) {
    const promises
      = collections
        .filter(uniqueFn)
        .map(collectionName => {
          const pattern1 = join(this.workspaceRoot, 'node_modules', collectionName);
          const pattern2 = join(this.extensionRoot, 'schematics');

          const schematicsFolder
            = existsSync(pattern1)
              ? pattern1
              : existsSync(pattern2)
                ? pattern2
                : null;

          return schematicsFolder
            ? {
              source: join(schematicsFolder, '*'),
              target: join(this.extensionRoot, 'node_modules', collectionName)
            }
            : null;
        })
        .filter(o => !!o)
        .map(o => copyFolder(o.source, o.target));

    return Promise.all(promises);
  }

  /**
   * Copy schematics modified by user
   * from gui schematics folder to extension folder
   * to be able to use them in client app
   */
  async copyUserSchematics() {
    const promises
      = globSync('**/.changes.json', { cwd: this.workspaceSchematicsFolder })
        .map(pathinfo => join(this.workspaceSchematicsFolder, pathinfo))
        .map(pathinfo => {
          return readFile(pathinfo)
            .then(changes => ({
              ...changes,
              source: join(dirname(pathinfo), '*'),
              target: join(this.extensionRoot, 'node_modules', changes.path),
            }))
            .then(o => copyFolder(o.source, o.target))
        })
    return Promise.all(promises);
  }

  private updateRunnerScript(data) {
    if (!data) { return data; }
    const alias = this.config.npmRunner;
    const shouldUpdatePackageJson
      = !data.scripts
      || !(alias in data.scripts)
      || data.scripts[ alias ].includes('.runner.sh');

    if (shouldUpdatePackageJson) {
      const command = `sh ${ this.config.rootDir }/.runner.sh`;
      const scripts = { [ alias ]: command, ...data.scripts };
      return { ...data, scripts };
    } else {
      return data;
    }
  };

  createRunnerScript() {
    const script = `script=$1\nshift\nsh ${ this.config.rootDir }/commands/$script.sh $@`;
    const filename = join(this.workspaceRootDir, '.runner.sh');
    const packagePath = join(this.workspaceRoot, 'package.json');
    return writeFile(filename, script)
      .then(() =>
        updateJson<any>(packagePath, data =>
          this.updateRunnerScript(data)));
  }

  saveClientConfig(data) {
    const filename = join(this.extensionProjectFolder, '.angular-gui.json');
    return writeFile(filename, data);
  }

  deleteClientConfig() {
    return rmdirp(this.extensionProjectFolder);
  }

  saveCommand(name, data) {
    const filename = join(this.workspaceCommandsFolder, `${ name }.sh`);
    return writeFile(filename, data);
  }

  deleteCommand(name) {
    const filename = join(this.workspaceCommandsFolder, `${ name }.sh`);
    return unlinkp(filename);
  }

  get hasRunnerScript() {
    const filename = join(this.workspaceRootDir, '.runner.sh');
    return existsSync(filename);
  }

  get cliConfig() {
    const filename = join(this.workspaceRoot, '.angular-cli.json');
    return readFile(filename);
  }

  get clientConfig() {
    const filename = join(this.extensionProjectFolder, '.angular-gui.json');
    return readFile(filename);
  }

  get guiCommands() {
    return readFiles(this.workspaceCommandsFolder, '*');
  }

  get packageJSON() {
    const filename
      = join(this.extensionRoot, 'package.json');
    return readFile(filename);
  }
}
