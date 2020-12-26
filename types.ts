import { WebSocket } from "https://deno.land/std/ws/mod.ts";

export interface User {
    userId: string,
    name: string,
    groupName: string,
    color: string,
    ws: WebSocket,
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
}

export type Group = User[];

export enum Code {
    CLOSE = 1001,
    JOIN = 4001,
    MESSAGE = 4002,
    REQUEST_MESSAGES = 4003,
    RETURN_MESSAGES = 4004,
    USERS = 4101,
    ERROR = 4300,
}