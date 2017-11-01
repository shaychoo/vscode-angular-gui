import * as commands from '../commands';
import * as express from 'express';
import * as io from 'socket.io';
import * as stoppable from 'stoppable';

import { hasRunnerScript, readFile, readFiles } from './files';

import { Command } from './models';
import { OutputChannel } from 'vscode';
import { Server } from 'http';
import { processCommand } from './runner';

export class AngularGUI {
  app; server; socket;
  constructor(public config) {
    this.app = express().get('/', (req, res) => res.sendStatus(202));
  }

  start(cb, log) {
    this.server = stoppable(this.app.listen(this.config.port, () => {
      log(`Listening on localhost:${ this.config.port }`);
    }), 0);

    this.server.once('listening', () => cb(null));

    this.socket = io(this.server).on('connection', async socket => {
      log('Client connected');
      const clientConfig = {
        cliConfig: await readFile('.angular-cli.json'),
        cliCommands: Object.values(commands),
        guiConfig: {
          ...this.config,
          runner: await hasRunnerScript(this.config.rootDir),
        },
        guiCommands: await readFiles(`${ this.config.rootDir }/commands/*`),
      };

      socket.emit('init', clientConfig);

      socket.on('command', (command: Command) =>
        processCommand(command, socket, this.config));

    });

    this.socket.on('connection', () => cb(true));
    this.socket.on('disconnect', () => cb(null));

  }

  stop(cb) {
    this.server.once('close', () => cb(false));
    this.server.stop();
  }
}
