import { NextResponse } from "next/server";
import {
  sendEmail,
  verifyEmailConnection,
} from "@/app/lib/email";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const to =
      typeof body.to === "string"
        ? body.to.trim()
        : "";

    if (!to || !to.includes("@")) {
      return NextResponse.json(
        {
          success: false,
          error: "A valid recipient email is required.",
        },
        { status: 400 }
      );
    }

    await verifyEmailConnection();

    const result = await sendEmail({
      to,
      subject: "Sonic SMTP Test",
      text: "This is a test email sent from the Sonic application.",
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Sonic SMTP Test</h2>
          <p>This is a test email sent from the Sonic application.</p>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      message: "Test email sent.",
      messageId: result.messageId,
    });
  } catch (error) {
    console.error("SMTP test failed:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to send test email.",
      },
      { status: 500 }
    );
  }
}