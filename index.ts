import { listenAndServe, ServerRequest } from "https://deno.land/std/http/server.ts";
import { acceptWebSocket, acceptable, WebSocketEvent, WebSocket } from "https://deno.land/std/ws/mod.ts";
import { v4 } from "https://deno.land/std/uuid/mod.ts";

import {User, Group, Code, Message, ErrorCode} from "./types.ts";

// Parse arguments
const hostname: string = Deno.args[0];
const port: number = parseInt(Deno.args[1], 10);

// Create Maps to store data
const usersMap = new Map<string, User>();
const groupsMap = new Map<string, Group>();

listenAndServe({ port }, (req: ServerRequest) => {
    if (acceptable(req)) {
        acceptWebSocket({
            conn: req.conn,
            bufReader: req.r,
            bufWriter : req.w,
            headers: req.headers,
        }).then(async (ws) => {
            // Generate unique user id
            const userId: string = v4.generate();
            
            // Listen to messages from client
            for await (const data of ws) {
                console.log("data:", data, "userId:", userId);
                const event = typeof data === "string" ? JSON.parse(data.toString()) : data;
                switch (event.code) {
                    case Code.JOIN:
                    {
                        /**
                         * New user has joined
                         */

                        const { name, groupName } = event.data;

                        /**
                         * If user already exists, tell client
                         */
                        const usersInGroup: User[] = groupsMap.get(groupName) || [];
                        if (usersInGroup.length > 0) {
                            for (const _user of usersInGroup) {
                                if (_user.name === name) {
                                    const nameUsedEvent = {
                                        code: Code.ERROR,
                                        data: {
                                            error: {
                                                code: ErrorCode.NAME_USED,
                                                description: `User ${name} already exists in current group`,
                                            }
                                        }
                                    }
                                    ws.send(JSON.stringify(nameUsedEvent));
                                    return;
                                }
                            }
                        }
                        
                        // Create user
                        const userObject = {
                            userId,
                            name,
                            groupName,
                            ws,
                        }

                        // Store user
                        usersMap.set(userId, userObject);

                        // Create group if non existent
                        const group: Group = groupsMap.get(groupName) || [];

                        // Add user to group
                        group.push(userObject);

                        // Update group
                        groupsMap.set(groupName, group);

                        // Send own information to new user
                        emitNewUser(userObject);

                        // Broadcast to all group members about the user joining
                        emitUpdateUsers(groupName);
                        
                        break;
                    }
                    case Code.CLOSE: {
                        /**
                         * EndpointUnavailable
                         * Client has become unavailable
                         */
                            // Get user who left
                        const user = usersMap.get(userId);

                        if (user) {
                            const { groupName } = user;

                            // Delete user
                            usersMap.delete(userId);

                            // Update group
                            const nextUsers = groupsMap.get(groupName)?.filter((u: User) => {
                                return u.userId !== userId;
                            }) || [];

                            if (nextUsers.length === 0) {
                                groupsMap.delete(groupName);
                            } else {
                                groupsMap.set(groupName, nextUsers)
                            }

                            // Broadcast updated user list
                            emitUpdateUsers(groupName);
                        }

                        break;
                    }
                    case Code.MESSAGE: {
                        const { message } = event.data;
                        const groupName = usersMap.get(message.userId)?.groupName;

                        if (groupName) {
                            emitMessage(groupName, message);
                        }

                        break;
                    }
                    default:
                    {
                        console.log("unhandled event");
                        console.log(event);
                        break
                    }
                }
            }
        })
    }

    function emitNewUser(user: User): void {
        // Split ws so that it is not sent to the client
        const { ws, ...newUser} = user;
        const event = {
            code: Code.JOIN,
            data: {
                user: newUser,
            }
        }
        ws.send(JSON.stringify(event));
    }

    function emitUpdateUsers(groupName: string): void {
        const users = groupsMap.get(groupName) || [];
        const event = {
            code: Code.USERS,
            data: {
                users
            },
        }
        for (const user of users) {
            user.ws.send(JSON.stringify(event));
        }
    }

    function emitMessage(groupName: string, message: Message): void {
        const users = groupsMap.get(groupName) || [];
        const event = {
            code: Code.MESSAGE,
            data: {
                message: {
                    ...message,
                    messageId: v4.generate(),
                },
            },
        }
        for (const user of users) {
            user.ws.send(JSON.stringify(event));
        }
    }
})

console.log(`Server running on ${hostname}:${port}`);
