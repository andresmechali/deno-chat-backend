import {
  listenAndServe,
  ServerRequest,
} from "https://deno.land/std/http/server.ts";
import { acceptable, acceptWebSocket } from "https://deno.land/std/ws/mod.ts";
import { v4 } from "https://deno.land/std/uuid/mod.ts";
import "https://deno.land/x/dotenv/load.ts";
import {
  emitGetMessages,
  emitMessage,
  emitMessages,
  emitNewUser,
  emitPing,
  emitUpdateUsers,
} from "./chat.ts";
import { Code, Color, ErrorCode, GroupData, User } from "./types.ts";

const hostname: string = "0.0.0.0";
const port: number = parseInt(Deno.env.get("PORT") || "8080", 10);

// Create Maps to store data
const usersMap = new Map<string, User>();
const groupsDataMap = new Map<string, GroupData>();

// List of colors to be assigned to users
const colors: Color[] = Object.values(Color);

listenAndServe({ hostname, port }, (req: ServerRequest) => {
  if (acceptable(req)) {
    acceptWebSocket({
      conn: req.conn,
      bufReader: req.r,
      bufWriter: req.w,
      headers: req.headers,
    }).then(async (ws) => {
      // Generate unique user id
      const userId: string = v4.generate();

      // Listen to messages from client
      for await (const data of ws) {
        const event = typeof data === "string"
          ? JSON.parse(data.toString())
          : data;

        switch (event.code) {
          case Code.JOIN: {
            /**
             * New user has joined
             */

            const { name, groupName } = event.data;

            // Create group if non existent
            const group: GroupData = groupsDataMap.get(groupName) || {
              users: [],
              createdAt: new Date(),
              userCount: 0,
            };

            /**
             * Check if user already exists, and tell client if it does
             */
            const usersInGroup: User[] = group.users;

            const existingUser = usersInGroup.find(_user => _user.name === name);

            if (existingUser) {
              const nameUsedEvent = {
                code: Code.ERROR,
                data: {
                  error: {
                    code: ErrorCode.NAME_USED,
                    description:
                        `User ${name} already exists in current group.`,
                    information: {
                      name,
                      color: existingUser.color,
                    }
                  },
                },
              };

              if (!ws.isClosed) {
                ws.send(JSON.stringify(nameUsedEvent));
              }

              break;
            }

            // Create user
            const userObject: User = {
              userId,
              name,
              groupName,
              ws,
              color: colors[group.userCount % colors.length],
            };

            // Store user
            usersMap.set(userId, userObject);

            // Add user to group
            group.users.push(userObject);
            group.userCount += 1;

            // Update group
            groupsDataMap.set(groupName, group);

            // Send own information to new user
            emitNewUser(userObject);

            // Get old messages from first user, and send them to joining user
            emitGetMessages(group.users, userId);

            // Broadcast to all group members about the user joining
            emitUpdateUsers(group.users);

            break;
          }
          case Code.RETURN_MESSAGES: {
            /**
             * When old messages are received, send them to the recently
             * join user
             */

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
              const group = groupsDataMap.get(groupName);
              if (group) {
                const nextUsers = group.users?.filter((u: User) => {
                  return u.userId !== userId;
                }) || [];

                // If group is empty, delete it
                if (nextUsers.length === 0) {
                  groupsDataMap.delete(groupName);
                } else {
                  groupsDataMap.set(groupName, {
                    ...group,
                    users: nextUsers,
                  });
                }

                // Broadcast updated user list
                const users = groupsDataMap.get(groupName)?.users || [];
                emitUpdateUsers(users);
              }
            }

            break;
          }
          case Code.MESSAGE: {
            /**
             * New message received
             */

            const { message } = event.data;
            const groupName = usersMap.get(message.user.userId)?.groupName;

            // Broadcast message to all users in group
            if (groupName) {
              const users = groupsDataMap.get(groupName)?.users || [];
              emitMessage(users, message);
            }

            break;
          }
          case Code.PING: {
            /**
             * Regular ping for monitoring connection
             */

            const user = usersMap.get(userId);
            if (user) {
              emitPing(user);
            }
            break;
          }
          default: {
            console.log("Unhandled event:", event);
            break;
          }
        }
      }
    });
  }
});

console.log(`Server running on ${hostname}:${port}`);
