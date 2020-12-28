import { listenAndServe, ServerRequest } from "https://deno.land/std/http/server.ts";
import { acceptWebSocket, acceptable } from "https://deno.land/std/ws/mod.ts";
import { v4 } from "https://deno.land/std/uuid/mod.ts";
import "https://deno.land/x/dotenv/load.ts";
import {
    emitPing,
    emitNewUser,
    emitUpdateUsers,
    emitMessage,
    emitGetMessages,
    emitMessages
} from "./chat.ts";

const hostname: string = "0.0.0.0";
const port: number = parseInt(Deno.env.get("PORT") || "8080", 10);

import { User, Group, Code, ErrorCode, Color } from "./types.ts";

// Create Maps to store data
const usersMap = new Map<string, User>();
const groupsMap = new Map<string, Group>();

// List of colors to be assigned to users
const colors: Color[] = Object.values(Color)

listenAndServe({ hostname, port }, (req: ServerRequest) => {
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
                        const userObject: User = {
                            userId,
                            name,
                            groupName,
                            ws,
                            color: colors[usersInGroup.length % colors.length],
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

                        // Get old messages from first user, and send them to joining user
                        const users = groupsMap.get(groupName) || [];
                        emitGetMessages(users, userId);

                        // Broadcast to all group members about the user joining
                        emitUpdateUsers(users);
                        
                        break;
                    }
                    case Code.RETURN_MESSAGES: {
                        const { messages, requestedUserId } = event.data;
                        const requestedUser = usersMap.get(requestedUserId);
                        if (requestedUser) {
                            emitMessages(messages, requestedUser);
                        }
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
                            const users = groupsMap.get(groupName) || [];
                            emitUpdateUsers(users);
                        }

                        break;
                    }
                    case Code.MESSAGE: {
                        const { message } = event.data;
                        const groupName = usersMap.get(message.user.userId)?.groupName;

                        if (groupName) {
                            const users = groupsMap.get(groupName) || [];
                            emitMessage(users, message);
                        }

                        break;
                    }
                    case Code.PING: {
                        const user = usersMap.get(userId);
                        if (user) {
                            emitPing(user);
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
})

console.log(`Server running on ${hostname}:${port}`);
