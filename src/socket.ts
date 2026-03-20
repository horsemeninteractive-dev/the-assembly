import { io, Socket } from "socket.io-client";
import { ClientToServerEvents, ServerToClientEvents } from "./types.ts";

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();
