import { v4 } from "https://deno.land/std/uuid/mod.ts";
import { Code, Message, User } from "./types.ts";

/**
 * Send ping to a given user
 * @param user
 */
export const emitPing = (user: User): void => {
  const event = {
    code: Code.PING,
  };
  user.ws.send(JSON.stringify(event));
};

/**
 * Send user object to a user
 * Used for sending own data when a user joins
 * @param user: new user
 */
export const emitNewUser = (user: User): void => {
  // Split ws so that it is not sent to the client
  const { ws, ...newUser } = user;
  const event = {
    code: Code.JOIN,
    data: {
      user: newUser,
    },
  };
  ws.send(JSON.stringify(event));
};

/**
 * Send list of users to every user on list
 * Used for notifying all users in a group when someone joins or leaves
 * @param users
 */
export const emitUpdateUsers = (users: User[]): void => {
  const event = {
    code: Code.USERS,
    data: {
      users,
    },
  };
  for (const user of users) {
    user.ws.send(JSON.stringify(event));
  }
};

/**
 * Send message to a list of users
 * @param users
 * @param message
 */
export const emitMessage = (users: User[], message: Message): void => {
  const event = {
    code: Code.MESSAGE,
    data: {
      message: {
        ...message,
        messageId: v4.generate(),
      },
    },
  };
  for (const user of users) {
    user.ws.send(JSON.stringify(event));
  }
};

/**
 * Send a request for all messages to the oldest member of a group, when possible
 * @param users
 * @param userId
 */
export const emitGetMessages = (users: User[], userId: string): void => {
  if (users.length > 1) { // There was a user before the joining one
    const firstUser = users[0];
    const event = {
      code: Code.REQUEST_MESSAGES,
      data: {
        requestedUserId: userId,
      },
    };
    firstUser.ws.send(JSON.stringify(event));
  }
};

/**
 * Sends a list of messages to a given user
 * @param messages
 * @param requestedUser
 */
export const emitMessages = (
  messages: Message[],
  requestedUser: User,
): void => {
  if (requestedUser) {
    const event = {
      code: Code.RETURN_MESSAGES,
      data: {
        messages,
      },
    };
    requestedUser.ws.send(JSON.stringify(event));
  }
};
