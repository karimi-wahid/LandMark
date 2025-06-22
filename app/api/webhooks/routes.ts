import { createOrUpdateUser, deleteUser } from "@/lib/actions/user";
import { clerkClient } from "@clerk/nextjs/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextRequest } from "next/server";

interface ClerkUser {
  id: string;
  first_name: string;
  last_name: string;
  image_url: string;
  email_addresses: Array<{ email_address: string }>;
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const evt = await verifyWebhook(req);

    if (!evt?.data?.id) {
      return new Response("Invalid user data", { status: 400 });
    }

    const { id, first_name, last_name, image_url, email_addresses } = evt.data;
    const eventType = evt.type;

    switch (eventType) {
      case "user.created":
      case "user.updated":
        try {
          const userData: ClerkUser = {
            id,
            first_name,
            last_name,
            image_url,
            email_addresses,
          };

          const user = await createOrUpdateUser(userData);

          if (eventType === "user.created" && user) {
            await clerkClient.users.updateUserMetadata(id, {
              publicMetadata: {
                userMongoId: user._id,
              },
            });
          }
        } catch (error) {
          console.error("Failed to create/update user:", error);
          return new Response("Error processing user", { status: 500 });
        }
        break;

      case "user.deleted":
        try {
          await deleteUser(id);
        } catch (error) {
          console.error("Failed to delete user:", error);
          return new Response("Error deleting user", { status: 500 });
        }
        break;

      default:
        console.warn("Unhandled event type:", eventType);
        break;
    }

    return new Response("Webhook processed", { status: 200 });
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return new Response("Invalid webhook", { status: 400 });
  }
}
