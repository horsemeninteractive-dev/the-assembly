import { Express } from 'express';
import { Server } from 'socket.io';
import { GameEngine } from '../gameEngine.ts';

export interface RouteContext {
  app: Express;
  io: Server;
  engine: GameEngine;
  userSockets: Map<string, string>;
  stripe: any;
}
