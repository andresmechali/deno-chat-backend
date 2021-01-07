import { WebSocket } from "https://deno.land/std/ws/mod.ts";

export interface User {
  userId: string;
  name: string;
  groupName: string;
  color: string;
  ws: WebSocket;
}

export interface Message {
  messageId: string;
  user: User;
  userId: string;
  name: string;
  message: string;
  timestamp: Date;
}

export enum ErrorCode {
  NAME_USED = 1,
}

export interface Error {
  code: ErrorCode;
  description: string;
  information: {
    name?: string,
    color?: Color,
  }
}

export type GroupData = {
  users: User[];
  createdAt: Date;
  userCount: number;
};

export enum Code {
  CLOSE = 1001,
  PING = 4000,
  JOIN = 4001,
  MESSAGE = 4002,
  REQUEST_MESSAGES = 4003,
  RETURN_MESSAGES = 4004,
  USERS = 4101,
  ERROR = 4300,
}

export enum Color {
  RED = "red",
  BLUE = "blue",
  GREEN = "green",
  PURPLE = "purple",
  YELLOW = "yellow",
  BROWN = "brown",
  ORANGE = "orange",
  TEAL = "teal",
  VIOLET = "violet",
  PINK = "pink",
  GREY = "grey",
  BLACK = "black",
}
