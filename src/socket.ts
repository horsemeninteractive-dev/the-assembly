import { io, Socket } from "socket.io-client";
import { ClientToServerEvents, ServerToClientEvents } from "./types.ts";
import { Capacitor } from "@capacitor/core";

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  Capacitor.isNativePlatform() ? "https://theassembly.web.app" : undefined
);
